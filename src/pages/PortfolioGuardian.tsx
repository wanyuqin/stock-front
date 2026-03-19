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
  Calendar, MessageSquare,
} from 'lucide-react'
import { fetchPositionDiagnosis, analyzePosition, syncPosition } from '@/api/stock'
import { fetchEventCalendar } from '@/api/risk'
import type {
  PositionDiagnosisResult, PositionAIResult, SignalType,
  DiagnosticSnapshot, SyncPositionRequest,
} from '@/types'
import type { RiskEventItem } from '@/types/risk'

const FEE_BUY  = 0.0001
const FEE_SELL = 0.0006
const AUTO_REFRESH_SEC = 30

// ── 信号配置（文字改成普通人能懂的语言）────────────────────────────

const SIGNAL_CFG: Record<SignalType, {
  label: string; short: string
  textCls: string; bgCls: string; borderCls: string
  icon: React.ReactNode; priority: number; glow: boolean
}> = {
  STOP_LOSS: {
    label: '🛑 今日必须止损', short: 'STOP LOSS',
    textCls: 'text-red-400', bgCls: 'bg-red-500/10', borderCls: 'border-red-500/50',
    icon: <AlertTriangle size={13} />, priority: 0, glow: true,
  },
  SELL_T: {
    label: '📈 可以高抛做T', short: 'SELL T',
    textCls: 'text-amber-400', bgCls: 'bg-amber-500/10', borderCls: 'border-amber-500/40',
    icon: <TrendingDown size={13} />, priority: 1, glow: false,
  },
  BUY_T: {
    label: '📉 可以低吸做T', short: 'BUY T',
    textCls: 'text-accent-green', bgCls: 'bg-accent-green/10', borderCls: 'border-accent-green/40',
    icon: <TrendingUp size={13} />, priority: 2, glow: false,
  },
  SELL: {
    label: '⚠️ 建议减仓观察', short: 'SELL',
    textCls: 'text-orange-400', bgCls: 'bg-orange-500/10', borderCls: 'border-orange-500/30',
    icon: <TrendingDown size={13} />, priority: 3, glow: false,
  },
  HOLD: {
    label: '✅ 继续持有', short: 'HOLD',
    textCls: 'text-sky-400', bgCls: 'bg-sky-500/10', borderCls: 'border-sky-500/25',
    icon: <Activity size={13} />, priority: 4, glow: false,
  },
}

// ── 工具函数 ─────────────────────────────────────────────────────
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

// ── 止损距离颜色 ──────────────────────────────────────────────────
function stopDistColor(pct: number): string {
  if (pct < 2)  return 'text-red-400'
  if (pct < 5)  return 'text-amber-400'
  return 'text-accent-green'
}

function stopDistBg(pct: number): string {
  if (pct < 2)  return 'bg-red-500'
  if (pct < 5)  return 'bg-amber-400'
  return 'bg-accent-green'
}

// ── 一句话行动指令（最重要的展示）────────────────────────────────
function ActionBanner({ snap, signal }: { snap: DiagnosticSnapshot; signal: SignalType }) {
  const summary = snap.action_summary
  if (!summary) return null

  const isUrgent = signal === 'STOP_LOSS'
  const isWarn   = signal === 'SELL' || snap.near_stop_warning
  const isGood   = signal === 'BUY_T' || signal === 'SELL_T'

  const cls = isUrgent
    ? 'bg-red-500/15 border-red-500/40 text-red-300'
    : isWarn
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    : isGood
    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
    : 'bg-sky-500/8 border-sky-500/20 text-sky-300'

  return (
    <div className={`px-4 py-3 rounded-xl border text-sm font-medium leading-snug ${cls} ${isUrgent ? 'animate-pulse' : ''}`}>
      {summary}
    </div>
  )
}

