import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScrollText, TrendingUp, TrendingDown, Plus, X,
  RefreshCw, Activity, DollarSign, BarChart2, Trophy,
  Search, Filter, Target, Link, Pencil, Trash2, AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { formatAmount, EmptyState, SkeletonRow, ErrorBanner } from '@/components/shared'
import { fetchBuyPlans, updateBuyPlanStatus } from '@/api/buyPlan'
import { fetchDailyRiskState, fetchRiskProfile, precheckTrade } from '@/api/risk'
import http from '@/api/http'
import type { ApiResponse } from '@/types'
import type { BuyPlan } from '@/types/buy_plan'
import type { RiskProfile, TradePrecheckResult } from '@/types/risk'

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

interface TradeLogVO {
  id:         number
  stock_code: string
  action:     'BUY' | 'SELL'
  price:      number
  volume:     number
  amount:     number
  traded_at:  string
  reason:     string
}

interface TradeListResponse {
  items:   TradeLogVO[]
  count:   number
  limit?:  number
  offset?: number
}

interface PositionSummary {
  stock_code:      string
  hold_volume:     number
  avg_cost_price:  number
  total_cost:      number
  realized_pnl:    number
  realized_trades: number
  current_price:   number
  unrealized_pnl:  number
  unrealized_pct:  number
  total_pnl:       number
}

interface PerformanceReport {
  total_realized_pnl:   number
  total_unrealized_pnl: number
  total_pnl:            number
  positions:            PositionSummary[]
  total_trades:         number
  win_positions:        number
  lose_positions:       number
  note:                 string
}

// ── API ──────────────────────────────────────────────────────────
const fetchAllTrades = (limit = 500) =>
  http.get<ApiResponse<TradeListResponse>>('/trades', { params: { limit } })

const fetchPerformance = () =>
  http.get<ApiResponse<PerformanceReport>>('/stats/performance')

const postTrade = (body: object) =>
  http.post<ApiResponse<TradeLogVO>>('/trades', body)

const putTrade = (id: number, body: object) =>
  http.put<ApiResponse<TradeLogVO>>(`/trades/${id}`, body)

const deleteTrade = (id: number) =>
  http.delete<ApiResponse<{ deleted: boolean; id: number }>>(`/trades/${id}`)

// ── 工具 ──────────────────────────────────────────────────────────
const pnlColor = (v: number) =>
  v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const pnlSign  = (v: number) => v > 0 ? '+' : ''
const fDate    = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
// 把 ISO 转成 YYYY-MM-DD 用于 date input
const isoToDateInput = (iso: string) => iso ? iso.slice(0, 10) : ''

const inputCls = `w-full bg-terminal-muted border border-terminal-border rounded-md
  px-3 py-2 text-sm text-ink-primary placeholder-ink-muted/40
  focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/20 transition-colors`

const LabelXs = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
    {children}
  </label>
)

// ═══════════════════════════════════════════════════════════════
// 添加 / 编辑 弹框（合并为一个组件）
// ═══════════════════════════════════════════════════════════════
interface TradeDialogProps {
  mode: 'add' | 'edit'
  initialData?: TradeLogVO
  onClose: () => void
  onSuccess: () => void
}

