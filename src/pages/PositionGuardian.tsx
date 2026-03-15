import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, RefreshCw, Plus, TrendingDown, TrendingUp,
  ArrowRight, AlertTriangle, Activity, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { fetchPositionDiagnosis, syncPosition } from '@/api/stock'
import type { PositionDiagnosisResult, SignalType, SyncPositionRequest } from '@/types'

// ── 信号配置表 ────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<SignalType, {
  label: string
  color: string        // tailwind text color
  bg: string           // tailwind bg
  border: string
  icon: React.ReactNode
  priority: number     // 排序权重（越小越靠前）
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

// ── 格式化工具 ────────────────────────────────────────────────────

const fmt2 = (n: number) => n.toFixed(2)
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
const fmtAmp = (n: number) => `${(n * 100).toFixed(1)}%`

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

// ── 单卡片 ────────────────────────────────────────────────────────

function DiagnosisCard({ item, onViewDetail }: {
  item: PositionDiagnosisResult
  onViewDetail: (code: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SIGNAL_CONFIG[item.signal]
  const s = item.snapshot

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3 transition-all duration-200`}>

      {/* ── 顶部：代码 + 信号 + 盈亏 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => onViewDetail(item.stock_code)}
            className="text-base font-bold text-ink-primary hover:text-accent-green transition-colors font-mono"
          >
            {item.stock_code}
          </button>
          <span className="text-sm text-ink-secondary truncate">{item.stock_name}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border} flex-shrink-0`}>
          {cfg.icon}
          <span>{cfg.label}</span>
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

      {/* ── 展开技术面 ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-secondary transition-colors"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? '收起技术面数据' : '展开技术面数据'}
      </button>

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
              <span className={`text-xs font-mono ${
                k === 'MA20斜率'
                  ? s.ma20_slope >= 0 ? 'text-accent-green' : 'text-red-400'
                  : 'text-ink-secondary'
              }`}>{v}</span>
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
        </div>
      )}

      {/* ── 底部操作 ── */}
      <div className="flex items-center justify-between pt-1 border-t border-terminal-border/50">
        <div className="flex items-center gap-3 text-[11px] text-ink-muted font-mono">
          <span>持仓 {item.position.quantity}股</span>
          <span className="text-terminal-border">|</span>
          <span>可用 {item.position.available_qty}股</span>
          {item.snapshot.can_do_t && (
            <span className="text-accent-green ml-1 font-semibold">✓ 可做T</span>
          )}
        </div>
        <button
          onClick={() => onViewDetail(item.stock_code)}
          className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent-green transition-colors"
        >
          查看K线 <ArrowRight size={11} />
        </button>
      </div>
    </div>
  )
}

// ── 录入持仓弹窗 ──────────────────────────────────────────────────

function SyncModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<SyncPositionRequest>({
    stock_code: '',
    avg_cost: 0,
    quantity: 0,
    available_qty: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.stock_code || !form.avg_cost || !form.quantity) {
      setError('请填写完整的代码、成本和数量')
      return
    }
    setLoading(true)
    setError('')
    try {
      await syncPosition(form)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '同步失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-terminal-panel border border-terminal-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-slide-up">

        {/* 标题 */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-ink-primary">录入持仓</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="space-y-3">
          {[
            { label: '股票代码', key: 'stock_code', type: 'text', placeholder: '如 002429', hint: '6位纯数字代码' },
            { label: '持仓均价（元）', key: 'avg_cost', type: 'number', placeholder: '如 12.50', hint: '实际买入均价' },
            { label: '总持仓（股）', key: 'quantity', type: 'number', placeholder: '如 1000', hint: '持仓总数量' },
            { label: '今日可用（股）', key: 'available_qty', type: 'number', placeholder: '如 1000', hint: '可卖出数量，T+1购入填0' },
          ].map(({ label, key, type, placeholder, hint }) => (
            <div key={key}>
              <label className="block text-xs text-ink-muted font-mono mb-1">
                {label} <span className="text-ink-muted/60">— {hint}</span>
              </label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key as keyof SyncPositionRequest] || ''}
                onChange={e => setForm(f => ({
                  ...f,
                  [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                }))}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm text-ink-primary font-mono placeholder:text-ink-muted/40 focus:outline-none focus:border-accent-green/60 transition-colors"
              />
            </div>
          ))}
        </div>

        {/* 费率提示 */}
        <div className="mt-4 p-3 bg-accent-green/5 border border-accent-green/20 rounded-lg">
          <p className="text-xs text-accent-green font-mono">
            💡 万一免五费率：买入 0.01% + 卖出 0.06%（含印花税）
          </p>
          <p className="text-xs text-ink-muted mt-0.5 font-mono">
            T+0 盈亏平衡点：振幅 ≥ 0.1% 即有净利润空间
          </p>
        </div>

        {/* 错误 */}
        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* 按钮 */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm text-ink-secondary border border-terminal-border hover:border-ink-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 disabled:opacity-50 transition-colors"
          >
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
  const holdCount  = items.filter(i => i.signal === 'HOLD').length
  const totalPnl   = items.reduce((s, i) => s + i.snapshot.pnl_pct, 0) / (items.length || 1)

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        {
          label: '持仓总数',
          value: items.length,
          color: 'text-ink-primary',
          sub: '只股票',
        },
        {
          label: '止损警报',
          value: stopCount,
          color: stopCount > 0 ? 'text-red-400' : 'text-ink-muted',
          sub: stopCount > 0 ? '需立即处理' : '暂无',
        },
        {
          label: '做T机会',
          value: tCount,
          color: tCount > 0 ? 'text-amber-400' : 'text-ink-muted',
          sub: tCount > 0 ? '可操作' : '暂无',
        },
        {
          label: '平均盈亏',
          value: fmtPct(totalPnl),
          color: totalPnl >= 0 ? 'text-accent-green' : 'text-red-400',
          sub: `含万一免五`,
        },
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
  const [items, setItems] = useState<PositionDiagnosisResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [sortBy, setSortBy] = useState<'priority' | 'pnl'>('priority')

  const runDiagnosis = useCallback(async () => {
    setLoading(true)
    setError('')
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

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'priority') {
      return SIGNAL_CONFIG[a.signal].priority - SIGNAL_CONFIG[b.signal].priority
    }
    return a.snapshot.pnl_pct - b.snapshot.pnl_pct
  })

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
                万一免五 · ATR止损 · T+0智能判定
                {lastUpdated && (
                  <span className="ml-2 text-ink-muted/60">
                    上次诊断 {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 排序 */}
            <div className="flex rounded-lg border border-terminal-border overflow-hidden text-xs font-mono">
              {[
                { key: 'priority', label: '按信号' },
                { key: 'pnl',      label: '按盈亏' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key as typeof sortBy)}
                  className={`px-3 py-1.5 transition-colors ${
                    sortBy === key
                      ? 'bg-terminal-muted text-ink-primary'
                      : 'text-ink-muted hover:text-ink-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-terminal-border text-xs text-ink-secondary hover:text-accent-green hover:border-accent-green/40 transition-all"
            >
              <Plus size={13} /> 录入持仓
            </button>

            <button
              onClick={runDiagnosis}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs font-semibold hover:bg-accent-green/20 disabled:opacity-50 transition-all"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? '诊断中...' : '开始诊断'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* 空状态 */}
        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center mb-4">
              <Shield size={28} className="text-ink-muted" />
            </div>
            <p className="text-ink-secondary text-base font-medium mb-1">暂无持仓数据</p>
            <p className="text-ink-muted text-sm mb-6 max-w-xs leading-relaxed">
              先点击「录入持仓」输入你的成本和数量，再点击「开始诊断」获取量化建议。
            </p>
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm font-semibold hover:bg-accent-green/20 transition-all"
            >
              <Plus size={15} /> 录入我的持仓
            </button>
          </div>
        )}

        {/* 统计摘要 */}
        {items.length > 0 && <SummaryBar items={items} />}

        {/* 诊断卡片 */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {sorted.map(item => (
              <DiagnosisCard
                key={item.stock_code}
                item={item}
                onViewDetail={code => navigate(`/stocks/${code}`)}
              />
            ))}
          </div>
        )}

        {/* 加载骨架 */}
        {loading && items.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-xl bg-terminal-muted/40 border border-terminal-border animate-pulse" />
            ))}
            <p className="text-center text-xs text-ink-muted font-mono pt-2">
              正在抓取行情 + 计算ATR/MA20 + 调用AI生成指令…
            </p>
          </div>
        )}

        {/* 说明 */}
        {items.length > 0 && (
          <div className="mt-2 p-4 bg-terminal-panel border border-terminal-border rounded-xl">
            <p className="text-xs font-mono text-ink-muted leading-relaxed">
              <span className="text-ink-secondary font-semibold">算法说明：</span>
              硬止损 = 买入均价 − 2×ATR(20)；触发止损条件：① 价格跌破20日支撑位 ② 含手续费亏损 ≥ 8% ③ 价格低于硬止损位。
              做T条件：振幅 ≥ 1.5% 且可用持仓 &gt; 0。<span className="text-red-400/80">亏损持仓严禁低吸加仓</span>，
              仅允许高抛减仓或止损离场。万一免五手续费：买入0.01% + 卖出0.01% + 印花税0.05% = 合计0.07%，T+0盈亏平衡线为0.1%。
            </p>
          </div>
        )}
      </div>

      {/* 录入弹窗 */}
      {showSyncModal && (
        <SyncModal
          onClose={() => setShowSyncModal(false)}
          onSuccess={runDiagnosis}
        />
      )}
    </div>
  )
}