// ── 止损距离进度条 ─────────────────────────────────────────────────
function StopDistBar({ snap }: { snap: DiagnosticSnapshot }) {
  const pct = snap.stop_dist_pct ?? 0
  const danger = Math.min(100, Math.max(0, 100 - pct * 10)) // pct=10%→danger=0, pct=0%→danger=100
  const color = stopDistBg(pct)
  const textColor = stopDistColor(pct)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-ink-muted uppercase tracking-wider">距止损还有</span>
        <span className={`font-semibold ${textColor}`}>
          {snap.near_stop_warning
            ? `⚠ 仅剩 ${pct.toFixed(1)}%，请立刻关注`
            : `${pct.toFixed(1)}%（¥${f2(snap.hard_stop_loss)}）`}
        </span>
      </div>
      <div className="relative h-2.5 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-0 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${danger}%` }}
        />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-red-500/70" />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
        <span className="text-red-400/80">
          止损 ¥{f2(snap.plan_stop_loss ?? snap.hard_stop_loss)}
          {snap.plan_stop_loss ? ' (你设定)' : ' (ATR计算)'}
        </span>
        <span>均价 ¥{f2(snap.avg_cost)}</span>
      </div>
    </div>
  )
}

// ── 目标价进度条 ──────────────────────────────────────────────────
function TargetProgress({ snap }: { snap: DiagnosticSnapshot }) {
  if (!snap.plan_target_price) return null
  const target = snap.plan_target_price
  const cost   = snap.avg_cost
  const price  = snap.price
  const total  = target - cost
  if (total <= 0) return null
  const progress = Math.max(0, Math.min(100, (price - cost) / total * 100))
  const distPct  = snap.target_dist_pct

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="flex items-center gap-1 text-ink-muted uppercase tracking-wider">
          <Target size={9} /> 距目标价
        </span>
        <span className={`font-semibold ${snap.near_target_notice ? 'text-accent-green animate-pulse' : 'text-ink-secondary'}`}>
          {distPct != null
            ? snap.near_target_notice
              ? `🎯 仅剩 ${distPct.toFixed(1)}%，考虑止盈！`
              : `还差 ${distPct.toFixed(1)}%`
            : `目标 ¥${f2(target)}`
          }
        </span>
      </div>
      <div className="relative h-2 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-accent-green/60 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
        <span>成本 ¥{f2(cost)}</span>
        <span className="text-accent-green/70">目标 ¥{f2(target)} (+{(((target - cost) / cost) * 100).toFixed(1)}%)</span>
      </div>
    </div>
  )
}

// ── 日内博弈尺 ────────────────────────────────────────────────────
function TRuler({ snap }: { snap: DiagnosticSnapshot }) {
  const range = snap.resistance - snap.support
  if (range <= 0) return null
  const be   = tBreakEven(snap.avg_cost)
  const toP  = (p: number) => Math.max(2, Math.min(98, ((p - snap.support) / range) * 100))
  const priceP = toP(snap.price), costP = toP(snap.avg_cost)
  const beP = toP(be), stopP = toP(snap.plan_stop_loss ?? snap.hard_stop_loss)
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
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10" style={{ left: `${priceP}%` }} />
        <span className="absolute bottom-0.5 left-1.5 text-[8px] font-mono text-red-400/70">支 {f2(snap.support)}</span>
        <span className="absolute bottom-0.5 right-1.5 text-[8px] font-mono text-accent-green/70">压 {f2(snap.resistance)}</span>
      </div>
      <div className="relative h-3">
        <span className="absolute text-[9px] font-mono text-white/90 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${priceP}%` }}>¥{f2(snap.price)}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
        <Dot color="#f59e0b" label={`平衡 ¥${f2(be)}`} />
        <Dot color="#7a8fa6" label={`成本 ¥${f2(snap.avg_cost)}`} />
        <Dot color="#ff4d6a" label={`止损 ¥${f2(snap.plan_stop_loss ?? snap.hard_stop_loss)}`} />
      </div>
    </div>
  )
}