function TradeDialog({ mode, initialData, onClose, onSuccess }: TradeDialogProps) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    stock_code: initialData?.stock_code ?? '',
    action:     initialData?.action     ?? 'BUY',
    price:      initialData?.price      ? String(initialData.price)  : '',
    volume:     initialData?.volume     ? String(initialData.volume) : '',
    traded_at:  initialData?.traded_at  ? isoToDateInput(initialData.traded_at) : '',
    reason:     initialData?.reason     ?? '',
  })
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null)
  const [precheckResult, setPrecheckResult] = useState<TradePrecheckResult | null>(null)
  const { data: dailyRiskState } = useQuery(
    useCallback(() => fetchDailyRiskState(), []),
    { refetchInterval: 30_000 },
  )

  // 关联买入计划（仅新增买入时使用）
  const [activePlans,  setActivePlans]  = useState<BuyPlan[]>([])
  const [linkedPlanId, setLinkedPlanId] = useState<number | null>(null)

  useEffect(() => {
    if (isEdit) return
    const code = form.stock_code.trim()
    if (form.action !== 'BUY' || code.length !== 6) {
      setActivePlans([])
      setLinkedPlanId(null)
      return
    }
    fetchBuyPlans('active')
      .then(res => {
        const matched = (res.data.data?.items ?? []).filter(
          p => p.stock_code === code && (p.status === 'WATCHING' || p.status === 'READY')
        )
        setActivePlans(matched)
        if (matched.length === 1) setLinkedPlanId(matched[0].id)
        else setLinkedPlanId(null)
      })
      .catch(() => setActivePlans([]))
  }, [form.stock_code, form.action, isEdit])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetchRiskProfile()
        if (active) setRiskProfile(res.data.data)
      } catch {
        // 静默降级
      }
    })()
    return () => { active = false }
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const runBuyPrecheck = async () => {
    const code = form.stock_code.trim()
    const price = parseFloat(form.price)
    const volume = parseInt(form.volume, 10)
    if (!/^\d{6}$/.test(code)) throw new Error('请先填写 6 位股票代码')
    if (isNaN(price) || price <= 0) throw new Error('请先填写有效买入价')
    if (isNaN(volume) || volume <= 0) throw new Error('请先填写有效数量')
    const plannedAmount = price * volume

    let stopLoss = price * 0.95
    let targetPrice = price * 1.1
    if (linkedPlanId) {
      const plan = activePlans.find(p => p.id === linkedPlanId)
      if (plan?.stop_loss_price && plan.stop_loss_price > 0) stopLoss = plan.stop_loss_price
      if (plan?.target_price && plan.target_price > 0) targetPrice = plan.target_price
    }

    const res = await precheckTrade({
      stock_code: code,
      buy_price: price,
      stop_loss_price: stopLoss,
      target_price: targetPrice,
      planned_amount: plannedAmount,
      reason: form.reason.trim(),
    })
    const data = res.data.data
    setPrecheckResult(data)
    return data
  }

  const handleSubmit = async () => {
    setErr('')
    const price  = parseFloat(form.price)
    const volume = parseInt(form.volume, 10)
    if (!form.stock_code.trim())      { setErr('请输入股票代码'); return }
    if (isNaN(price)  || price  <= 0) { setErr('请输入有效的价格（大于 0）'); return }
    if (isNaN(volume) || volume <= 0) { setErr('请输入有效的数量（大于 0）'); return }
    setLoading(true)
    try {
      if (form.action === 'BUY') {
        if (dailyRiskState?.status === 'BLOCK') {
          setErr(dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）')
          return
        }
        const checked = await runBuyPrecheck()
        if (!checked.pass) {
          setErr('买入预检未通过，请先修正后再提交')
          return
        }
      }
      if (isEdit && initialData) {
        await putTrade(initialData.id, {
          action:    form.action,
          price,
          volume,
          traded_at: form.traded_at || undefined,
          reason:    form.reason.trim(),
        })
      } else {
        const res = await postTrade({
          stock_code: form.stock_code.trim(),
          action:     form.action,
          price,
          volume,
          traded_at:  form.traded_at || undefined,
          reason:     form.reason.trim(),
        })
        const newTradeId: number = res.data.data?.id
        if (form.action === 'BUY' && linkedPlanId && newTradeId) {
          await updateBuyPlanStatus(linkedPlanId, 'EXECUTED', newTradeId)
        }
      }
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const accentColor = isEdit ? 'accent-cyan' : 'accent-green'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="card w-[460px] shadow-panel animate-fade-in">
        <div className={`h-0.5 w-full bg-gradient-to-r from-${accentColor}/60 via-${accentColor}/40 to-transparent rounded-t-xl`} />

        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg bg-${accentColor}/10 border border-${accentColor}/30 flex items-center justify-center`}>
              {isEdit ? <Pencil size={13} className={`text-${accentColor}`} /> : <ScrollText size={13} className={`text-${accentColor}`} />}
            </div>
            <span className="font-semibold text-sm text-ink-primary">
              {isEdit ? `编辑记录 · ${initialData?.stock_code}` : '记录交易'}
            </span>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-terminal-muted transition-colors">
            <X size={13} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 代码（编辑模式只读）+ 方向 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>股票代码 *</LabelXs>
              <input
                autoFocus={!isEdit}
                type="text" maxLength={6} placeholder="如 600519"
                value={form.stock_code}
                readOnly={isEdit}
                onChange={e => !isEdit && set('stock_code', e.target.value.replace(/\D/g, ''))}
                className={inputCls + ' font-mono tracking-widest' + (isEdit ? ' opacity-50 cursor-not-allowed' : '')}
              />
            </div>
            <div>
              <LabelXs>交易方向 *</LabelXs>
              <div className="flex gap-2 mt-1">
                {(['BUY', 'SELL'] as const).map(a => (
                  <button key={a} type="button" onClick={() => set('action', a)}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold border transition-all ${
                      form.action === a
                        ? a === 'BUY'
                          ? 'bg-accent-green/15 border-accent-green/50 text-accent-green'
                          : 'bg-accent-red/15 border-accent-red/50 text-accent-red'
                        : 'border-terminal-border text-ink-muted hover:border-ink-muted/40'
                    }`}>
                    {a === 'BUY' ? '▲ 买入' : '▼ 卖出'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 价格 + 数量 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>成交价格（元）*</LabelXs>
              <input autoFocus={isEdit} type="number" step="0.01" min="0.01" placeholder="如 12.50"
                value={form.price} onChange={e => set('price', e.target.value)}
                className={inputCls + ' font-mono'} />
            </div>
            <div>
              <LabelXs>成交数量（股）*</LabelXs>
              <input type="number" step="100" min="1" placeholder="如 1000"
                value={form.volume} onChange={e => set('volume', e.target.value)}
                className={inputCls + ' font-mono'} />
            </div>
          </div>

          {/* 金额预览 */}
          {form.price && form.volume && parseFloat(form.price) > 0 && parseInt(form.volume) > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent-green/5 border border-accent-green/20 text-xs font-mono">
              <span className="text-ink-muted">交易金额</span>
              <span className="text-accent-green font-semibold">
                {formatAmount(parseFloat(form.price) * parseInt(form.volume, 10))}
              </span>
            </div>
          )}

          {/* 关联计划（仅新增买入） */}
          {!isEdit && form.action === 'BUY' && activePlans.length > 0 && (
            <div>
              <LabelXs><span className="flex items-center gap-1"><Link size={9} /> 关联买入计划（可选）</span></LabelXs>
              <select value={linkedPlanId ?? ''} onChange={e => setLinkedPlanId(e.target.value ? Number(e.target.value) : null)} className={inputCls + ' font-mono'}>
                <option value="">不关联</option>
                {activePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.stock_name}（{p.stock_code}）
                    {p.buy_price != null ? ` · 买入价 ¥${p.buy_price.toFixed(2)}` : ''}
                    {p.target_price != null ? ` → 目标 ¥${p.target_price.toFixed(2)}` : ''}
                    {p.status === 'READY' ? ' ⚡已触发' : ''}
                  </option>
                ))}
              </select>
              {linkedPlanId && (
                <p className="text-[10px] font-mono text-accent-amber mt-1 flex items-center gap-1">
                  <Target size={9} /> 执行后将自动把关联计划标记为「已执行」
                </p>
              )}
            </div>
          )}

          {/* 日期 */}
          <div>
            <LabelXs>交易日期{isEdit ? '' : '（留空 = 今日）'}</LabelXs>
            <input type="date" value={form.traded_at}
              onChange={e => set('traded_at', e.target.value)}
              className={inputCls + ' font-mono'} />
          </div>

          {/* 理由 */}
          <div>
            <LabelXs>交易理由（可选）</LabelXs>
            <input type="text" maxLength={200} placeholder="如：回调至支撑位，均线金叉…"
              value={form.reason} onChange={e => set('reason', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={inputCls} />
          </div>

          {/* 买入预检（仅买入） */}
          {form.action === 'BUY' && (
            <div className="rounded-md border border-terminal-border p-3 bg-terminal-muted/60">
              <div className="flex items-center justify-between mb-2">
                <LabelXs>买入前风控检查</LabelXs>
                <button
                  type="button"
                  onClick={async () => {
                    setErr('')
                    try { await runBuyPrecheck() } catch (e) { setErr(e instanceof Error ? e.message : '检查失败') }
                  }}
                  className="btn-ghost text-xs"
                >
                  运行检查
                </button>
              </div>
              {riskProfile && (
                <p className="text-[10px] text-ink-muted mb-2">
                  默认参数：单笔风险 {riskProfile.risk_per_trade_pct}% · 单票上限 {riskProfile.max_position_pct}% · 总资产 {formatAmount(riskProfile.account_size)}
                </p>
              )}
              {!precheckResult ? (
                <p className="text-xs text-ink-muted">提交前会自动检查，也可以先手动运行。</p>
              ) : (
                <div className="space-y-1 text-xs">
                  {[
                    ['止损有效', precheckResult.checklist.has_stop_loss],
                    ['目标价有效', precheckResult.checklist.has_target_price],
                    ['亏损在预算内', precheckResult.checklist.has_risk_budget],
                    ['已填写理由', precheckResult.checklist.has_reason],
                    ['仓位未超限', precheckResult.checklist.position_in_bounds],
                    ['未触发当日熔断', precheckResult.checklist.can_open_new_position],
                  ].map(([label, ok]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className={ok ? 'text-accent-green' : 'text-accent-red'}>{ok ? '通过' : '未通过'}</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-terminal-border text-ink-muted">
                    最坏亏损 {formatAmount(precheckResult.worst_loss_amount)}（{precheckResult.worst_loss_pct.toFixed(2)}%） · 允许亏损 {formatAmount(precheckResult.allowed_loss_amount)}
                  </div>
                  <div className="text-ink-muted">
                    单票上限 {formatAmount(precheckResult.max_position_amount)}（最多 {precheckResult.max_position_volume} 股）
                    {precheckResult.suggested_adjust_volume > 0 && (
                      <span> · 建议改为 {precheckResult.suggested_adjust_volume} 股（约 {formatAmount(precheckResult.suggested_adjust_amount)}）</span>
                    )}
                  </div>
                  <div className="text-ink-muted">
                    当日风控：{precheckResult.daily_risk_state.status} · {precheckResult.daily_risk_state.message}
                  </div>
                </div>
              )}
              {dailyRiskState?.status === 'BLOCK' && (
                <p className="mt-2 text-xs text-accent-red font-mono">
                  {dailyRiskState.message || '当日亏损触发熔断，仅限制买入开仓（卖出/减仓不受影响）'}
                </p>
              )}
            </div>
          )}

          {err && <ErrorBanner message={err} />}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (form.action === 'BUY' && dailyRiskState?.status === 'BLOCK')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
              bg-${accentColor}/15 border border-${accentColor}/40 text-${accentColor}
              hover:bg-${accentColor}/25 hover:border-${accentColor}/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
            title={form.action === 'BUY' && dailyRiskState?.status === 'BLOCK' ? (dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
          >
            {loading
              ? <><RefreshCw size={12} className="animate-spin" /> 提交中…</>
              : isEdit
                ? <><Pencil size={12} /> 保存修改</>
                : <><Plus size={12} /> 确认记录</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 删除确认弹窗
// ═══════════════════════════════════════════════════════════════
function DeleteConfirmDialog({
  item, onClose, onSuccess,
}: { item: TradeLogVO; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteTrade(item.id)
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="card w-[380px] shadow-panel animate-fade-in">
        <div className="h-0.5 w-full bg-accent-red/50 rounded-t-xl" />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent-red/10 border border-accent-red/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-accent-red" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-primary mb-1">确认删除此记录？</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                此操作不可恢复。删除后将影响持仓和盈亏计算。
              </p>
            </div>
          </div>

          {/* 被删除记录摘要 */}
          <div className="px-3 py-2.5 rounded-lg bg-terminal-muted border border-terminal-border text-xs font-mono space-y-1 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">股票代码</span>
              <span className="text-ink-secondary font-semibold">{item.stock_code}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">方向</span>
              <span className={item.action === 'BUY' ? 'text-accent-green' : 'text-accent-red'}>
                {item.action === 'BUY' ? '▲ 买入' : '▼ 卖出'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">价格 × 数量</span>
              <span className="text-ink-primary">¥{item.price.toFixed(2)} × {item.volume.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">日期</span>
              <span className="text-ink-muted">{fDate(item.traded_at)}</span>
            </div>
          </div>

          {err && <ErrorBanner message={err} />}

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
            <button onClick={handleDelete} disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-accent-red/10 border border-accent-red/40 text-accent-red hover:bg-accent-red/20 disabled:opacity-40 transition-all">
              {loading ? <><RefreshCw size={12} className="animate-spin" /> 删除中…</> : <><Trash2 size={12} /> 确认删除</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 行操作菜单（悬浮显示）
// ═══════════════════════════════════════════════════════════════
function RowActions({
  item,
  onEdit,
  onDelete,
}: { item: TradeLogVO; onEdit: (i: TradeLogVO) => void; onDelete: (i: TradeLogVO) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-ink-muted border border-transparent hover:border-terminal-border hover:bg-terminal-muted hover:text-ink-secondary transition-all"
      >
        操作 <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-terminal-panel border border-terminal-border rounded-lg shadow-xl overflow-hidden min-w-[100px]">
          <button
            onClick={() => { setOpen(false); onEdit(item) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-secondary hover:bg-terminal-muted hover:text-accent-cyan transition-colors"
          >
            <Pencil size={11} /> 编辑
          </button>
          <div className="h-px bg-terminal-border" />
          <button
            onClick={() => { setOpen(false); onDelete(item) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-muted hover:bg-accent-red/10 hover:text-accent-red transition-colors"
          >
            <Trash2 size={11} /> 删除
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 盈亏概览（不变）
// ═══════════════════════════════════════════════════════════════
function PerformancePanel({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchPerformance(), [refreshKey]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (loading && !data) {
    return (
      <div className="card p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-terminal-muted rounded w-40 mb-4" />
        {[70, 85, 55, 65].map((w, i) => (
          <div key={i} className="h-3 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }
  if (error) return <ErrorBanner message={error} />
  if (!data) return null

  const r            = data
  const holding      = r.positions.filter(p => p.hold_volume > 0)
  const withRealized = r.positions.filter(p => p.realized_pnl !== 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '总盈亏',     value: r.total_pnl,            icon: Activity,   raw: false },
          { label: '已实现盈亏', value: r.total_realized_pnl,   icon: DollarSign, raw: false },
          { label: '浮动盈亏',   value: r.total_unrealized_pnl, icon: TrendingUp, raw: false },
          { label: '交易笔数',   value: r.total_trades,         icon: ScrollText, raw: true  },
        ].map(({ label, value, icon: Icon, raw }) => (
          <div key={label} className="card p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xl font-mono font-bold ${raw ? 'text-ink-primary' : pnlColor(value as number)}`}>
                {raw ? String(value) : `${pnlSign(value as number)}${formatAmount(Math.abs(value as number))}`}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-lg bg-terminal-muted border border-terminal-border flex items-center justify-center ${raw ? 'text-ink-muted' : pnlColor(value as number)}`}>
              <Icon size={14} strokeWidth={1.8} />
            </div>
          </div>
        ))}
      </div>

      {r.positions.length > 0 && (
        <div className="flex items-center gap-3 px-1 text-xs font-mono text-ink-muted">
          <Trophy size={11} className="text-accent-amber flex-shrink-0" />
          盈利 <span className="text-accent-green font-medium">{r.win_positions}</span> 只 ·
          亏损 <span className="text-accent-red font-medium">{r.lose_positions}</span> 只 ·
          共 {r.positions.length} 只
          <span className="ml-auto text-[10px] opacity-60">{r.note}</span>
          <button onClick={refetch} className="flex items-center gap-1 text-ink-muted hover:text-accent-cyan transition-colors">
            <RefreshCw size={10} /> 刷新
          </button>
        </div>
      )}

      {holding.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <TrendingUp size={13} className="text-accent-green" />
            <span className="text-sm font-medium text-ink-primary">当前持仓</span>
            <span className="tag text-ink-muted">{holding.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '持仓(股)', '成本均价', '现价', '总成本', '浮动盈亏', '浮动比例'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holding.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{pos.hold_volume.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{pos.avg_cost_price.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">
                      {pos.current_price > 0 ? pos.current_price.toFixed(2) : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">{formatAmount(pos.total_cost)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(pos.unrealized_pnl)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pnl)}${formatAmount(Math.abs(pos.unrealized_pnl))}`
                        : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className={`px-4 py-3 font-mono ${pnlColor(pos.unrealized_pct)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pct)}${pos.unrealized_pct.toFixed(2)}%`
                        : <span className="text-ink-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {withRealized.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <DollarSign size={13} className="text-accent-amber" />
            <span className="text-sm font-medium text-ink-primary">已实现盈亏</span>
            <span className="tag text-ink-muted">{withRealized.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '当前持仓', '持仓均价', '总成本', '已实现盈亏', '平仓次数'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withRealized.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.hold_volume.toLocaleString() : <span className="text-ink-muted">已清仓</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.avg_cost_price.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? formatAmount(pos.total_cost) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(pos.realized_pnl)}`}>
                      {pnlSign(pos.realized_pnl)}{formatAmount(Math.abs(pos.realized_pnl))}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{pos.realized_trades} 次</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.positions.length === 0 && <EmptyState message="暂无持仓数据，点击右上角「记录交易」开始" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 交易流水（含编辑 & 删除）
// ═══════════════════════════════════════════════════════════════
function TradeHistory({
  refreshKey,
  onEdit,
  onDelete,
}: {
  refreshKey: number
  onEdit: (item: TradeLogVO) => void
  onDelete: (item: TradeLogVO) => void
}) {
  const navigate = useNavigate()
  const [filter,       setFilter]       = useState('')
  const [actionFilter, setActionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')

  const { data, loading, error } = useQuery(
    useCallback(() => fetchAllTrades(500), [refreshKey]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  const allItems: TradeLogVO[] = data?.items ?? []

  const filtered = useMemo(() => {
    let list = allItems
    if (filter.trim()) list = list.filter(i => i.stock_code.includes(filter.trim().toUpperCase()))
    if (actionFilter !== 'ALL') list = list.filter(i => i.action === actionFilter)
    return list
  }, [allItems, filter, actionFilter])

  const codes = useMemo(() => [...new Set(allItems.map(i => i.stock_code))].sort(), [allItems])

  return (
    <div className="card overflow-hidden">
      {/* ── 表头工具栏 ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-terminal-border flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <BarChart2 size={13} className="text-ink-secondary" />
          <span className="text-sm font-medium text-ink-primary">交易流水</span>
          {data && <span className="tag text-ink-muted">{filtered.length} / {allItems.length} 条</span>}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[11px] font-mono">
            {(['ALL', 'BUY', 'SELL'] as const).map(a => (
              <button key={a} onClick={() => setActionFilter(a)}
                className={`px-2.5 py-1.5 transition-colors ${
                  actionFilter === a
                    ? a === 'BUY' ? 'bg-accent-green/15 text-accent-green'
                      : a === 'SELL' ? 'bg-accent-red/15 text-accent-red'
                      : 'bg-terminal-muted text-ink-primary'
                    : 'text-ink-muted hover:text-ink-secondary'
                }`}>
                {a === 'ALL' ? '全部' : a === 'BUY' ? '▲ 买入' : '▼ 卖出'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input type="text" maxLength={6} placeholder="代码筛选…"
              value={filter}
              onChange={e => setFilter(e.target.value.replace(/\D/g, ''))}
              className="pl-7 pr-3 py-1.5 w-28 bg-terminal-muted border border-terminal-border rounded-lg text-xs font-mono text-ink-primary placeholder-ink-muted/40 focus:outline-none focus:border-accent-green/40 transition-colors" />
            {filter && (
              <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary">
                <X size={10} />
              </button>
            )}
          </div>

          {filter.length === 6 && (
            <button onClick={() => navigate(`/stocks/${filter.toUpperCase()}`)} className="btn-ghost text-accent-cyan text-[11px]">
              K线图
            </button>
          )}
        </div>
      </div>

      {/* 代码快捷筛选 */}
      {codes.length > 0 && !filter && (
        <div className="px-5 py-2 border-b border-terminal-border flex items-center gap-1.5 flex-wrap">
          <Filter size={10} className="text-ink-muted flex-shrink-0" />
          {codes.map(code => (
            <button key={code} onClick={() => setFilter(code)}
              className="px-2 py-0.5 text-[10px] font-mono rounded border border-terminal-border text-ink-muted hover:text-ink-primary hover:border-accent-green/30 transition-colors">
              {code}
            </button>
          ))}
        </div>
      )}

      {error && <div className="px-5 py-3"><ErrorBanner message={error} /></div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-terminal-border">
              {['日期', '代码', '方向', '价格', '数量', '金额', '备注', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              : filtered.length === 0
                ? <tr><td colSpan={8}><EmptyState message={allItems.length === 0 ? '暂无交易记录，点击右上角「记录交易」开始' : `没有找到 ${filter} 的交易记录`} /></td></tr>
                : filtered.map(item => (
                    <tr key={item.id} className="data-row group">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{fDate(item.traded_at)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/stocks/${item.stock_code}`)}
                          className="font-mono text-xs font-semibold text-ink-secondary hover:text-accent-cyan transition-colors underline-offset-2 hover:underline">
                          {item.stock_code}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                          item.action === 'BUY'
                            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                        }`}>
                          {item.action === 'BUY' ? <><TrendingUp size={9} /> 买入</> : <><TrendingDown size={9} /> 卖出</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-primary">{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-primary">{item.volume.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{formatAmount(item.amount)}</td>
                      <td className="px-4 py-3 text-ink-muted text-xs max-w-[160px] truncate">
                        {item.reason || <span className="opacity-30">—</span>}
                      </td>
                      {/* 操作列：hover 时显示 */}
                      <td className="px-3 py-3 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <RowActions item={item} onEdit={onEdit} onDelete={onDelete} />
                        </div>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════════════════════
export default function TradeLogs() {
  const [showAdd,    setShowAdd]    = useState(false)
  const [editItem,   setEditItem]   = useState<TradeLogVO | null>(null)
  const [deleteItem, setDeleteItem] = useState<TradeLogVO | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="交易日志"
        subtitle="FIFO 成本法 · 实时浮动盈亏"
        actions={
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={13} /> 记录交易
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <PerformancePanel refreshKey={refreshKey} />
        <TradeHistory
          refreshKey={refreshKey}
          onEdit={setEditItem}
          onDelete={setDeleteItem}
        />
      </div>

      {/* 新增弹窗 */}
      {showAdd && (
        <TradeDialog
          mode="add"
          onClose={() => setShowAdd(false)}
          onSuccess={refresh}
        />
      )}

      {/* 编辑弹窗 */}
      {editItem && (
        <TradeDialog
          mode="edit"
          initialData={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={refresh}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteItem && (
        <DeleteConfirmDialog
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}
