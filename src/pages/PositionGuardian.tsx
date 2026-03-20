import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, RefreshCw, Plus, TrendingDown, TrendingUp,
  ArrowRight, AlertTriangle, Activity, ChevronDown, ChevronUp, X,
  Zap,
} from 'lucide-react'
import { fetchPositionDiagnosis, syncPosition } from '@/api/stock'
import type { PositionDiagnosisResult, DiagnosticSnapshot, SignalType, SyncPositionRequest } from '@/types'

// ── 信号配置表 ────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalType, {
  label: string
  color: string
  bg: string
  border: string
  icon: React.ReactNode
  priority: number
}> = {
  STOP_LOSS: {
    label: '⚡ 立即止损',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    icon: <AlertTriangle size={14} />,
    priority: 0,
  },
  SELL_T: {
    label: '📤 高抛做T',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: <TrendingDown size={14} />,
    priority: 1,
  },
  BUY_T: {
    label: '📥 低吸做T',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    icon: <TrendingUp size={14} />,
    priority: 2,
  },
  SELL: {
    label: '🔻 减仓观望',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: <TrendingDown size={14} />,
    priority: 3,
  },
  HOLD: {
    label: '⏸ 持有等待',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    icon: <Activity size={14} />,
    priority: 4,
  },
}

const fmt2 = (n: number) => n.toFixed(2)
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
const fmtAmp = (n: number) => `${(n * 100).toFixed(1)}%`

function getHealthScore(item: PositionDiagnosisResult): number {
  if (Number.isFinite(item.health_score)) {
    return Math.max(0, Math.min(100, item.health_score))
  }
  switch (item.signal) {
    case 'STOP_LOSS': return 20
    case 'SELL': return 40
    case 'SELL_T': return 55
    case 'BUY_T': return 68
    default: return 76
  }
}

function getHealthLevel(item: PositionDiagnosisResult): 'GOOD' | 'WARN' | 'DANGER' {
  if (item.health_level === 'GOOD' || item.health_level === 'WARN' || item.health_level === 'DANGER') {
    return item.health_level
  }
  const score = getHealthScore(item)
  if (score < 45) return 'DANGER'
  if (score < 70) return 'WARN'
  return 'GOOD'
}

function healthTone(level: 'GOOD' | 'WARN' | 'DANGER') {
  if (level === 'DANGER') return 'text-red-300 bg-red-500/15 border-red-500/35'
  if (level === 'WARN') return 'text-amber-300 bg-amber-500/12 border-amber-500/35'
  return 'text-accent-green bg-accent-green/12 border-accent-green/35'
}

type HealthFactor = { label: string; delta: number; note: string }

function healthFactors(item: PositionDiagnosisResult): HealthFactor[] {
  const s = item.snapshot
  const factors: HealthFactor[] = [{ label: '基础分', delta: 80, note: '默认起始分' }]
  switch (item.signal) {
    case 'STOP_LOSS': factors.push({ label: '信号修正', delta: -50, note: '已触发止损' }); break
    case 'SELL':      factors.push({ label: '信号修正', delta: -30, note: '减仓观望' }); break
    case 'SELL_T':    factors.push({ label: '信号修正', delta: -20, note: '高抛做T' }); break
    case 'BUY_T':     factors.push({ label: '信号修正', delta: 5,   note: '低吸做T' }); break
    default:          factors.push({ label: '信号修正', delta: 8,   note: '持有等待' }); break
  }
  if (s.near_stop_warning) factors.push({ label: '止损临近', delta: -20, note: '距离止损位过近' })
  if (s.stop_dist_pct < 2) factors.push({ label: '止损缓冲', delta: -15, note: '缓冲空间 < 2%' })
  else if (s.stop_dist_pct >= 8) factors.push({ label: '止损缓冲', delta: 6, note: '缓冲空间较大' })
  if (s.rel_strength_diff < -5) factors.push({ label: '板块强度', delta: -10, note: '明显弱于板块' })
  else if (s.rel_strength_diff > 0) factors.push({ label: '板块强度', delta: 4, note: '强于板块' })
  if (s.near_target_notice) factors.push({ label: '接近目标价', delta: -4, note: '接近止盈区，波动风险增大' })
  return factors
}