function Pin({ pos, color, label, below }: { pos: number; color: string; label: string; below: boolean }) {
  return (
    <div className="absolute top-0 h-full z-10" style={{ left: `${pos}%` }}>
      <div className="w-px h-full opacity-75" style={{ background: color }} />
      <span className={`absolute text-[8px] font-mono whitespace-nowrap -translate-x-1/2 leading-none ${below ? 'bottom-0.5' : 'top-0.5'}`}
        style={{ color }}>{label}</span>
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

function EventRiskStrip({ events }: { events: RiskEventItem[] }) {
  if (!events || events.length === 0) return null
  const top = events[0]
  const tone = top.risk_level === 'HIGH'
    ? 'border-red-500/35 bg-red-500/10 text-red-300'
    : top.risk_level === 'MEDIUM'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-sky-500/25 bg-sky-500/10 text-sky-300'
  return (
    <div className={`rounded-lg border px-3 py-2 text-[10px] font-mono ${tone}`}>
      <div className="flex items-center justify-between">
        <span>📅 未来7天事件：{top.date} · {top.event_type === 'DIVIDEND_EX_DATE' ? '除权除息' : '研报催化'}</span>
        <span className="font-bold">{top.risk_level}</span>
      </div>
      <div className="mt-1 opacity-90 line-clamp-1">{top.title}</div>
      <div className="mt-1 opacity-80">建议：{top.action_hint}</div>
    </div>
  )
}

// ── 资产概览 ──────────────────────────────────────────────────────
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
        <path key={i} d={`M${cx},${cy}L${s.x1},${s.y1}A${r},${r} 0 ${s.large} 1 ${s.x2},${s.y2}Z`}
          fill={s.color} opacity={0.88} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.44} fill="#131920" />
    </svg>
  )
}

