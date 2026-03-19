import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, Target, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle2, Clock, Ban, ChevronRight, Pencil, Trash2,
  RefreshCw, ExternalLink, Layers,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchBuyPlans, createBuyPlan, updateBuyPlan,
  updateBuyPlanStatus, deleteBuyPlan,
} from '@/api/buyPlan'
import { fetchDailyRiskState, fetchPortfolioExposure, fetchPositionSizeSuggestion, fetchRiskProfile, precheckTrade, updateRiskProfile } from '@/api/risk'
import {
  formatPrice, formatAmount, EmptyState, SkeletonRow, ErrorBanner, getPriceColor,
} from '@/components/shared'
import type { BuyPlan, BuyPlanStatus, CreateBuyPlanRequest, UpdateBuyPlanRequest } from '@/types/buy_plan'
import type { DailyRiskState, PortfolioExposureResult, PositionSizeSuggestion, RiskProfile, TradePrecheckResult } from '@/types/risk'

// ── 状态配置 ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BuyPlanStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  WATCHING:  { label: '观察中', color: 'text-accent-blue',  bg: 'bg-accent-blue/10 border-accent-blue/30',  icon: Clock },
  READY:     { label: '已到位', color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/30', icon: AlertCircle },
  EXECUTED:  { label: '已执行', color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/30', icon: CheckCircle2 },
  ABANDONED: { label: '已放弃', color: 'text-ink-muted',    bg: 'bg-terminal-muted border-terminal-border',  icon: Ban },
  EXPIRED:   { label: '已过期', color: 'text-ink-muted',    bg: 'bg-terminal-muted border-terminal-border',  icon: Ban },
}

// ── 辅助工具 ──────────────────────────────────────────────────────

function fmt(v: number | null | undefined, digits = 2) {
  if (v == null) return '—'
  return v.toFixed(digits)
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function rrColor(rr: number | null | undefined) {
  if (rr == null) return 'text-ink-muted'
  if (rr >= 3) return 'text-accent-green'
  if (rr >= 2) return 'text-accent-amber'
  return 'text-accent-red'
}

// ── 创建/编辑弹框 ─────────────────────────────────────────────────

interface PlanFormProps {
  initial?: BuyPlan
  dailyRiskState?: DailyRiskState | null
  onSave: (data: CreateBuyPlanRequest | UpdateBuyPlanRequest) => Promise<void>
  onClose: () => void
}

function PlanForm({ initial, dailyRiskState, onSave, onClose }: PlanFormProps) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    stock_code:     initial?.stock_code     ?? '',
    buy_price:      initial?.buy_price      != null ? String(initial.buy_price) : '',
    buy_price_high: initial?.buy_price_high != null ? String(initial.buy_price_high) : '',
    target_price:   initial?.target_price   != null ? String(initial.target_price) : '',
    stop_loss_price: initial?.stop_loss_price != null ? String(initial.stop_loss_price) : '',
    planned_amount: initial?.planned_amount != null ? String(initial.planned_amount) : '',
    position_ratio: initial?.position_ratio != null ? String(initial.position_ratio) : '',
    buy_batches:    String(initial?.buy_batches ?? 1),
    reason:         initial?.reason  ?? '',
    catalyst:       initial?.catalyst ?? '',
    valid_until:    initial?.valid_until ? initial.valid_until.slice(0, 10) : '',
    custom_note:    initial?.trigger_conditions?.custom_note ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [precheckResult, setPrecheckResult] = useState<TradePrecheckResult | null>(null)
  const [positionSuggestion, setPositionSuggestion] = useState<PositionSizeSuggestion | null>(null)
  const [suggestingSize, setSuggestingSize] = useState(false)

  const p = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetchRiskProfile()
        if (active) setRiskProfile(res.data.data)
      } catch {
        // 静默降级，不阻断主流程
      }
    })()
    return () => { active = false }
  }, [])

  const runPrecheck = async () => {
    const buyPrice = parseFloat(form.buy_price)
    const stopLossPrice = parseFloat(form.stop_loss_price)
    const plannedAmount = parseFloat(form.planned_amount)
    const targetPrice = parseFloat(form.target_price)

    if (!/^\d{6}$/.test(form.stock_code.trim()) && !isEdit) {
      throw new Error('请先填写正确的股票代码')
    }
    if (isNaN(buyPrice) || isNaN(stopLossPrice) || isNaN(plannedAmount)) {
      throw new Error('请先填写买入价、止损价、计划金额后再检查')
    }

    const stockCode = (form.stock_code || initial?.stock_code || '').trim()
    const res = await precheckTrade({
      stock_code: stockCode,
      buy_price: buyPrice,
      stop_loss_price: stopLossPrice,
      planned_amount: plannedAmount,
      ...(isNaN(targetPrice) ? {} : { target_price: targetPrice }),
      reason: form.reason || '',
    })
    const data = res.data.data
    setPrecheckResult(data)
    return data
  }

  const saveRiskDefaults = async () => {
    if (!riskProfile) return
    setSavingProfile(true)
    setErr('')
    try {
      const res = await updateRiskProfile({
        risk_per_trade_pct: riskProfile.risk_per_trade_pct,
        max_position_pct: riskProfile.max_position_pct,
        account_size: riskProfile.account_size,
      })
      setRiskProfile(res.data.data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存默认风控失败')
    } finally {
      setSavingProfile(false)
    }
  }

  const suggestPositionSize = async () => {
    const buyPrice = parseFloat(form.buy_price)
    const stopLossPrice = parseFloat(form.stop_loss_price)
    if (isNaN(buyPrice) || isNaN(stopLossPrice)) {
      throw new Error('请先填写买入价和止损价')
    }
    setSuggestingSize(true)
    try {
      const res = await fetchPositionSizeSuggestion(buyPrice, stopLossPrice)
      const suggestion = res.data.data
      setPositionSuggestion(suggestion)
      if (suggestion.suggested_amount > 0) {
        setForm(f => ({ ...f, planned_amount: suggestion.suggested_amount.toString() }))
      }
    } finally {
      setSuggestingSize(false)
    }
  }

  // 实时盈亏比预览
  const buyP   = parseFloat(form.buy_price)
  const tgtP   = parseFloat(form.target_price)
  const stopP  = parseFloat(form.stop_loss_price)
  const rrPreview = (!isNaN(buyP) && !isNaN(tgtP) && !isNaN(stopP) && buyP > stopP)
    ? ((tgtP - buyP) / (buyP - stopP)).toFixed(2) : null
  const retPreview = (!isNaN(buyP) && !isNaN(tgtP) && buyP > 0)
    ? (((tgtP - buyP) / buyP) * 100).toFixed(1) : null

  const handleSave = async () => {
    if (dailyRiskState?.status === 'BLOCK') {
      setErr(dailyRiskState.message || '当日风控已熔断，仅限制买入开仓（卖出/减仓不受影响）')
      return
    }
    const code = form.stock_code.trim()
    if (!isEdit && (!/^\d{6}$/.test(code))) { setErr('股票代码应为 6 位数字'); return }
    setLoading(true); setErr('')
    try {
      const checked = await runPrecheck()
      if (!checked.pass) {
        setErr('交易检查未通过，请先修正检查项后再保存')
        return
      }
      const payload: Record<string, unknown> = {}
      if (!isEdit) payload.stock_code = code
      if (form.buy_price)      payload.buy_price       = parseFloat(form.buy_price)
      if (form.buy_price_high) payload.buy_price_high  = parseFloat(form.buy_price_high)
      if (form.target_price)   payload.target_price    = parseFloat(form.target_price)
      if (form.stop_loss_price) payload.stop_loss_price = parseFloat(form.stop_loss_price)
      if (form.planned_amount) payload.planned_amount  = parseFloat(form.planned_amount)
      if (form.position_ratio) payload.position_ratio  = parseFloat(form.position_ratio)
      if (form.buy_batches)    payload.buy_batches      = parseInt(form.buy_batches)
      if (form.reason)         payload.reason           = form.reason
      if (form.catalyst)       payload.catalyst         = form.catalyst
      if (form.valid_until)    payload.valid_until      = form.valid_until
      if (form.custom_note)    payload.trigger_conditions = { custom_note: form.custom_note }
      await onSave(payload as CreateBuyPlanRequest)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
        {label}{required && <span className="text-accent-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const Input = ({ value, onChange, placeholder = '', type = 'text' }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  }) => (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-terminal-muted border border-terminal-border rounded-md px-3 py-2 text-sm font-mono text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-colors"
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-[560px] max-h-[90vh] flex flex-col shadow-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-accent-amber" />
            <span className="font-medium text-sm">{isEdit ? '编辑买入计划' : '新建买入计划'}</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors"><X size={14} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* 股票代码（仅新建时） */}
          {!isEdit && (
            <Field label="股票代码" required>
              <Input value={form.stock_code} onChange={p('stock_code')} placeholder="如 600519" />
            </Field>
          )}
          {isEdit && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-terminal-muted rounded-md border border-terminal-border">
              <span className="font-mono text-sm text-ink-muted">{initial?.stock_code}</span>
              <span className="text-sm text-ink-primary">{initial?.stock_name}</span>
            </div>
          )}

          {/* 价格区间 */}
          <div>
            <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-2">买入价区间</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="买入价（下限）">
                <Input value={form.buy_price} onChange={p('buy_price')} placeholder="如 1450.00" />
              </Field>
              <Field label="买入价（上限，可选）">
                <Input value={form.buy_price_high} onChange={p('buy_price_high')} placeholder="区间买入上限" />
              </Field>
            </div>
          </div>

          {/* 目标 & 止损 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="目标价（止盈）">
              <Input value={form.target_price} onChange={p('target_price')} placeholder="预期目标价" />
            </Field>
            <Field label="止损价">
              <Input value={form.stop_loss_price} onChange={p('stop_loss_price')} placeholder="最大亏损价位" />
            </Field>
          </div>

          {/* 实时盈亏比预览 */}
          {(rrPreview || retPreview) && (
            <div className="flex items-center gap-4 px-4 py-2.5 bg-terminal-muted rounded-md border border-terminal-border text-xs font-mono">
              {retPreview && (
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={11} className="text-accent-green" />
                  <span className="text-ink-muted">预期收益</span>
                  <span className="text-accent-green font-semibold">+{retPreview}%</span>
                </span>
              )}
              {rrPreview && (
                <span className="flex items-center gap-1.5">
                  <Layers size={11} className="text-accent-amber" />
                  <span className="text-ink-muted">盈亏比</span>
                  <span className={`font-semibold ${rrColor(parseFloat(rrPreview))}`}>1:{rrPreview}</span>
                </span>
              )}
            </div>
          )}

          {/* 仓位计划 */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="计划金额（元）">
              <Input value={form.planned_amount} onChange={p('planned_amount')} placeholder="如 50000" />
            </Field>
            <Field label="仓位占比（%）">
              <Input value={form.position_ratio} onChange={p('position_ratio')} placeholder="如 10" />
            </Field>
            <Field label="分几批买入">
              <Input value={form.buy_batches} onChange={p('buy_batches')} placeholder="1" />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setErr('')
                try { await suggestPositionSize() } catch (e) { setErr(e instanceof Error ? e.message : '仓位建议失败') }
              }}
              disabled={suggestingSize}
              className="btn-ghost text-xs"
            >
              {suggestingSize ? '计算中…' : '一键建议仓位'}
            </button>
            <span className="text-[11px] text-ink-muted">按单笔风险预算自动计算建议股数与金额</span>
          </div>
          {positionSuggestion && (
            <div className="rounded-md border border-terminal-border p-3 bg-terminal-muted/60 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>建议股数：<span className="text-ink-primary font-mono">{positionSuggestion.suggested_volume}</span> 股</div>
                <div>建议金额：<span className="text-ink-primary font-mono">{formatAmount(positionSuggestion.suggested_amount)}</span></div>
                <div>建议仓位：<span className="text-ink-primary font-mono">{positionSuggestion.suggested_position_pct.toFixed(2)}%</span></div>
                <div>每股风险：<span className="text-ink-primary font-mono">¥{positionSuggestion.risk_per_share.toFixed(2)}</span></div>
              </div>
              <p className="mt-2 text-ink-muted">{positionSuggestion.advice}</p>
            </div>
          )}

          {riskProfile && (
            <div className="rounded-md border border-terminal-border p-3 bg-terminal-muted/60">
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-2">新手默认风控</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Input
                  value={String(riskProfile.risk_per_trade_pct)}
                  onChange={(v) => setRiskProfile(pf => pf ? ({ ...pf, risk_per_trade_pct: Number(v) || 0 }) : pf)}
                  placeholder="单笔风险(%)"
                />
                <Input
                  value={String(riskProfile.max_position_pct)}
                  onChange={(v) => setRiskProfile(pf => pf ? ({ ...pf, max_position_pct: Number(v) || 0 }) : pf)}
                  placeholder="单票上限(%)"
                />
                <Input
                  value={String(riskProfile.account_size)}
                  onChange={(v) => setRiskProfile(pf => pf ? ({ ...pf, account_size: Number(v) || 0 }) : pf)}
                  placeholder="总资产"
                />
              </div>
              <button
                type="button"
                onClick={saveRiskDefaults}
                disabled={savingProfile}
                className="btn-ghost text-xs"
              >
                {savingProfile ? '保存中…' : '保存默认参数'}
              </button>
            </div>
          )}

          {/* 策略理由 */}
          <Field label="买入逻辑">
            <textarea
              value={form.reason} onChange={e => p('reason')(e.target.value)}
              placeholder="为什么要买这只股票？技术面/基本面/催化剂…"
              rows={2}
              className="w-full bg-terminal-muted border border-terminal-border rounded-md px-3 py-2 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-colors resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="催化剂/预期事件">
              <Input value={form.catalyst} onChange={p('catalyst')} placeholder="如：业绩预告、政策催化…" />
            </Field>
            <Field label="计划有效期">
              <Input type="date" value={form.valid_until} onChange={p('valid_until')} />
            </Field>
          </div>

          <Field label="自定义触发条件（备注）">
            <Input value={form.custom_note} onChange={p('custom_note')} placeholder="如：量能放大 + 收复 MA20" />
          </Field>

          <div className="rounded-md border border-terminal-border p-3 bg-terminal-muted/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-ink-muted uppercase tracking-wider">交易前检查清单</p>
              <button type="button" onClick={async () => {
                setErr('')
                try { await runPrecheck() } catch (e) { setErr(e instanceof Error ? e.message : '检查失败') }
              }} className="btn-ghost text-xs">运行检查</button>
            </div>
            {!precheckResult ? (
              <p className="text-xs text-ink-muted">点击“运行检查”后会显示下单前风控结果。</p>
            ) : (
              <div className="space-y-2 text-xs">
                {[
                  ['有止损价', precheckResult.checklist.has_stop_loss],
                  ['有目标价', precheckResult.checklist.has_target_price],
                  ['亏损在预算内', precheckResult.checklist.has_risk_budget],
                  ['已填写买入理由', precheckResult.checklist.has_reason],
                  ['仓位不超上限', precheckResult.checklist.position_in_bounds],
                  ['未触发当日熔断', precheckResult.checklist.can_open_new_position],
                ].map(([label, ok]) => (
                  <div key={String(label)} className={`flex items-center justify-between rounded px-2 py-1 ${ok ? 'bg-accent-green/10' : 'bg-accent-red/10'}`}>
                    <span>{label}</span>
                    <span className={ok ? 'text-accent-green' : 'text-accent-red'}>{ok ? '通过' : '未通过'}</span>
                  </div>
                ))}
                <div className="rounded border border-terminal-border p-2 bg-terminal-surface">
                  <div>最坏亏损：<span className="text-accent-red font-mono">{formatAmount(precheckResult.worst_loss_amount)}</span>（{precheckResult.worst_loss_pct.toFixed(2)}%）</div>
                  <div>允许亏损：<span className="text-ink-secondary font-mono">{formatAmount(precheckResult.allowed_loss_amount)}</span></div>
                  <div>单票上限：<span className="text-ink-secondary font-mono">{formatAmount(precheckResult.max_position_amount)}</span>（最多 {precheckResult.max_position_volume} 股）</div>
                  <div>预估股数：<span className="text-ink-secondary font-mono">{precheckResult.estimated_volume}</span> 股</div>
                  {precheckResult.suggested_adjust_volume > 0 && (
                    <div className="mt-1">
                      建议调整：<span className="text-accent-amber font-mono">{precheckResult.suggested_adjust_volume}</span> 股（约 {formatAmount(precheckResult.suggested_adjust_amount)}）
                      <button
                        type="button"
                        className="btn-ghost text-xs ml-2"
                        onClick={() => setForm(f => ({ ...f, planned_amount: String(precheckResult.suggested_adjust_amount) }))}
                      >
                        应用建议仓位
                      </button>
                    </div>
                  )}
                  <div className="mt-1 text-ink-muted">{precheckResult.advice}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {err && <div className="px-5 pb-3"><ErrorBanner message={err} /></div>}
        {!err && dailyRiskState?.status === 'BLOCK' && (
          <div className="px-5 pb-3">
            <ErrorBanner message={dailyRiskState.message || '当日亏损触发熔断，仅限制买入开仓（卖出/减仓不受影响）'} />
          </div>
        )}

        <div className="flex gap-3 px-5 pb-5 flex-shrink-0">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
          <button onClick={handleSave} disabled={loading || dailyRiskState?.status === 'BLOCK'} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {loading ? '保存中…' : '保存计划'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 计划卡片 ──────────────────────────────────────────────────────

interface PlanCardProps {
  plan: BuyPlan
  blockNewBuy: boolean
  blockReason?: string
  onEdit: (p: BuyPlan) => void
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: BuyPlanStatus) => void
}

function PlanCard({ plan, blockNewBuy, blockReason, onEdit, onDelete, onStatusChange }: PlanCardProps) {
  const navigate   = useNavigate()
  const cfg        = STATUS_CONFIG[plan.status]
  const StatusIcon = cfg.icon
  const isActive   = plan.status === 'WATCHING' || plan.status === 'READY'

  const distColor = (pct: number | null | undefined) => {
    if (pct == null) return 'text-ink-muted'
    return pct > 0 ? 'text-accent-green' : pct > -3 ? 'text-accent-amber' : 'text-accent-red'
  }

  return (
    <div className={`card p-0 overflow-hidden transition-all duration-200 ${
      plan.trigger_hit ? 'ring-1 ring-accent-amber/50 shadow-[0_0_12px_rgba(255,170,0,0.12)]' : ''
    }`}>
      {/* 触发提示条 */}
      {plan.trigger_hit && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-amber/10 border-b border-accent-amber/30">
          <AlertCircle size={12} className="text-accent-amber animate-pulse" />
          <span className="text-xs font-mono text-accent-amber">价格已到达买入区间，可考虑入场</span>
        </div>
      )}

      <div className="p-4">
        {/* 顶部：股票 + 状态 */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => navigate(`/stocks/${plan.stock_code}`)}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-ink-primary">{plan.stock_name || plan.stock_code}</span>
                <ExternalLink size={10} className="text-ink-muted opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <span className="text-xs font-mono text-ink-muted">{plan.stock_code}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {plan.current_price != null && (
              <span className="text-sm font-mono font-semibold text-ink-primary">
                ¥{formatPrice(plan.current_price)}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
              <StatusIcon size={10} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* 核心价位 */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="px-3 py-2 bg-terminal-muted rounded-md border border-terminal-border">
            <div className="text-[10px] font-mono text-ink-muted mb-0.5">买入价</div>
            <div className="text-sm font-mono font-semibold text-accent-blue">
              {plan.buy_price != null ? `¥${fmt(plan.buy_price)}` : '市价'}
              {plan.buy_price_high != null && <span className="text-xs text-ink-muted"> ~ ¥{fmt(plan.buy_price_high)}</span>}
            </div>
            {plan.dist_to_buy_pct != null && (
              <div className={`text-[10px] font-mono mt-0.5 ${distColor(plan.dist_to_buy_pct)}`}>
                {plan.dist_to_buy_pct > 0 ? '↑' : '↓'} {Math.abs(plan.dist_to_buy_pct).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-terminal-muted rounded-md border border-terminal-border">
            <div className="text-[10px] font-mono text-ink-muted mb-0.5">目标价</div>
            <div className="text-sm font-mono font-semibold text-accent-green">
              {plan.target_price != null ? `¥${fmt(plan.target_price)}` : '—'}
            </div>
            {plan.expected_return_pct != null && (
              <div className="text-[10px] font-mono text-accent-green mt-0.5">
                +{fmt(plan.expected_return_pct, 1)}%
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-terminal-muted rounded-md border border-terminal-border">
            <div className="text-[10px] font-mono text-ink-muted mb-0.5">止损价</div>
            <div className="text-sm font-mono font-semibold text-accent-red">
              {plan.stop_loss_price != null ? `¥${fmt(plan.stop_loss_price)}` : '—'}
            </div>
            {plan.rr_calc != null ? (
              <div className={`text-[10px] font-mono mt-0.5 ${rrColor(plan.rr_calc)}`}>
                盈亏比 1:{plan.rr_calc.toFixed(1)}
              </div>
            ) : plan.risk_reward_ratio != null ? (
              <div className={`text-[10px] font-mono mt-0.5 ${rrColor(plan.risk_reward_ratio)}`}>
                盈亏比 1:{plan.risk_reward_ratio.toFixed(1)}
              </div>
            ) : null}
          </div>
        </div>

        {/* 仓位 & 理由 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs font-mono text-ink-muted">
          {plan.planned_amount != null && (
            <span>计划 <span className="text-ink-secondary">{formatAmount(plan.planned_amount)}</span></span>
          )}
          {plan.position_ratio != null && (
            <span>仓位 <span className="text-ink-secondary">{plan.position_ratio}%</span></span>
          )}
          {plan.buy_batches > 1 && (
            <span>分 <span className="text-ink-secondary">{plan.buy_batches}</span> 批</span>
          )}
          {plan.valid_until && (
            <span>有效至 <span className="text-ink-secondary">{plan.valid_until.slice(0, 10)}</span></span>
          )}
        </div>

        {plan.reason && (
          <p className="text-xs text-ink-muted bg-terminal-muted px-3 py-2 rounded-md border border-terminal-border mb-3 leading-relaxed line-clamp-2">
            💡 {plan.reason}
          </p>
        )}

        {plan.trigger_conditions?.custom_note && (
          <p className="text-xs text-accent-blue bg-accent-blue/5 border border-accent-blue/20 px-3 py-1.5 rounded-md mb-3">
            触发条件：{plan.trigger_conditions.custom_note}
          </p>
        )}

        {/* 操作栏 */}
        <div className="flex items-center gap-2 pt-2 border-t border-terminal-border">
          <button
            onClick={() => onEdit(plan)}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary transition-colors px-2 py-1 rounded hover:bg-terminal-muted"
          >
            <Pencil size={11} /> 编辑
          </button>

          {isActive && (
            <button
              disabled={blockNewBuy}
              onClick={() => onStatusChange(plan.id, 'EXECUTED')}
              className="flex items-center gap-1 text-xs text-accent-green hover:text-accent-green/80 transition-colors px-2 py-1 rounded hover:bg-accent-green/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title={blockNewBuy ? blockReason || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）' : undefined}
            >
              <CheckCircle2 size={11} /> 标记已执行
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onStatusChange(plan.id, 'ABANDONED')}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent-red transition-colors px-2 py-1 rounded hover:bg-terminal-muted"
            >
              <Ban size={11} /> 放弃
            </button>
          )}
          {!isActive && (
            <button
              onClick={() => onStatusChange(plan.id, 'WATCHING')}
              className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors px-2 py-1 rounded hover:bg-accent-blue/10"
            >
              <Clock size={11} /> 重新观察
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={() => {
              if (confirm(`确认删除 ${plan.stock_name || plan.stock_code} 的买入计划？`))
                onDelete(plan.id)
            }}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent-red transition-colors px-2 py-1 rounded hover:bg-terminal-muted"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 统计条 ────────────────────────────────────────────────────────

function StatsBar({ plans }: { plans: BuyPlan[] }) {
  const ready    = plans.filter(p => p.trigger_hit).length
  const watching = plans.filter(p => p.status === 'WATCHING').length
  const avgRR    = plans
    .filter(p => (p.rr_calc ?? p.risk_reward_ratio) != null)
    .map(p => p.rr_calc ?? p.risk_reward_ratio ?? 0)
  const meanRR   = avgRR.length ? avgRR.reduce((a, b) => a + b, 0) / avgRR.length : null

  if (plans.length === 0) return null

  return (
    <div className="flex items-center gap-6 px-4 py-2.5 bg-terminal-muted/40 border border-terminal-border rounded-lg text-xs font-mono mb-4">
      <span className="flex items-center gap-1.5 text-ink-muted">
        <Target size={11} />
        <span className="text-ink-primary font-semibold">{plans.length}</span> 个计划
      </span>
      {ready > 0 && (
        <span className="flex items-center gap-1.5 text-accent-amber animate-pulse">
          <AlertCircle size={11} />
          <span className="font-semibold">{ready}</span> 个已触发买点
        </span>
      )}
      <span className="flex items-center gap-1.5 text-ink-muted">
        <Clock size={11} />
        <span className="text-ink-secondary">{watching}</span> 观察中
      </span>
      {meanRR != null && (
        <span className="flex items-center gap-1.5 text-ink-muted">
          <Layers size={11} />
          平均盈亏比 <span className={`font-semibold ml-0.5 ${rrColor(meanRR)}`}>1:{meanRR.toFixed(1)}</span>
        </span>
      )}
    </div>
  )
}

function ExposurePanel({ exposure }: { exposure: PortfolioExposureResult | null | undefined }) {
  if (!exposure) return null
  return (
    <div className="mb-4 rounded-lg border border-terminal-border bg-terminal-muted/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-ink-muted">行业集中度（上限 {exposure.sector_limit_pct}%）</div>
        <div className={`text-xs font-mono ${exposure.has_over_limit ? 'text-accent-red' : 'text-accent-green'}`}>
          {exposure.has_over_limit ? '超限' : '安全'}
        </div>
      </div>
      {exposure.items.length === 0 ? (
        <div className="text-xs text-ink-muted">暂无持仓暴露数据</div>
      ) : (
        <div className="space-y-1">
          {exposure.items.slice(0, 5).map((it) => (
            <div key={it.sector} className="flex items-center justify-between text-xs">
              <div className="text-ink-secondary">{it.sector}（{it.position_count}只）</div>
              <div className={it.over_limit ? 'text-accent-red font-semibold' : 'text-ink-primary'}>
                {it.exposure_pct.toFixed(1)}% · {formatAmount(it.exposure_amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DailyRiskBanner({ state }: { state: DailyRiskState | null | undefined }) {
  if (!state) return null
  const tone = state.status === 'BLOCK'
    ? 'border-accent-red text-accent-red bg-accent-red/10'
    : state.status === 'WARN'
      ? 'border-accent-amber text-accent-amber bg-accent-amber/10'
      : 'border-accent-green text-accent-green bg-accent-green/10'
  return (
    <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${tone}`}>
      <div className="font-mono">当日风控状态：{state.status}</div>
      <div className="mt-1">
        今日已实现盈亏 {formatAmount(state.today_realized_pnl)} · 当日亏损 {formatAmount(state.daily_loss_amount)} / 阈值 {formatAmount(state.loss_limit_amount)}
      </div>
      <div className="mt-1">{state.message}</div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────

type TabKey = 'active' | 'done'

export default function BuyPlanPage() {
  const [tab, setTab]         = useState<TabKey>('active')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<BuyPlan | null>(null)

  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchBuyPlans(tab === 'active' ? 'active' : 'done'), [tab]),
    { refetchInterval: tab === 'active' ? 30_000 : undefined },
  )
  const { data: exposureData } = useQuery(
    useCallback(() => fetchPortfolioExposure(), []),
    { refetchInterval: 60_000 },
  )
  const { data: dailyRiskData } = useQuery(
    useCallback(() => fetchDailyRiskState(), []),
    { refetchInterval: 30_000 },
  )

  const plans = data?.items ?? []

  const handleCreate = async (req: CreateBuyPlanRequest) => {
    await createBuyPlan(req)
    refetch()
  }

  const handleUpdate = async (req: UpdateBuyPlanRequest) => {
    if (!editTarget) return
    await updateBuyPlan(editTarget.id, req)
    refetch()
  }

  const handleStatusChange = async (id: number, status: BuyPlanStatus) => {
    try {
      await updateBuyPlanStatus(id, status)
      refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await (await import('@/api/buyPlan')).deleteBuyPlan(id)
      refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    }
  }

  const openEdit = (p: BuyPlan) => { setEditTarget(p); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditTarget(null) }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="买入计划"
        subtitle={`${plans.length} 个计划 · 每 30s 刷新`}
        onRefresh={refetch}
        loading={loading}
        actions={
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            disabled={dailyRiskData?.status === 'BLOCK'}
            title={dailyRiskData?.status === 'BLOCK' ? (dailyRiskData.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> 新建计划
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col p-5">
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-4">
          {([['active', '进行中', TrendingUp], ['done', '已结束', TrendingDown]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 border ${
                tab === key
                  ? 'bg-terminal-muted border-terminal-border text-ink-primary'
                  : 'border-transparent text-ink-muted hover:text-ink-secondary hover:bg-terminal-muted/50'
              }`}
            >
              <Icon size={13} />
              {label}
              {tab === key && (
                <span className="ml-1 text-[10px] font-mono text-ink-muted bg-terminal-surface px-1.5 py-0.5 rounded border border-terminal-border">
                  {plans.length}
                </span>
              )}
            </button>
          ))}
          <ChevronRight size={13} className="my-auto text-ink-muted opacity-30" />
          <span className="my-auto text-xs text-ink-muted font-mono">点击卡片股票名跳转详情</span>
        </div>

        {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

        {/* 统计条 */}
        {!loading && <StatsBar plans={plans} />}
        <DailyRiskBanner state={dailyRiskData} />
        <ExposurePanel exposure={exposureData} />

        {/* 计划卡片网格 */}
        <div className="flex-1 overflow-y-auto">
          {loading && plans.length === 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3">
                  <table><tbody><SkeletonRow cols={1} /></tbody></table>
                  <table><tbody><SkeletonRow cols={3} /></tbody></table>
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState message={tab === 'active' ? '暂无进行中的买入计划，点击右上角「新建计划」' : '暂无已结束的计划'} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  blockNewBuy={dailyRiskData?.status === 'BLOCK'}
                  blockReason={dailyRiskData?.message}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <PlanForm
          initial={editTarget ?? undefined}
          dailyRiskState={dailyRiskData}
          onSave={editTarget ? handleUpdate as (d: CreateBuyPlanRequest | UpdateBuyPlanRequest) => Promise<void> : handleCreate as (d: CreateBuyPlanRequest | UpdateBuyPlanRequest) => Promise<void>}
          onClose={closeForm}
        />
      )}
    </div>
  )
}