function PnlBadge({ pnl }: { pnl: number }) {
  const isPos = pnl >= 0
  return (
    <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
      isPos ? 'text-accent-green bg-accent-green/10' : 'text-red-400 bg-red-500/10'
    }`}>
      {fmtPct(pnl)}
    </span>
  )
}

function SectorCorrelationRow({ s }: { s: DiagnosticSnapshot }) {
  if (!s.sector_name) return null
  const stock5d = s.sector_5d_change + s.rel_strength_diff
  const diff = s.rel_strength_diff
  const isCritical = diff < -5
  const isWarning  = diff < -2 && !isCritical
  const isStrong   = diff >= 0
  const sign = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
  const statusLabel = isCritical ? '⚠️ 严重偏离' : isWarning ? '轻度落后' : isStrong ? '强势领先' : '基本同步'
  const statusCls   = isCritical ? 'text-red-400 bg-red-500/15' : isWarning ? 'text-amber-400 bg-amber-500/10' : isStrong ? 'text-accent-green bg-accent-green/10' : 'text-sky-400 bg-sky-500/10'
  const wrapCls = isCritical ? 'bg-red-500/10 border-red-500/40' : isWarning ? 'bg-amber-500/8 border-amber-500/30' : 'bg-terminal-bg/40 border-terminal-border/50'
  return (
    <div className={`rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 ${wrapCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">📊 板块相关性</span>
        <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${statusCls}`}>{statusLabel}</span>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
        <span className="text-ink-secondary font-medium">{s.sector_name}</span>
        <span className="text-ink-muted">个股5日 <span className={stock5d >= 0 ? 'text-accent-green' : 'text-red-400'}>{sign(stock5d)}</span></span>
        <span className="text-ink-muted">板块 <span className={s.sector_5d_change >= 0 ? 'text-accent-green' : 'text-red-400'}>{sign(s.sector_5d_change)}</span></span>
        <span className="text-ink-muted">强度差 <span className={`font-semibold ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : isStrong ? 'text-accent-green' : 'text-sky-400'}`}>{sign(diff)}</span></span>
      </div>
      {isCritical && s.sector_warning && <p className="text-xs text-red-400 font-semibold leading-snug border-t border-red-500/20 pt-1.5">{s.sector_warning}</p>}
    </div>
  )
}

// ── 单卡片 ────────────────────────────────────────────────────────

function DiagnosisCard({ item, onViewDetail, onExecuteTrade }: {
  item: PositionDiagnosisResult
  onViewDetail: (code: string) => void
  onExecuteTrade: (code: string, signal: SignalType, qty: number, price: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg    = SIGNAL_CONFIG[item.signal]
  const s      = item.snapshot
  const score  = getHealthScore(item)
  const healthCls = healthTone(getHealthLevel(item))

  // 止损/减仓操作 — 建议卖出数量
  const isLoss   = item.snapshot.pnl_pct < 0
  const needsAct = item.signal === 'STOP_LOSS' || item.signal === 'SELL' || item.signal === 'SELL_T'

  // 止损时建议全出，减仓时建议1/3
  const suggestQty = item.signal === 'STOP_LOSS'
    ? item.position.quantity
    : item.snapshot.suggest_qty > 0 ? item.snapshot.suggest_qty : Math.max(Math.floor(item.position.quantity / 3 / 100) * 100, 100)

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3 transition-all duration-200`}>

      {/* ── 顶部：代码 + 信号 + 健康分 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => onViewDetail(item.stock_code)}
            className="text-base font-bold text-ink-primary hover:text-accent-green transition-colors font-mono">
            {item.stock_code}
          </button>
          <span className="text-sm text-ink-secondary truncate">{item.stock_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${healthCls}`}>
            健康分 {score}
          </span>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>
        </div>
      </div>

      {/* ── 核心指标行 ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '现价', value: `¥${fmt2(s.price)}` },
          { label: '成本', value: `¥${fmt2(s.avg_cost)}` },
          { label: '盈亏', value: <PnlBadge pnl={s.pnl_pct} /> },
          { label: '振幅', value: fmtAmp(s.amplitude) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">{label}</span>
            <span className="text-sm font-mono text-ink-primary">{value}</span>
          </div>
        ))}
      </div>

      {/* ── AI 行动指令 ── */}
      <div className={`rounded-lg border ${cfg.border} bg-terminal-bg/60 px-3 py-2.5`}>
        <p className="text-xs text-ink-muted mb-1 font-mono uppercase tracking-wider">⚡ 行动指令</p>
        <p className="text-sm text-ink-primary leading-relaxed">{item.action_directive}</p>
      </div>

      {/* ── 止损/减仓执行按钮（核心新功能）── */}
      {needsAct && item.position.available_qty > 0 && (
        <button
          onClick={() => onExecuteTrade(item.stock_code, item.signal, suggestQty, s.price)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-150 ${
            item.signal === 'STOP_LOSS'
              ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 hover:border-red-400/60 active:scale-[0.98]'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400/50 active:scale-[0.98]'
          }`}
        >
          <Zap size={14} className={item.signal === 'STOP_LOSS' ? 'animate-pulse' : ''} />
          {item.signal === 'STOP_LOSS'
            ? `立即止损 · 卖出全部 ${item.position.quantity} 股`
            : `执行减仓 · 卖出 ${suggestQty} 股（约 1/3）`
          }
        </button>
      )}

      {/* 亏损持仓无可用股（T+1锁定）提示 */}
      {needsAct && item.position.available_qty === 0 && item.position.quantity > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-terminal-muted/60 border border-terminal-border text-xs font-mono text-ink-muted">
          <AlertTriangle size={11} />
          今日为T+1锁定股，明日开盘后执行止损
        </div>
      )}

      {/* ── 展开技术面 ── */}
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors">
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? '收起技术面数据' : '展开技术面数据'}
      </button>

      {/* ── 板块相关性行 ── */}
      <SectorCorrelationRow s={s} />

      {/* ── MA20 压力位 ── */}
      {s.ma20_pressure_tip && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-terminal-bg/40 border border-terminal-border/50">
          <span className="text-[11px] text-ink-muted font-mono uppercase tracking-wider flex-shrink-0 mt-0.5">📐 压力位</span>
          <span className="text-xs text-ink-secondary leading-relaxed">{s.ma20_pressure_tip}</span>
        </div>
      )}

      {expanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 border-t border-terminal-border">
          {[
            ['MA20', fmt2(s.ma20)],
            ['MA20斜率', s.ma20_slope >= 0 ? `+${s.ma20_slope.toFixed(4)}↑` : `${s.ma20_slope.toFixed(4)}↓`],
            ['ATR(20)', fmt2(s.atr)],
            ['硬止损', `¥${fmt2(s.hard_stop_loss)}`],
            ['支撑位', `¥${fmt2(s.support)}`],
            ['压力位', `¥${fmt2(s.resistance)}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-[11px] text-ink-muted font-mono">{k}</span>
              <span className={`text-xs font-mono ${k === 'MA20斜率' ? (s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400') : 'text-ink-secondary'}`}>{v}</span>
            </div>
          ))}
          <div className="col-span-2">
            <p className="text-[11px] text-ink-muted font-mono mb-1">决策依据</p>
            <ul className="space-y-0.5">
              {s.reasons.map((r, i) => (
                <li key={i} className="text-xs text-ink-secondary flex gap-1.5">
                  <span className="text-ink-muted flex-shrink-0">{i + 1}.</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className={`col-span-2 rounded-lg border px-3 py-2 ${healthCls}`}>
            <p className="text-[11px] font-mono mb-1">健康分拆解</p>
            <div className="space-y-1">
              {healthFactors(item).map((f, idx) => (
                <div key={`${f.label}-${idx}`} className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-ink-secondary">{f.label} · {f.note}</span>
                  <span className={f.delta >= 0 ? 'text-accent-green font-semibold' : 'text-red-300 font-semibold'}>
                    {f.delta >= 0 ? `+${f.delta}` : f.delta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 底部操作 ── */}
      <div className="flex items-center justify-between pt-1 border-t border-terminal-border/50">
        <div className="flex items-center gap-3 text-[11px] text-ink-muted font-mono">
          <span>持仓 {item.position.quantity}股</span>
          <span className="text-terminal-border">|</span>
          <span>可用 {item.position.available_qty}股</span>
          {item.snapshot.can_do_t && !isLoss && (
            <span className="text-accent-green ml-1 font-semibold">✓ 可做T</span>
          )}
          {isLoss && (
            <span className="text-red-400/70 ml-1 text-[10px]">亏损中 · 禁止加仓</span>
          )}
        </div>
        <button onClick={() => onViewDetail(item.stock_code)}
          className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent-green transition-colors">
          查看K线 <ArrowRight size={11} />
        </button>
      </div>
    </div>
  )
}

// ── 录入持仓弹窗 ──────────────────────────────────────────────────

function SyncModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<SyncPositionRequest>({ stock_code: '', avg_cost: 0, quantity: 0, available_qty: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.stock_code || !form.avg_cost || !form.quantity) { setError('请填写完整的代码、成本和数量'); return }
    setLoading(true); setError('')
    try {
      await syncPosition(form)
      onSuccess(); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '同步失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-terminal-panel border border-terminal-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-ink-primary">录入持仓</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {[
            { label: '股票代码', key: 'stock_code', type: 'text', placeholder: '如 002429', hint: '6位纯数字代码' },
            { label: '持仓均价（元）', key: 'avg_cost', type: 'number', placeholder: '如 12.50', hint: '实际买入均价' },
            { label: '总持仓（股）', key: 'quantity', type: 'number', placeholder: '如 1000', hint: '持仓总数量' },
            { label: '今日可用（股）', key: 'available_qty', type: 'number', placeholder: '如 1000', hint: '可卖出数量，T+1购入填0' },
          ].map(({ label, key, type, placeholder, hint }) => (
            <div key={key}>
              <label className="block text-xs text-ink-muted font-mono mb-1">{label} <span className="text-ink-muted/60">— {hint}</span></label>
              <input type={type} placeholder={placeholder}
                value={form[key as keyof SyncPositionRequest] || ''}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm text-ink-primary font-mono placeholder:text-ink-muted/40 focus:outline-none focus:border-accent-green/60 transition-colors" />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-accent-green/5 border border-accent-green/20 rounded-lg">
          <p className="text-xs text-accent-green font-mono">💡 万一免五费率：买入 0.01% + 卖出 0.06%（含印花税）</p>
        </div>
        {error && <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-ink-secondary border border-terminal-border hover:border-ink-muted transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 disabled:opacity-50 transition-colors">
            {loading ? '同步中...' : '确认录入'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 统计摘要栏 ────────────────────────────────────────────────────

function SummaryBar({ items }: { items: PositionDiagnosisResult[] }) {
  const stopCount  = items.filter(i => i.signal === 'STOP_LOSS').length
  const tCount     = items.filter(i => i.signal === 'BUY_T' || i.signal === 'SELL_T').length
  const totalVal   = items.reduce((s, i) => s + i.snapshot.price * i.position.quantity, 0)
  const totalCost  = items.reduce((s, i) => s + i.snapshot.avg_cost * i.position.quantity, 0)
  const totalPnl   = totalCost > 0 ? (totalVal - totalCost) / totalCost : 0
  const avgHealth  = Math.round(items.reduce((s, i) => s + getHealthScore(i), 0) / (items.length || 1))
  const lowHealth  = items.filter(i => getHealthScore(i) < 45).length

  return (
    <div className="grid grid-cols-5 gap-3">
      {[
        { label: '总市值', value: `¥${(totalVal/10000).toFixed(1)}万`, color: 'text-ink-primary', sub: `成本 ¥${(totalCost/10000).toFixed(1)}万` },
        { label: '持仓浮盈', value: `${totalPnl >= 0 ? '+' : ''}${(totalPnl * 100).toFixed(2)}%`, color: totalPnl >= 0 ? 'text-accent-green' : 'text-red-400', sub: `${totalPnl >= 0 ? '+' : ''}${(totalVal - totalCost).toFixed(0)}元` },
        { label: '止损警报', value: stopCount, color: stopCount > 0 ? 'text-red-400' : 'text-ink-muted', sub: stopCount > 0 ? '⚠ 需立即处理' : '暂无' },
        { label: '健康均分', value: avgHealth, color: avgHealth >= 70 ? 'text-accent-green' : avgHealth >= 45 ? 'text-amber-400' : 'text-red-400', sub: lowHealth > 0 ? `${lowHealth} 只需优先处理` : '整体可控' },
        { label: '做T机会', value: tCount, color: tCount > 0 ? 'text-accent-amber' : 'text-ink-muted', sub: tCount > 0 ? '可操作' : '暂无' },
      ].map(({ label, value, color, sub }) => (
        <div key={label} className="bg-terminal-panel border border-terminal-border rounded-xl p-4">
          <p className="text-[11px] text-ink-muted font-mono uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          <p className="text-[11px] text-ink-muted mt-1">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────

export default function PositionGuardian() {
  const navigate = useNavigate()
  const [items,         setItems]         = useState<PositionDiagnosisResult[]>([])
  const [loading,       setLoading]       = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [error,         setError]         = useState('')
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null)
  const [sortBy,        setSortBy]        = useState<'priority' | 'pnl' | 'health'>('priority')

  const runDiagnosis = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchPositionDiagnosis()
      setItems(res.data.data.items ?? [])
      setLastUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '诊断失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  // 一键执行止损/减仓：跳转到交易日志并预填所有字段
  const handleExecuteTrade = useCallback((
    code: string,
    signal: SignalType,
    qty: number,
    price: number,
  ) => {
    const today = new Date().toISOString().slice(0, 10)
    const isStop = signal === 'STOP_LOSS'
    const reason = isStop
      ? `持仓守护止损信号 · 止损执行`
      : `持仓守护减仓信号 · ${signal === 'SELL_T' ? '高抛做T' : '主动减仓'}`

    const params = new URLSearchParams({
      add:          '1',
      code,
      action:       'SELL',
      price:        price.toFixed(2),
      volume:       String(qty),
      date:         today,
      reason,
      sell_template: isStop ? 'ALL_OUT' : 'ONE_THIRD',
      priority:     isStop ? 'HIGH' : 'MEDIUM',
      event_type:   'POSITION_SIGNAL',
    })
    navigate(`/trades?${params.toString()}`)
  }, [navigate])

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'priority') return SIGNAL_CONFIG[a.signal].priority - SIGNAL_CONFIG[b.signal].priority
    if (sortBy === 'pnl')      return a.snapshot.pnl_pct - b.snapshot.pnl_pct
    return getHealthScore(a) - getHealthScore(b)
  })

  const stopCount = items.filter(i => i.signal === 'STOP_LOSS').length

  return (
    <div className="flex flex-col h-full bg-terminal-bg overflow-hidden">

      {/* ── 顶栏 ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-terminal-border bg-terminal-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-terminal-muted border border-terminal-border flex items-center justify-center">
              <Shield size={15} className="text-accent-green" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-ink-primary">持仓守护</h1>
              <p className="text-xs text-ink-muted font-mono">
                止损信号 → 一键记录卖出 · ATR止损 · T+0判定
                {lastUpdated && <span className="ml-2 text-ink-muted/60">上次诊断 {lastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-terminal-border overflow-hidden text-xs font-mono">
              {[{ key: 'priority', label: '按信号' }, { key: 'pnl', label: '按盈亏' }, { key: 'health', label: '按健康分' }].map(({ key, label }) => (
                <button key={key} onClick={() => setSortBy(key as typeof sortBy)}
                  className={`px-3 py-1.5 transition-colors ${sortBy === key ? 'bg-terminal-muted text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-terminal-border text-xs text-ink-secondary hover:text-accent-green hover:border-accent-green/40 transition-all">
              <Plus size={13} /> 录入持仓
            </button>
            <button onClick={runDiagnosis} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold hover:bg-accent-green/20 disabled:opacity-50 transition-all">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? '诊断中...' : '开始诊断'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 止损紧急横幅 ── */}
      {stopCount > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-red-500/15 border-b border-red-500/30">
          <div className="flex items-center gap-2 text-red-300 text-sm font-semibold">
            <AlertTriangle size={16} className="animate-pulse" />
            {stopCount} 只持仓已触发止损信号，请立即处理，避免亏损扩大
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-red-400">
            点击下方卡片中的「立即止损」按钮执行
          </div>
        </div>
      )}

      {/* ── 主体 ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertTriangle size={15} /><span>{error}</span>
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center mb-4">
              <Shield size={28} className="text-ink-muted" />
            </div>
            <p className="text-ink-secondary text-base font-medium mb-1">暂无持仓数据</p>
            <p className="text-ink-muted text-sm mb-6 max-w-xs leading-relaxed">
              先在「交易日志」记录买入，或点击「录入持仓」手动录入，再「开始诊断」。
            </p>
            <button onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm font-semibold hover:bg-accent-green/20 transition-all">
              <Plus size={15} /> 录入我的持仓
            </button>
          </div>
        )}

        {items.length > 0 && <SummaryBar items={items} />}

        {sorted.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {sorted.map(item => (
              <DiagnosisCard
                key={item.stock_code}
                item={item}
                onViewDetail={code => navigate(`/stocks/${code}`)}
                onExecuteTrade={handleExecuteTrade}
              />
            ))}
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-xl bg-terminal-muted/40 border border-terminal-border animate-pulse" />
            ))}
            <p className="text-center text-xs text-ink-muted font-mono pt-2">正在抓取行情 + 计算ATR/MA20 + 调用AI生成指令…</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-2 p-4 bg-terminal-panel border border-terminal-border rounded-xl">
            <p className="text-xs font-mono text-ink-muted leading-relaxed">
              <span className="text-ink-secondary font-semibold">算法说明：</span>
              止损条件：① 跌破20日支撑位 ② 含手续费亏损 ≥ 8% ③ 低于ATR止损位。
              点击「立即止损」按钮会跳转到交易日志并预填代码、价格、数量，确认后自动记录并同步持仓。
              <span className="text-red-400/80"> 亏损持仓严禁低吸加仓</span>。
            </p>
          </div>
        )}
      </div>

      {showSyncModal && (
        <SyncModal onClose={() => setShowSyncModal(false)} onSuccess={runDiagnosis} />
      )}
    </div>
  )
}