function StatsBar({ items }: { items: PositionDiagnosisResult[] }) {
  const totalCost = items.reduce((s, i) => s + i.snapshot.avg_cost * i.position.quantity, 0)
  const totalMkt  = items.reduce((s, i) => s + i.snapshot.price   * i.position.quantity, 0)
  const totalPnl  = totalMkt - totalCost
  const pnlPct    = totalCost > 0 ? totalPnl / totalCost : 0
  const stopCount = items.filter(i => i.signal === 'STOP_LOSS').length
  const tCount    = items.filter(i => i.signal === 'BUY_T' || i.signal === 'SELL_T').length

  return (
    <div className="grid grid-cols-5 gap-3">
      <Stat label="总市值" value={`¥${fYuan(totalMkt).replace(/^[+-]/, '')}`}
        sub={`成本 ¥${fYuan(totalCost).replace(/^[+-]/, '')}`} vc="text-ink-primary" />
      <Stat label="持仓浮盈" value={fYuan(totalPnl)} sub={fPct(pnlPct)}
        vc={totalPnl >= 0 ? 'text-accent-green' : 'text-red-400'} />
      <Stat label="止损警报" value={stopCount.toString()}
        sub={stopCount > 0 ? '⚠ 需立即处理' : '✓ 全部安全'}
        vc={stopCount > 0 ? 'text-red-400' : 'text-ink-muted'} pulse={stopCount > 0} />
      <Stat label="做T机会" value={tCount.toString()}
        sub={tCount > 0 ? '可操作' : '暂无'}
        vc={tCount > 0 ? 'text-amber-400' : 'text-ink-muted'} />
      <div className="bg-terminal-panel border border-terminal-border rounded-xl p-4 flex items-center gap-3">
        <MiniPie data={items.map(i => ({ value: i.snapshot.price * i.position.quantity }))} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-ink-muted font-mono uppercase tracking-wider mb-1.5">仓位分布</p>
          {items.slice(0, 3).map((item, idx) => {
            const pct = totalMkt > 0 ? (item.snapshot.price * item.position.quantity) / totalMkt : 0
            return (
              <div key={item.stock_code} className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[idx] }} />
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

// ── 右侧行动区 ────────────────────────────────────────────────────
function ActionZone({ item, onModal }: { item: PositionDiagnosisResult; onModal: () => void }) {
  const cfg    = SIGNAL_CFG[item.signal]
  const s      = item.snapshot
  const inLoss = s.pnl_pct < 0
  const net    = tNet(s.price, s.avg_cost)
  const covered = net >= 0.001

  return (
    <div className="flex flex-col gap-2 w-[148px] flex-shrink-0">
      {/* 信号 */}
      <div className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-bold ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls} ${cfg.glow ? 'animate-pulse' : ''}`}>
        {cfg.icon} <span className="text-[11px] text-center leading-tight">{cfg.short}</span>
      </div>

      {/* T+0 空间 */}
      <div className={`rounded-lg border px-2 py-2 text-center ${covered ? 'border-accent-green/25 bg-accent-green/5' : 'border-terminal-border bg-terminal-muted/20'}`}>
        <p className="text-[9px] font-mono text-ink-muted uppercase tracking-wider">T+0空间</p>
        <p className={`text-xs font-mono font-bold mt-0.5 ${covered ? 'text-accent-green' : 'text-ink-muted'}`}>
          {covered ? `+${(net * 100).toFixed(3)}%` : '未覆盖'}
        </p>
        {covered && <p className="text-[8px] text-accent-green/60 mt-0.5">卖出即获利</p>}
      </div>

      {/* AI 分析 */}
      <button onClick={onModal}
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 text-[11px] font-mono text-accent-cyan hover:bg-accent-cyan/15 transition-all">
        <Sparkles size={10} /> AI 分析
      </button>

      {/* 建议股数 */}
      {s.suggest_qty > 0 && (
        <div className={`rounded-lg border px-2 py-1.5 text-center ${
          item.signal === 'STOP_LOSS'
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-terminal-border bg-terminal-muted/20'
        }`}>
          <p className="text-[9px] font-mono text-ink-muted">建议操作</p>
          <p className={`text-xs font-mono font-bold mt-0.5 ${item.signal === 'STOP_LOSS' ? 'text-red-400' : 'text-amber-400'}`}>
            {s.suggest_qty} 股
          </p>
        </div>
      )}

      {/* 加仓禁用提示 */}
      <div className="relative group">
        <button disabled={inLoss}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
            inLoss
              ? 'border-terminal-border/50 text-ink-muted/30 cursor-not-allowed bg-terminal-muted/10'
              : 'border-accent-green/35 text-accent-green bg-accent-green/10 hover:bg-accent-green/20'
          }`}>
          <Plus size={10} /> 加仓
        </button>
        {inLoss && (
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 px-2.5 py-2 rounded-lg bg-terminal-panel border border-red-500/30 text-[10px] text-red-400 font-mono leading-snug text-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-lg">
            亏损中，严禁摊平损失
          </div>
        )}
      </div>
    </div>
  )
}

// ── 持仓卡片 ──────────────────────────────────────────────────────
function PositionCard({ item, events, onModal }: { item: PositionDiagnosisResult; events: RiskEventItem[]; onModal: () => void }) {
  const cfg    = SIGNAL_CFG[item.signal]
  const s      = item.snapshot
  const isStop = item.signal === 'STOP_LOSS'
  const inLoss = s.pnl_pct < 0
  const canDoT = item.signal === 'BUY_T' || item.signal === 'SELL_T'
  const pnlAbs = (s.price - s.avg_cost) * item.position.quantity

  // 有效止损（计划止损优先）
  const effectiveStop = s.plan_stop_loss ?? s.hard_stop_loss

  // 持仓天数
  const holdDays = s.hold_days
  const holdDaysStr = holdDays >= 0 ? `${holdDays} 天` : '未知'

  // 有效买入理由
  const buyReasonStr = s.plan_buy_reason || s.buy_reason || ''

  return (
    <div className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${isStop ? 'stop-loss-card' : `${cfg.borderCls} ${cfg.bgCls}`}`}>
      {isStop && <div className="h-0.5 w-full animate-pulse" style={{ background: 'linear-gradient(90deg,#ff4d6a,rgba(255,77,106,.4),#ff4d6a)' }} />}

      <div className="p-4 flex gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* ── 头部：股票信息 + 持仓天数 + 买入理由 ── */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink-primary font-mono">{item.stock_code}</span>
              <span className="text-xs text-ink-secondary">{item.stock_name}</span>
              {canDoT && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-accent-green/15 border border-accent-green/30 text-accent-green">✦ 可做T</span>
              )}
              {isStop && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded animate-pulse bg-red-500/20 border border-red-500/40 text-red-400">⚡ 止损警报</span>
              )}
              {/* 接近目标价标记 */}
              {s.near_target_notice && (
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-accent-green/20 border border-accent-green/40 text-accent-green animate-pulse">🎯 近目标价</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ink-muted font-mono flex-wrap">
              <span>持仓 {item.position.quantity} 股</span>
              <span className="opacity-30">·</span>
              <span>可用 {item.position.available_qty} 股</span>
              <span className="opacity-30">·</span>
              <span>均价 ¥{f2(s.avg_cost)}</span>
              {holdDays >= 0 && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="flex items-center gap-0.5">
                    <Calendar size={9} /> 持仓 {holdDaysStr}
                  </span>
                </>
              )}
            </div>
            {/* 买入理由 */}
            {buyReasonStr && (
              <div className="flex items-start gap-1.5 mt-1.5 text-[10px] font-mono text-ink-muted">
                <MessageSquare size={9} className="mt-0.5 flex-shrink-0" />
                <span className="line-clamp-1">当初买入：{buyReasonStr}</span>
              </div>
            )}
          </div>

          {/* ── 一句话行动指令（最显眼的位置）── */}
          <ActionBanner snap={s} signal={item.signal} />

          {/* ── 事件风险预警（未来7天）── */}
          <EventRiskStrip events={events} />

          {/* ── 价格/盈亏 ── */}
          <div className="grid grid-cols-3 gap-3">
            <PCell label="现价"     value={`¥${f2(s.price)}`} color="text-ink-primary" />
            <PCell label="累计盈亏" value={fPct(s.pnl_pct)} sub={fYuan(pnlAbs)}
              color={inLoss ? 'text-red-400' : 'text-accent-green'} />
            <PCell label="今日振幅" value={`${(s.amplitude * 100).toFixed(1)}%`}
              color={s.amplitude >= 0.015 ? 'text-amber-400' : 'text-ink-secondary'} />
          </div>

          {/* ── 止损距离进度条 ── */}
          <StopDistBar snap={s} />

          {/* ── 目标价进度条（有关联计划时显示）── */}
          <TargetProgress snap={s} />

          {/* ── 日内博弈尺 ── */}
          <TRuler snap={s} />

          {/* ── 技术摘要 ── */}
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
            <span className={`${s.plan_stop_loss ? 'text-accent-blue/70' : 'text-red-400/70'}`}>
              止损 ¥{f2(effectiveStop)}
              {s.plan_stop_loss ? ' (计划)' : ''}
            </span>
          </div>

          {/* ── 量化决策依据 ── */}
          {s.reasons && s.reasons.length > 0 && (
            <div className={`rounded-lg border px-3 py-2 bg-terminal-bg/50 ${cfg.borderCls}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={9} className={cfg.textCls} />
                <span className="text-[9px] font-mono text-ink-muted uppercase tracking-wider">量化依据</span>
              </div>
              <p className="text-xs text-ink-primary leading-relaxed line-clamp-2">{s.reasons[0]}</p>
              <button onClick={onModal}
                className="mt-1 flex items-center gap-0.5 text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors">
                查看完整分析 <ChevronRight size={9} />
              </button>
            </div>
          )}
        </div>

        <div className="w-px bg-terminal-border flex-shrink-0" />
        <ActionZone item={item} onModal={onModal} />
      </div>

      {/* 亏损横幅 */}
      {inLoss && !isStop && (
        <div className="px-4 py-1.5 border-t border-red-500/15 bg-red-500/5 flex items-center gap-2">
          <AlertTriangle size={10} className="text-red-400/60 flex-shrink-0" />
          <p className="text-[10px] font-mono text-red-400/70">
            当前亏损（{fPct(s.pnl_pct)}），严禁摊平损失，请严守止损纪律。
          </p>
        </div>
      )}
    </div>
  )
}

