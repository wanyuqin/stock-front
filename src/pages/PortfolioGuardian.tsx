/**
 * PortfolioGuardian — 持仓守护页面
 *
 * 设计原则：
 * - GET /diagnose  → 纯量化刷新（首次 + 每 30s 自动），不消耗 AI token
 * - POST /analyze/:code → 手动点击「AI 深度分析」按钮才触发，按需消耗 token
 * - AI 结果在内存中按 code 缓存，弹窗关闭再开不重复请求
 */

import {
  useState, useCallback, useEffect, useRef, useMemo
} from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Shield, RefreshCw, Plus, X, Brain, AlertTriangle,
  TrendingUp, TrendingDown, Activity, Zap, Clock,
  ArrowRight, Target, BarChart2, ChevronRight, Sparkles,
} from 'lucide-react'
import { fetchPositionDiagnosis, analyzePosition, syncPosition } from '@/api/stock'
import type {
  PositionDiagnosisResult, PositionAIResult, SignalType,
  DiagnosticSnapshot, SyncPositionRequest,
} from '@/types'

// ════════════════════════════════════════════════════════════════
// 常量
// ════════════════════════════════════════════════════════════════
const FEE_BUY  = 0.0001
const FEE_SELL = 0.0006
const AUTO_REFRESH_SEC = 30

// ════════════════════════════════════════════════════════════════
// 信号配置
// ════════════════════════════════════════════════════════════════
const SIGNAL_CFG: Record<SignalType, {
  label: string; short: string
  textCls: string; bgCls: string; borderCls: string
  icon: React.ReactNode; priority: number; glow: boolean
}> = {
  STOP_LOSS: {
    label: '⚡ 立即止损', short: 'STOP LOSS',
    textCls: 'text-red-400', bgCls: 'bg-red-500/10', borderCls: 'border-red-500/50',
    icon: <AlertTriangle size={13} />, priority: 0, glow: true,
  },
  SELL_T: {
    label: '📤 高抛做T', short: 'SELL T',
    textCls: 'text-amber-400', bgCls: 'bg-amber-500/10', borderCls: 'border-amber-500/40',
    icon: <TrendingDown size={13} />, priority: 1, glow: false,
  },
  BUY_T: {
    label: '📥 低吸做T', short: 'BUY T',
    textCls: 'text-accent-green', bgCls: 'bg-accent-green/10', borderCls: 'border-accent-green/40',
    icon: <TrendingUp size={13} />, priority: 2, glow: false,
  },
  SELL: {
    label: '🔻 减仓观望', short: 'SELL',
    textCls: 'text-orange-400', bgCls: 'bg-orange-500/10', borderCls: 'border-orange-500/30',
    icon: <TrendingDown size={13} />, priority: 3, glow: false,
  },
  HOLD: {
    label: '⏸ 持有等待', short: 'HOLD',
    textCls: 'text-sky-400', bgCls: 'bg-sky-500/10', borderCls: 'border-sky-500/25',
    icon: <Activity size={13} />, priority: 4, glow: false,
  },
}

// ════════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════════
const f2     = (n: number) => n.toFixed(2)
const f3     = (n: number) => n.toFixed(3)
const fPct   = (n: number, d = 2) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`
const fYuan  = (n: number) => {
  const abs = Math.abs(n), s = n >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${s}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${s}${(abs / 1e4).toFixed(1)}万`
  return `${s}${abs.toFixed(0)}元`
}
const tBreakEven = (cost: number) => cost * (1 + FEE_BUY) / (1 - FEE_SELL)
const tNet = (price: number, cost: number) =>
  (price * (1 - FEE_SELL) - cost * (1 + FEE_BUY)) / cost
const stopDanger = (price: number, cost: number, stop: number) => {
  if (stop >= cost) return 1
  return Math.max(0, Math.min(1, 1 - (price - stop) / (cost - stop)))
}

// ════════════════════════════════════════════════════════════════
// 迷你饼图
// ════════════════════════════════════════════════════════════════
const PIE_COLORS = ['#00d97e', '#f59e0b', '#3b82f6', '#f97316', '#22d3ee', '#6b7280']