function PCell({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div>
      <p className="text-[10px] text-ink-muted font-mono uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
      {sub && <p className={`text-[10px] font-mono opacity-70 ${color}`}>{sub}</p>}
    </div>
  )
}

// ── AI 深度诊断弹窗 ───────────────────────────────────────────────
function DiagModal({ item, cachedAI, onClose, onAIResult }: {
  item: PositionDiagnosisResult
  cachedAI: PositionAIResult | null
  onClose: () => void
  onAIResult: (r: PositionAIResult) => void
}) {
  const navigate   = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const cfg  = SIGNAL_CFG[item.signal]
  const s    = item.snapshot
  const pnlAbs = (s.price - s.avg_cost) * item.position.quantity
  const inLoss = s.pnl_pct < 0
  const effectiveStop = s.plan_stop_loss ?? s.hard_stop_loss

  const [aiResult, setAiResult]   = useState<PositionAIResult | null>(cachedAI)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState('')

  useEffect(() => { setAiResult(cachedAI) }, [cachedAI])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const triggerAI = async () => {
    setAiLoading(true); setAiError('')
    try {
      const res = await analyzePosition(item.stock_code)
      const result = res.data.data
      setAiResult(result)
      onAIResult(result)
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
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-terminal-panel border border-terminal-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="h-1 w-full flex-shrink-0" style={{
          background: item.signal === 'STOP_LOSS' ? 'linear-gradient(90deg,#ff4d6a,rgba(255,77,106,.4),#ff4d6a)'
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
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-ink-muted font-mono mt-0.5">
                均价 ¥{f2(s.avg_cost)} · 现价 ¥{f2(s.price)} ·&nbsp;
                <span className={inLoss ? 'text-red-400' : 'text-accent-green'}>
                  {fPct(s.pnl_pct)} ({fYuan(pnlAbs)})
                </span>
                {s.hold_days >= 0 && <span className="ml-2 opacity-60">· 持仓 {s.hold_days} 天</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); navigate(`/stocks/${item.stock_code}`) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-terminal-border text-xs font-mono text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors">
              K线 <ArrowRight size={11} />
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-terminal-muted transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 6格技术指标 */}
        <div className="flex-shrink-0 grid grid-cols-6 divide-x divide-terminal-border border-b border-terminal-border">
          {[
            { k: 'ATR(20)', v: f2(s.atr) },
            { k: 'MA20',    v: f2(s.ma20), c: s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400' },
            { k: 'MA趋势',  v: s.ma20_slope >= 0 ? `↑${f3(s.ma20_slope)}` : `↓${f3(Math.abs(s.ma20_slope))}`, c: s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400' },
            { k: s.plan_stop_loss ? '计划止损' : '硬止损', v: `¥${f2(effectiveStop)}`, c: 'text-red-400' },
            { k: '支撑位',  v: `¥${f2(s.support)}` },
            { k: '目标价',  v: s.plan_target_price ? `¥${f2(s.plan_target_price)}` : '未设定', c: s.plan_target_price ? 'text-accent-green' : 'text-ink-muted' },
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
          {/* 一句话行动指令 */}
          {s.action_summary && (
            <div className="px-5 pt-4 pb-3 border-b border-terminal-border">
              <ActionBanner snap={s} signal={item.signal} />
            </div>
          )}

          {/* 量化依据 */}
          {s.reasons && s.reasons.length > 0 && (
            <div className="px-5 pt-4 pb-3 border-b border-terminal-border">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1">
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

          {/* AI 分析区 */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain size={13} className="text-accent-cyan" />
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">AI 深度诊断报告</p>
                {aiResult && <span className="text-[9px] font-mono text-ink-muted/50">{new Date(aiResult.generated_at).toLocaleTimeString()} 生成</span>}
              </div>
              <button onClick={triggerAI} disabled={aiLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all disabled:opacity-50 ${aiResult ? 'border-terminal-border text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/30' : 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'}`}>
                {aiLoading ? <><RefreshCw size={11} className="animate-spin" /> 分析中...</> : <><Sparkles size={11} /> {aiResult ? '重新分析' : '启动 AI 分析'}</>}
              </button>
            </div>

            {!aiResult && !aiLoading && !aiError && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center mb-3">
                  <Brain size={22} className="text-ink-muted" />
                </div>
                <p className="text-xs text-ink-secondary mb-1">尚未生成 AI 分析</p>
                <p className="text-[10px] text-ink-muted max-w-xs leading-relaxed">点击「启动 AI 分析」，AI 会根据你的买入理由、持仓天数、当前技术面，给出具体的操作建议。</p>
              </div>
            )}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-accent-green" style={{ animation: 'spin 1.5s linear infinite reverse' }} />
                  <div className="absolute inset-0 flex items-center justify-center"><Brain size={16} className="text-accent-cyan" /></div>
                </div>
                <p className="text-sm text-ink-secondary">AI 深度分析中...</p>
              </div>
            )}
            {aiError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-mono">
                <AlertTriangle size={13} /> {aiError}
                <button onClick={triggerAI} className="ml-auto text-red-400/70 hover:text-red-400 underline">重试</button>
              </div>
            )}
            {aiResult && !aiLoading && (
              <div className="prose-report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult.action_directive}</ReactMarkdown>
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
                已触发止损线。A股 T+1 制度：今日买入的股票明日方可卖出。
                若持仓为今日建仓，请明日开盘第一时间挂单止损，避免损失扩大。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 录入持仓弹窗（新增买入时间和买入理由）────────────────────────
function SyncModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<SyncPositionRequest & { bought_at: string; buy_reason: string }>({
    stock_code: '', avg_cost: 0, quantity: 0, available_qty: 0,
    bought_at: new Date().toISOString().slice(0, 10),
    buy_reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const set = (k: string, v: string) =>
    setForm(f => ({ ...f, [k]: ['avg_cost', 'quantity', 'available_qty'].includes(k) ? parseFloat(v) || 0 : v }))

  const submit = async () => {
    if (!form.stock_code || !form.avg_cost || !form.quantity) { setErr('请填写代码、均价和持仓数量'); return }
    setLoading(true); setErr('')
    try {
      await syncPosition({ ...form } as SyncPositionRequest)
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
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          {([
            { label: '股票代码',   key: 'stock_code',    type: 'text',   ph: '如 002429',  hint: '6位代码' },
            { label: '持仓均价',   key: 'avg_cost',      type: 'number', ph: '如 12.50',   hint: '买入均价（元）' },
            { label: '持仓数量',   key: 'quantity',      type: 'number', ph: '如 1000',    hint: '总持仓（股）' },
            { label: '今日可用',   key: 'available_qty', type: 'number', ph: '如 1000',    hint: 'T+1新买填0' },
            { label: '买入日期',   key: 'bought_at',     type: 'date',   ph: '',           hint: '用于计算持仓天数' },
            { label: '买入理由',   key: 'buy_reason',    type: 'text',   ph: '如：回踩均线支撑…', hint: '填写后系统可自动检查逻辑' },
          ] as const).map(({ label, key, type, ph, hint }) => (
            <div key={key}>
              <label className="block text-[11px] text-ink-muted font-mono mb-1">
                {label} <span className="opacity-50">— {hint}</span>
              </label>
              <input type={type} placeholder={ph} value={(form as Record<string, unknown>)[key] as string || ''}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm text-ink-primary font-mono placeholder:text-ink-muted/30 focus:outline-none focus:border-accent-green/50 transition-colors" />
            </div>
          ))}
        </div>

        <div className="mt-3 p-2.5 bg-accent-green/5 border border-accent-green/15 rounded-lg">
          <p className="text-[10px] text-accent-green font-mono">填写买入理由后，系统会自动检查当前技术面是否还符合买入逻辑</p>
        </div>

        {err && <p className="mt-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs text-ink-secondary border border-terminal-border hover:border-ink-muted transition-colors">取消</button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 disabled:opacity-50 transition-colors">
            {loading ? '同步中...' : '确认录入'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 空状态 & 骨架 ─────────────────────────────────────────────────
function EmptyState({ onSync, onDiag }: { onSync: () => void; onDiag: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center mb-4">
        <Shield size={28} className="text-ink-muted" />
      </div>
      <p className="text-ink-secondary text-sm font-medium mb-1">暂无持仓数据</p>
      <p className="text-ink-muted text-xs mb-6 max-w-xs leading-relaxed">
        录入持仓成本、买入日期和买入理由，系统会自动判断今天该怎么操作。
      </p>
      <div className="flex items-center gap-3">
        <button onClick={onSync} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold hover:bg-accent-green/20 transition-all">
          <Plus size={13} /> 录入持仓
        </button>
        <button onClick={onDiag} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-terminal-border text-xs text-ink-secondary hover:text-ink-primary transition-colors">
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
        <div key={i} className="rounded-xl border border-terminal-border bg-terminal-muted/25 animate-pulse" style={{ height: h }} />
      ))}
      <p className="text-center text-[11px] text-ink-muted font-mono pt-1">
        正在抓取行情 · 计算止损距离 · 生成行动建议...
      </p>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function PortfolioGuardian() {
  const [items, setItems]       = useState<PositionDiagnosisResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [updated, setUpdated]   = useState<Date | null>(null)
  const [sortBy, setSortBy]     = useState<'priority' | 'pnl'>('priority')
  const [showSync, setShowSync] = useState(false)
  const [modalItem, setModalItem] = useState<PositionDiagnosisResult | null>(null)
  const [cd, setCd]             = useState(AUTO_REFRESH_SEC)
  const [eventMap, setEventMap] = useState<Record<string, RiskEventItem[]>>({})
  const aiCache = useRef<Map<string, PositionAIResult>>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const diagnose = useCallback(async () => {
    setLoading(true); setError(''); setCd(AUTO_REFRESH_SEC)
    try {
      const [diagRes, eventRes] = await Promise.all([
        fetchPositionDiagnosis(),
        fetchEventCalendar(7),
      ])
      const list = diagRes.data.data?.items ?? []
      setItems(list)
      const events = eventRes.data.data?.items ?? []
      const grouped: Record<string, RiskEventItem[]> = {}
      for (const ev of events) {
        if (!grouped[ev.stock_code]) grouped[ev.stock_code] = []
        grouped[ev.stock_code].push(ev)
      }
      setEventMap(grouped)
      setUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '诊断失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

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
  const currentModalItem = modalItem
    ? (items.find(i => i.stock_code === modalItem.stock_code) ?? modalItem)
    : null

  return (
    <div className="flex flex-col h-full bg-terminal-bg overflow-hidden">
      <header className="flex-shrink-0 px-6 py-3.5 border-b border-terminal-border bg-terminal-panel">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${stopCount > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-terminal-border bg-terminal-muted'}`}>
              <Shield size={15} className={stopCount > 0 ? 'text-red-400 animate-pulse' : 'text-accent-green'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-ink-primary">持仓守护</h1>
                {stopCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-red-500/15 border border-red-500/40 text-red-400 animate-pulse">
                    {stopCount} 只止损警报
                  </span>
                )}
              </div>
              <p className="text-[10px] text-ink-muted font-mono">
                每30秒自动刷新 · 止损位优先使用你设定的计划止损
                {updated && <span className="ml-2 opacity-50">· 更新 {updated.toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {items.length > 0 && !loading && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-terminal-muted border border-terminal-border text-[10px] font-mono text-ink-muted">
                <Clock size={10} /> {cd}s 后自动刷新
              </div>
            )}
            <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[10px] font-mono">
              {[{ k: 'priority', l: '按信号' }, { k: 'pnl', l: '按盈亏' }].map(({ k, l }) => (
                <button key={k} onClick={() => setSortBy(k as typeof sortBy)}
                  className={`px-2.5 py-1.5 transition-colors ${sortBy === k ? 'bg-terminal-muted text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>{l}</button>
              ))}
            </div>
            <button onClick={() => setShowSync(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-terminal-border text-[11px] font-mono text-ink-secondary hover:text-accent-green hover:border-accent-green/40 transition-all">
              <Plus size={12} /> 录入持仓
            </button>
            <button onClick={diagnose} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-[11px] font-semibold font-mono hover:bg-accent-green/20 disabled:opacity-50 transition-all">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? '刷新中...' : '立即刷新'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-mono">
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {!loading && items.length === 0 && !error && <EmptyState onSync={() => setShowSync(true)} onDiag={diagnose} />}
        {items.length > 0 && <StatsBar items={items} />}
        {sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map(item => (
              <PositionCard key={item.stock_code} item={item} events={eventMap[item.stock_code] ?? []} onModal={() => setModalItem(item)} />
            ))}
          </div>
        )}
        {loading && items.length === 0 && <Skeleton />}

        {items.length > 0 && (
          <footer className="p-4 bg-terminal-panel border border-terminal-border rounded-xl text-[10px] font-mono text-ink-muted leading-relaxed">
            <span className="text-ink-secondary font-medium">算法说明：</span>
            止损位优先使用买入计划中你设定的价格，否则使用 ATR 公式（均价 − 2×ATR）。
            做T：振幅≥1.5% 且可用股&gt;0。亏损持仓禁止加仓。
            <span className="text-accent-cyan/70 ml-1">AI 分析按需触发，节省 token。</span>
          </footer>
        )}
      </main>

      {currentModalItem && (
        <DiagModal
          item={currentModalItem}
          cachedAI={aiCache.current.get(currentModalItem.stock_code) ?? null}
          onClose={() => setModalItem(null)}
          onAIResult={result => { aiCache.current.set(result.stock_code, result) }}
        />
      )}
      {showSync && <SyncModal onClose={() => setShowSync(false)} onSuccess={diagnose} />}
    </div>
  )
}