function MiniPie({ data, size = 52 }: { data: { value: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ width: size, height: size }} />
  const r = size / 2 - 4, cx = size / 2, cy = size / 2
  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const a = (d.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    angle += a
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle)
    return { x1, y1, x2, y2, large: a > Math.PI ? 1 : 0, color: PIE_COLORS[i % 6], a }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="#1e2d3d" strokeWidth="1" />
      {slices.map((s, i) => s.a > 0.01 && (
        <path key={i}
          d={`M${cx},${cy}L${s.x1},${s.y1}A${r},${r} 0 ${s.large} 1 ${s.x2},${s.y2}Z`}
          fill={s.color} opacity={0.88} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.44} fill="#131920" />
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════
// 资产概览
// ════════════════════════════════════════════════════════════════
function StatsBar({ items }: { items: PositionDiagnosisResult[] }) {
  const totalCost = items.reduce((s, i) => s + i.snapshot.avg_cost * i.position.quantity, 0)
  const totalMkt  = items.reduce((s, i) => s + i.snapshot.price   * i.position.quantity, 0)
  const totalPnl  = totalMkt - totalCost
  const pnlPct    = totalCost > 0 ? totalPnl / totalCost : 0
  const stopCount = items.filter(i => i.signal === 'STOP_LOSS').length
  const tCount    = items.filter(i => i.signal === 'BUY_T' || i.signal === 'SELL_T').length

  return (
    <div className="grid grid-cols-5 gap-3">
      <Stat label="总市值"
        value={`¥${fYuan(totalMkt).replace(/^[+-]/, '')}`}
        sub={`成本 ¥${fYuan(totalCost).replace(/^[+-]/, '')}`}
        vc="text-ink-primary" />
      <Stat label="持仓浮盈"
        value={fYuan(totalPnl)} sub={fPct(pnlPct)}
        vc={totalPnl >= 0 ? 'text-accent-green' : 'text-red-400'} />
      <Stat label="止损警报"
        value={stopCount.toString()}
        sub={stopCount > 0 ? '⚠ 需立即处理' : '✓ 全部安全'}
        vc={stopCount > 0 ? 'text-red-400' : 'text-ink-muted'}
        pulse={stopCount > 0} />
      <Stat label="做T机会"
        value={tCount.toString()}
        sub={tCount > 0 ? '可操作' : '暂无'}
        vc={tCount > 0 ? 'text-amber-400' : 'text-ink-muted'} />
      {/* 仓位饼图 */}
      <div className="bg-terminal-panel border border-terminal-border rounded-xl p-4 flex items-center gap-3">
        <MiniPie data={items.map(i => ({ value: i.snapshot.price * i.position.quantity }))} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-ink-muted font-mono uppercase tracking-wider mb-1.5">仓位分布</p>
          {items.slice(0, 3).map((item, idx) => {
            const pct = totalMkt > 0 ? (item.snapshot.price * item.position.quantity) / totalMkt : 0
            return (
              <div key={item.stock_code} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: PIE_COLORS[idx] }} />
                <span className="text-[10px] font-mono text-ink-secondary truncate">{item.stock_code}</span>
                <span className="text-[10px] font-mono text-ink-muted ml-auto">{(pct * 100).toFixed(0)}%</span>
              </div>
            )
          })}
          {items.length > 3 && <p className="text-[10px] text-ink-muted font-mono">+{items.length - 3} 只</p>}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, vc, pulse = false }: {
  label: string; value: string; sub: string; vc: string; pulse?: boolean
}) {
  return (
    <div className="bg-terminal-panel border border-terminal-border rounded-xl p-4">
      <p className="text-[10px] text-ink-muted font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${vc} ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
      <p className="text-[10px] text-ink-muted mt-1 font-mono">{sub}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 风险进度条
// ════════════════════════════════════════════════════════════════
function RiskBar({ snap }: { snap: DiagnosticSnapshot }) {
  const danger = stopDanger(snap.price, snap.avg_cost, snap.hard_stop_loss)
  const distPct = snap.avg_cost > 0 ? (snap.price - snap.hard_stop_loss) / snap.avg_cost : 0
  const color = danger >= 0.85 ? '#ff4d6a' : danger >= 0.6 ? '#f59e0b' : '#00d97e'
  const label = danger >= 0.85 ? '⚠ 危险' : danger >= 0.6 ? '△ 警戒' : '✓ 安全'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-ink-muted uppercase tracking-wider">风险雷达 · 距硬止损</span>
        <span style={{ color }} className="font-semibold">
          {label} &nbsp;{distPct >= 0 ? '+' : ''}{(distPct * 100).toFixed(2)}%
        </span>
      </div>
      <div className="relative h-2.5 bg-terminal-muted rounded-full overflow-hidden">
        <div className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            width: `${danger * 100}%`,
            background: `linear-gradient(90deg, #00d97e, ${color})`,
            boxShadow: danger >= 0.75 ? `0 0 6px ${color}80` : undefined,
          }} />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-red-500/70" />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
        <span className="text-red-400/80">止损 ¥{f2(snap.hard_stop_loss)}</span>
        <span>均价 ¥{f2(snap.avg_cost)}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 日内博弈尺
// ════════════════════════════════════════════════════════════════
function TRuler({ snap }: { snap: DiagnosticSnapshot }) {
  const range = snap.resistance - snap.support
  if (range <= 0) return null
  const be   = tBreakEven(snap.avg_cost)
  const toP  = (p: number) => Math.max(2, Math.min(98, ((p - snap.support) / range) * 100))
  const priceP = toP(snap.price), costP = toP(snap.avg_cost)
  const beP = toP(be), stopP = toP(snap.hard_stop_loss)
  const net = tNet(snap.price, snap.avg_cost)
  const above = snap.price >= be

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-ink-muted flex items-center gap-1 uppercase tracking-wider">
          <Target size={9} /> 日内博弈尺
        </span>
        <span className={`font-semibold ${above ? 'text-accent-green' : 'text-amber-400'}`}>
          {above ? `✓ 卖出即获利 +${(net * 100).toFixed(3)}%` : '未达平衡线'}
        </span>
      </div>
      <div className="relative mt-4 h-5 bg-terminal-muted rounded overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg,rgba(255,77,106,.1),rgba(0,217,126,.08))' }} />
        <Pin pos={stopP} color="#ff4d6a" label="止损" below />
        <Pin pos={costP} color="#7a8fa6" label="成本" below={false} />
        <Pin pos={beP}   color="#f59e0b" label="平衡" below />
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10"
          style={{ left: `${priceP}%` }} />
        <span className="absolute bottom-0.5 left-1.5 text-[8px] font-mono text-red-400/70">支 {f2(snap.support)}</span>
        <span className="absolute bottom-0.5 right-1.5 text-[8px] font-mono text-accent-green/70">压 {f2(snap.resistance)}</span>
      </div>
      {/* 现价浮标 */}
      <div className="relative h-3">
        <span className="absolute text-[9px] font-mono text-white/90 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${priceP}%` }}>
          ¥{f2(snap.price)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
        <Dot color="#f59e0b" label={`平衡 ¥${f2(be)}`} />
        <Dot color="#7a8fa6" label={`成本 ¥${f2(snap.avg_cost)}`} />
        <Dot color="#ff4d6a" label={`止损 ¥${f2(snap.hard_stop_loss)}`} />
      </div>
    </div>
  )
}

function Pin({ pos, color, label, below }: { pos: number; color: string; label: string; below: boolean }) {
  return (
    <div className="absolute top-0 h-full z-10" style={{ left: `${pos}%` }}>
      <div className="w-px h-full opacity-75" style={{ background: color }} />
      <span className={`absolute text-[8px] font-mono whitespace-nowrap -translate-x-1/2 leading-none
        ${below ? 'bottom-0.5' : 'top-0.5'}`} style={{ color }}>{label}</span>
    </div>
  )
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-ink-muted">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
// 行动决策区（卡片右侧）
// ════════════════════════════════════════════════════════════════
function ActionZone({ item, onModal }: {
  item: PositionDiagnosisResult
  onModal: () => void
}) {
  const cfg    = SIGNAL_CFG[item.signal]
  const s      = item.snapshot
  const inLoss = s.pnl_pct < 0
  const net    = tNet(s.price, s.avg_cost)
  const covered = net >= 0.001

  return (
    <div className="flex flex-col gap-2 w-[140px] flex-shrink-0">
      {/* 信号徽章 */}
      <div className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg border
        text-xs font-bold ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}
        ${cfg.glow ? 'animate-pulse' : ''}`}>
        {cfg.icon} <span>{cfg.short}</span>
      </div>

      {/* T+0 空间 */}
      <div className={`rounded-lg border px-2 py-2 text-center ${
        covered ? 'border-accent-green/25 bg-accent-green/5' : 'border-terminal-border bg-terminal-muted/20'
      }`}>
        <p className="text-[9px] font-mono text-ink-muted uppercase tracking-wider">T+0空间</p>
        <p className={`text-xs font-mono font-bold mt-0.5 ${covered ? 'text-accent-green' : 'text-ink-muted'}`}>
          {covered ? `+${(net * 100).toFixed(3)}%` : '未覆盖'}
        </p>
        {covered && <p className="text-[8px] text-accent-green/60 mt-0.5">卖出即获利</p>}
      </div>

      {/* AI 深度分析按钮 */}
      <button onClick={onModal}
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border
          border-accent-cyan/30 bg-accent-cyan/5 text-[11px] font-mono text-accent-cyan
          hover:bg-accent-cyan/15 transition-all">
        <Sparkles size={10} /> AI 分析
      </button>

      {/* 加仓按钮（亏损禁用） */}
      <div className="relative group">
        <button disabled={inLoss}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border
            text-[11px] font-mono transition-all
            ${inLoss
              ? 'border-terminal-border/50 text-ink-muted/30 cursor-not-allowed bg-terminal-muted/10'
              : 'border-accent-green/35 text-accent-green bg-accent-green/10 hover:bg-accent-green/20'
            }`}>
          <Plus size={10} /> 加仓
        </button>
        {inLoss && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            w-36 px-2.5 py-2 rounded-lg bg-terminal-panel border border-red-500/30
            text-[10px] text-red-400 font-mono leading-snug text-center
            opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
            当前处于亏损状态，严禁摊平损失
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 持仓卡片
// ════════════════════════════════════════════════════════════════
function PositionCard({ item, onModal }: {
  item: PositionDiagnosisResult
  onModal: () => void
}) {
  const cfg    = SIGNAL_CFG[item.signal]
  const s      = item.snapshot
  const isStop = item.signal === 'STOP_LOSS'
  const inLoss = s.pnl_pct < 0
  const canDoT = item.signal === 'BUY_T' || item.signal === 'SELL_T'
  const pnlAbs = (s.price - s.avg_cost) * item.position.quantity

  return (
    <div className={`relative rounded-xl border transition-all duration-200 overflow-hidden
      ${isStop ? 'stop-loss-card' : `${cfg.borderCls} ${cfg.bgCls}`}`}>

      {/* STOP_LOSS 顶部呼吸线 */}
      {isStop && (
        <div className="h-0.5 w-full animate-pulse"
          style={{ background: 'linear-gradient(90deg,#ff4d6a,rgba(255,77,106,.4),#ff4d6a)' }} />
      )}

      <div className="p-4 flex gap-4">
        {/* ── 左：基础信息 ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* 头部 */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink-primary font-mono">{item.stock_code}</span>
              <span className="text-xs text-ink-secondary">{item.stock_name}</span>
              {canDoT && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded
                  bg-accent-green/15 border border-accent-green/30 text-accent-green">
                  ✦ 可做T
                </span>
              )}
              {isStop && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded animate-pulse
                  bg-red-500/20 border border-red-500/40 text-red-400">
                  ⚡ 止损警报
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink-muted font-mono">
              <span>持仓 {item.position.quantity} 股</span>
              <span className="opacity-30">·</span>
              <span>可用 {item.position.available_qty} 股</span>
              <span className="opacity-30">·</span>
              <span>均价 ¥{f2(s.avg_cost)}</span>
            </div>
          </div>

          {/* 价格/盈亏/振幅 */}
          <div className="grid grid-cols-3 gap-3">
            <PCell label="现价"     value={`¥${f2(s.price)}`} color="text-ink-primary" />
            <PCell label="累计盈亏" value={fPct(s.pnl_pct)} sub={fYuan(pnlAbs)}
              color={inLoss ? 'text-red-400' : 'text-accent-green'} />
            <PCell label="今日振幅" value={`${(s.amplitude * 100).toFixed(1)}%`}
              color={s.amplitude >= 0.015 ? 'text-amber-400' : 'text-ink-secondary'} />
          </div>

          {/* 风险进度条 */}
          <RiskBar snap={s} />

          {/* 博弈尺 */}
          <TRuler snap={s} />

          {/* 技术摘要 */}
          <div className="flex items-center gap-2.5 text-[10px] font-mono text-ink-muted flex-wrap">
            <span className="flex items-center gap-1">
              <BarChart2 size={9} /> MA20
              <span className={s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400'}>
                {s.ma20_slope >= 0 ? '↑上行' : '↓下行'}
              </span>
            </span>
            <span className="opacity-30">·</span>
            <span>ATR {f2(s.atr)}</span>
            <span className="opacity-30">·</span>
            <span className="text-red-400/70">止损 ¥{f2(s.hard_stop_loss)}</span>
          </div>

          {/* 量化决策依据（紧凑版） */}
          {s.reasons.length > 0 && (
            <div className={`rounded-lg border px-3 py-2 bg-terminal-bg/50 ${cfg.borderCls}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={9} className={cfg.textCls} />
                <span className="text-[9px] font-mono text-ink-muted uppercase tracking-wider">量化依据</span>
              </div>
              <p className="text-xs text-ink-primary leading-relaxed line-clamp-2">
                {s.reasons[0]}
              </p>
              <button onClick={onModal}
                className="mt-1 flex items-center gap-0.5 text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors">
                查看完整分析 <ChevronRight size={9} />
              </button>
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div className="w-px bg-terminal-border flex-shrink-0" />

        {/* ── 右：行动决策区 ── */}
        <ActionZone item={item} onModal={onModal} />
      </div>

      {/* 亏损横幅（非止损状态） */}
      {inLoss && !isStop && (
        <div className="px-4 py-1.5 border-t border-red-500/15 bg-red-500/5 flex items-center gap-2">
          <AlertTriangle size={10} className="text-red-400/60 flex-shrink-0" />
          <p className="text-[10px] font-mono text-red-400/70">
            当前处于亏损状态（{fPct(s.pnl_pct)}），严禁摊平损失，请严守止损纪律。
          </p>
        </div>
      )}
    </div>
  )
}

function PCell({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div>
      <p className="text-[10px] text-ink-muted font-mono uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-[10px] font-mono opacity-70 ${color}`}>{sub}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// AI 深度诊断弹窗
// ════════════════════════════════════════════════════════════════
interface DiagModalProps {
  item: PositionDiagnosisResult
  /** 缓存的 AI 分析结果（若已有则直接展示） */
  cachedAI: PositionAIResult | null
  onClose: () => void
  onAIResult: (result: PositionAIResult) => void
}

function DiagModal({ item, cachedAI, onClose, onAIResult }: DiagModalProps) {
  const navigate   = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const cfg  = SIGNAL_CFG[item.signal]
  const s    = item.snapshot
  const pnlAbs = (s.price - s.avg_cost) * item.position.quantity
  const inLoss = s.pnl_pct < 0

  const [aiResult, setAiResult]   = useState<PositionAIResult | null>(cachedAI)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState('')

  // 如果 cachedAI 更新（父组件传入），同步到本地
  useEffect(() => { setAiResult(cachedAI) }, [cachedAI])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const triggerAI = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await analyzePosition(item.stock_code)
      const result = res.data.data
      setAiResult(result)
      onAIResult(result)   // 回传给父组件缓存
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI 分析失败，请重试')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>

      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col
        bg-terminal-panel border border-terminal-border rounded-2xl shadow-2xl
        overflow-hidden animate-fade-in">

        {/* 顶部信号条 */}
        <div className="h-1 w-full flex-shrink-0" style={{
          background: item.signal === 'STOP_LOSS'
            ? 'linear-gradient(90deg,#ff4d6a,rgba(255,77,106,.4),#ff4d6a)'
            : item.signal === 'BUY_T' ? '#00d97e'
            : item.signal === 'SELL_T' ? '#f59e0b'
            : '#1e2d3d',
        }} />

        {/* 头部 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${cfg.borderCls} ${cfg.bgCls}`}>
              <Shield size={16} className={cfg.textCls} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-ink-primary font-mono">{item.stock_code}</span>
                <span className="text-sm text-ink-secondary">{item.stock_name}</span>
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border
                  ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-ink-muted font-mono mt-0.5">
                均价 ¥{f2(s.avg_cost)} · 现价 ¥{f2(s.price)} ·&nbsp;
                <span className={inLoss ? 'text-red-400' : 'text-accent-green'}>
                  {fPct(s.pnl_pct)} ({fYuan(pnlAbs)})
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); navigate(`/stocks/${item.stock_code}`) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-terminal-border
                text-xs font-mono text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors">
              K线 <ArrowRight size={11} />
            </button>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted
                hover:text-ink-primary hover:bg-terminal-muted transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 6格指标 */}
        <div className="flex-shrink-0 grid grid-cols-6 divide-x divide-terminal-border border-b border-terminal-border">
          {[
            { k: 'ATR(20)', v: f2(s.atr) },
            { k: 'MA20',    v: f2(s.ma20), c: s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400' },
            { k: 'MA趋势',  v: s.ma20_slope >= 0 ? `↑${f3(s.ma20_slope)}` : `↓${f3(Math.abs(s.ma20_slope))}`,
              c: s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400' },
            { k: '硬止损',  v: `¥${f2(s.hard_stop_loss)}`, c: 'text-red-400' },
            { k: '支撑位',  v: `¥${f2(s.support)}` },
            { k: '压力位',  v: `¥${f2(s.resistance)}`, c: 'text-amber-400' },
          ].map(({ k, v, c }) => (
            <div key={k} className="px-3 py-2.5 text-center">
              <p className="text-[9px] text-ink-muted font-mono uppercase tracking-wider">{k}</p>
              <p className={`text-xs font-mono font-semibold mt-0.5 ${c ?? 'text-ink-secondary'}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* 博弈尺 */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-terminal-border">
          <TRuler snap={s} />
        </div>

        {/* 滚动区 */}
        <div className="flex-1 overflow-y-auto">

          {/* 量化决策依据 */}
          {s.reasons.length > 0 && (
            <div className="px-5 pt-4 pb-3 border-b border-terminal-border">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2
                flex items-center gap-1">
                <Target size={9} /> 量化决策依据
              </p>
              <ul className="space-y-1.5">
                {s.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink-secondary">
                    <span className={`font-mono font-bold flex-shrink-0 ${cfg.textCls}`}>{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── AI 深度分析区 ── */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain size={13} className="text-accent-cyan" />
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
                  AI 深度诊断报告
                </p>
                {aiResult && (
                  <span className="text-[9px] font-mono text-ink-muted/50">
                    {new Date(aiResult.generated_at).toLocaleTimeString()} 生成
                  </span>
                )}
              </div>
              {/* 手动触发 AI 按钮 */}
              <button onClick={triggerAI} disabled={aiLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all
                  disabled:opacity-50
                  ${aiResult
                    ? 'border-terminal-border text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/30'
                    : 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'
                  }`}>
                {aiLoading
                  ? <><RefreshCw size={11} className="animate-spin" /> 分析中...</>
                  : <><Sparkles size={11} /> {aiResult ? '重新分析' : '启动 AI 分析'}</>
                }
              </button>
            </div>

            {/* AI 内容区 */}
            {!aiResult && !aiLoading && !aiError && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-terminal-muted border border-terminal-border
                  flex items-center justify-center mb-3">
                  <Brain size={22} className="text-ink-muted" />
                </div>
                <p className="text-xs text-ink-secondary mb-1">尚未生成 AI 分析</p>
                <p className="text-[10px] text-ink-muted max-w-xs leading-relaxed">
                  点击「启动 AI 分析」按钮，调用大模型对该持仓进行深度诊断，
                  生成具体的买卖价位建议。每次分析会消耗一定 token。
                </p>
              </div>
            )}

            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-accent-green"
                    style={{ animation: 'spin 1.5s linear infinite reverse' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain size={16} className="text-accent-cyan" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-ink-secondary">AI 深度分析中...</p>
                  <p className="text-[10px] text-ink-muted mt-1 font-mono">
                    正在解析技术形态 · 计算风险收益比 · 生成操作建议
                  </p>
                </div>
              </div>
            )}

            {aiError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25
                rounded-xl text-red-400 text-xs font-mono">
                <AlertTriangle size={13} /> {aiError}
                <button onClick={triggerAI}
                  className="ml-auto text-red-400/70 hover:text-red-400 transition-colors underline">
                  重试
                </button>
              </div>
            )}

            {aiResult && !aiLoading && (
              <div className="prose-report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {aiResult.action_directive}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* 止损说明 */}
          {item.signal === 'STOP_LOSS' && (
            <div className="mx-5 mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle size={13} className="text-red-400" />
                <span className="text-xs font-bold text-red-400">⚠ 止损操作说明</span>
              </div>
              <p className="text-xs text-red-300/80 leading-relaxed">
                已触发硬止损线（均价 − 2×ATR）。A股 T+1 制度：今日买入的股票明日方可卖出。
                若持仓为今日建仓，请明日开盘第一时间挂单止损，避免损失扩大。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 录入持仓弹窗
// ════════════════════════════════════════════════════════════════
function SyncModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<SyncPositionRequest>({
    stock_code: '', avg_cost: 0, quantity: 0, available_qty: 0,
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const set = (k: keyof SyncPositionRequest, v: string) =>
    setForm(f => ({ ...f, [k]: k === 'stock_code' ? v : parseFloat(v) || 0 }))

  const submit = async () => {
    if (!form.stock_code || !form.avg_cost || !form.quantity) {
      setErr('请填写代码、均价和持仓数量'); return
    }
    setLoading(true); setErr('')
    try {
      await syncPosition(form)
      onSuccess(); onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '同步失败')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="bg-terminal-panel border border-terminal-border rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-accent-green" />
            <h3 className="text-sm font-semibold text-ink-primary">录入持仓</h3>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {([
            { label: '股票代码', key: 'stock_code' as const, type: 'text',   ph: '如 002429', hint: '6位代码' },
            { label: '持仓均价', key: 'avg_cost'   as const, type: 'number', ph: '如 12.50',  hint: '买入均价（元）' },
            { label: '持仓数量', key: 'quantity'   as const, type: 'number', ph: '如 1000',   hint: '总持仓（股）' },
            { label: '今日可用', key: 'available_qty' as const, type: 'number', ph: '如 1000', hint: 'T+1新买填0' },
          ] as const).map(({ label, key, type, ph, hint }) => (
            <div key={key}>
              <label className="block text-[11px] text-ink-muted font-mono mb-1">
                {label} <span className="opacity-50">— {hint}</span>
              </label>
              <input type={type} placeholder={ph} value={form[key] || ''}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg
                  px-3 py-2 text-sm text-ink-primary font-mono
                  placeholder:text-ink-muted/30 focus:outline-none focus:border-accent-green/50 transition-colors" />
            </div>
          ))}
        </div>

        <div className="mt-3 p-2.5 bg-accent-green/5 border border-accent-green/15 rounded-lg">
          <p className="text-[10px] text-accent-green font-mono">万一免五：买入 0.01% + 卖出 0.06%（含印花税）</p>
          <p className="text-[10px] text-ink-muted font-mono mt-0.5">T+0平衡点：单次波幅 ≥ 0.1% 即有净利润空间</p>
        </div>

        {err && (
          <p className="mt-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20
            rounded-lg px-3 py-2 font-mono">{err}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs text-ink-secondary border
              border-terminal-border hover:border-ink-muted transition-colors">
            取消
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2 rounded-lg text-xs font-semibold
              bg-accent-green/10 text-accent-green border border-accent-green/30
              hover:bg-accent-green/20 disabled:opacity-50 transition-colors">
            {loading ? '同步中...' : '确认录入'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 空状态 & 骨架屏
// ════════════════════════════════════════════════════════════════
function EmptyState({ onSync, onDiag }: { onSync: () => void; onDiag: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center mb-4">
        <Shield size={28} className="text-ink-muted" />
      </div>
      <p className="text-ink-secondary text-sm font-medium mb-1">暂无持仓数据</p>
      <p className="text-ink-muted text-xs mb-6 max-w-xs leading-relaxed">
        先录入持仓成本与数量，再点击「立即诊断」获取量化建议。<br />
        AI 深度分析可在卡片中按需手动触发。
      </p>
      <div className="flex items-center gap-3">
        <button onClick={onSync}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-green/10
            border border-accent-green/30 text-accent-green text-xs font-semibold
            hover:bg-accent-green/20 transition-all">
          <Plus size={13} /> 录入持仓
        </button>
        <button onClick={onDiag}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-terminal-border
            text-xs text-ink-secondary hover:text-ink-primary transition-colors">
          <RefreshCw size={13} /> 立即诊断
        </button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[180, 200, 180].map((h, i) => (
        <div key={i} className="rounded-xl border border-terminal-border bg-terminal-muted/25 animate-pulse"
          style={{ height: h }} />
      ))}
      <p className="text-center text-[11px] text-ink-muted font-mono pt-1">
        正在抓取行情 · 计算 ATR/MA20 · 生成量化信号...
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// 主页面
// ════════════════════════════════════════════════════════════════
export default function PortfolioGuardian() {
  const [items, setItems]       = useState<PositionDiagnosisResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [updated, setUpdated]   = useState<Date | null>(null)
  const [sortBy, setSortBy]     = useState<'priority' | 'pnl'>('priority')
  const [showSync, setShowSync] = useState(false)
  const [modalItem, setModalItem] = useState<PositionDiagnosisResult | null>(null)
  const [cd, setCd]             = useState(AUTO_REFRESH_SEC)

  // AI 结果缓存：code → PositionAIResult
  // 存于 ref 中避免每次 setItems 时重置
  const aiCache = useRef<Map<string, PositionAIResult>>(new Map())

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── 纯指标刷新（不调 AI）────────────────────────────────────────
  const diagnose = useCallback(async () => {
    setLoading(true)
    setError('')
    setCd(AUTO_REFRESH_SEC)
    try {
      const res = await fetchPositionDiagnosis()
      setItems(res.data.data?.items ?? [])
      setUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '诊断失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次挂载立即执行，之后每 30s 倒计时刷新
  useEffect(() => {
    diagnose()
    timerRef.current = setInterval(() => {
      setCd(c => {
        if (c <= 1) { diagnose(); return AUTO_REFRESH_SEC }
        return c - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [diagnose])

  const sorted = useMemo(() => [...items].sort((a, b) =>
    sortBy === 'priority'
      ? SIGNAL_CFG[a.signal].priority - SIGNAL_CFG[b.signal].priority
      : a.snapshot.pnl_pct - b.snapshot.pnl_pct
  ), [items, sortBy])

  const stopCount = items.filter(i => i.signal === 'STOP_LOSS').length

  // 弹窗打开时同步最新数据
  const currentModalItem = modalItem
    ? (items.find(i => i.stock_code === modalItem.stock_code) ?? modalItem)
    : null

  return (
    <div className="flex flex-col h-full bg-terminal-bg overflow-hidden">

      {/* ── 顶栏 ── */}
      <header className="flex-shrink-0 px-6 py-3.5 border-b border-terminal-border bg-terminal-panel">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              stopCount > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-terminal-border bg-terminal-muted'
            }`}>
              <Shield size={15} className={stopCount > 0 ? 'text-red-400 animate-pulse' : 'text-accent-green'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-ink-primary">持仓守护</h1>
                {stopCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full
                    bg-red-500/15 border border-red-500/40 text-red-400 animate-pulse">
                    {stopCount} 只止损警报
                  </span>
                )}
              </div>
              <p className="text-[10px] text-ink-muted font-mono">
                万一免五 · ATR硬止损 · 量化自动刷新 · AI分析按需触发
                {updated && <span className="ml-2 opacity-50">· 更新 {updated.toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {items.length > 0 && !loading && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                bg-terminal-muted border border-terminal-border text-[10px] font-mono text-ink-muted">
                <Clock size={10} /> {cd}s 后自动刷新
              </div>
            )}
            <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[10px] font-mono">
              {[{ k: 'priority', l: '按信号' }, { k: 'pnl', l: '按盈亏' }].map(({ k, l }) => (
                <button key={k} onClick={() => setSortBy(k as typeof sortBy)}
                  className={`px-2.5 py-1.5 transition-colors ${
                    sortBy === k ? 'bg-terminal-muted text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
                  }`}>{l}</button>
              ))}
            </div>
            <button onClick={() => setShowSync(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-terminal-border
                text-[11px] font-mono text-ink-secondary hover:text-accent-green
                hover:border-accent-green/40 transition-all">
              <Plus size={12} /> 录入持仓
            </button>
            <button onClick={diagnose} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-accent-green/10 border border-accent-green/30 text-accent-green
                text-[11px] font-semibold font-mono hover:bg-accent-green/20
                disabled:opacity-50 transition-all">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? '刷新中...' : '立即刷新'}
            </button>
          </div>
        </div>
      </header>

      {/* ── 主内容 ── */}
      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25
            rounded-xl text-red-400 text-xs font-mono">
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <EmptyState onSync={() => setShowSync(true)} onDiag={diagnose} />
        )}

        {items.length > 0 && <StatsBar items={items} />}

        {sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map(item => (
              <PositionCard key={item.stock_code} item={item}
                onModal={() => setModalItem(item)} />
            ))}
          </div>
        )}

        {loading && items.length === 0 && <Skeleton />}

        {items.length > 0 && (
          <footer className="p-4 bg-terminal-panel border border-terminal-border rounded-xl
            text-[10px] font-mono text-ink-muted leading-relaxed">
            <span className="text-ink-secondary font-medium">算法说明：</span>
            硬止损 = 均价 − 2×ATR(20)；触发条件：① 跌破20日支撑 ② 净亏损≥8% ③ 低于硬止损位。
            做T前置：振幅≥1.5% 且可用股&gt;0。
            <span className="text-red-400/70 ml-1">亏损持仓加仓禁用，严禁摊平。</span>
            &nbsp;万一免五=0.07%，T+0平衡线=0.1%。&nbsp;
            <span className="text-accent-cyan/70">AI 分析按需在弹窗中手动触发，节省 token。</span>
          </footer>
        )}
      </main>

      {/* 弹窗 */}
      {currentModalItem && (
        <DiagModal
          item={currentModalItem}
          cachedAI={aiCache.current.get(currentModalItem.stock_code) ?? null}
          onClose={() => setModalItem(null)}
          onAIResult={result => {
            aiCache.current.set(result.stock_code, result)
          }}
        />
      )}
      {showSync && (
        <SyncModal onClose={() => setShowSync(false)} onSuccess={diagnose} />
      )}
    </div>
  )
}
