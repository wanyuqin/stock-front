import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Target, AlertCircle, CheckCircle2, Clock, Ban, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { fetchBuyPlansByCode, createBuyPlan, updateBuyPlan, updateBuyPlanStatus, deleteBuyPlan } from '@/api/buyPlan'
import { fetchDailyRiskState } from '@/api/risk'
import { EmptyState } from '@/components/shared'
import type { BuyPlan, BuyPlanStatus } from '@/types/buy_plan'

// ── 状态配置 ──────────────────────────────────────────────────────

const STATUS_CFG: Record<BuyPlanStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  WATCHING:  { label: '观察中', color: 'text-accent-blue',  bg: 'bg-accent-blue/10 border-accent-blue/30',   icon: Clock },
  READY:     { label: '已到位', color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/30', icon: AlertCircle },
  EXECUTED:  { label: '已执行', color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/30', icon: CheckCircle2 },
  ABANDONED: { label: '已放弃', color: 'text-ink-muted',    bg: 'bg-terminal-muted border-terminal-border',  icon: Ban },
  EXPIRED:   { label: '已过期', color: 'text-ink-muted',    bg: 'bg-terminal-muted border-terminal-border',  icon: Ban },
}

function fmt(v: number | null | undefined, d = 2) { return v == null ? '—' : v.toFixed(d) }
function rrColor(rr: number) { return rr >= 3 ? 'text-accent-green' : rr >= 2 ? 'text-accent-amber' : 'text-accent-red' }

// ── 简化创建弹框（内嵌到面板，无全屏遮罩） ────────────────────────

interface QuickFormProps {
  code: string
  stockName: string
  currentPrice?: number
  blockNewBuy?: boolean
  blockReason?: string
  onSave: (req: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}

function QuickForm({ code, stockName, currentPrice, blockNewBuy, blockReason, onSave, onCancel }: QuickFormProps) {
  const [f, setF] = useState({
    buy_price: currentPrice ? String((currentPrice * 0.97).toFixed(2)) : '',
    target_price: currentPrice ? String((currentPrice * 1.12).toFixed(2)) : '',
    stop_loss_price: currentPrice ? String((currentPrice * 0.92).toFixed(2)) : '',
    planned_amount: '',
    position_ratio: '',
    reason: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const p = (k: string) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  const buy = parseFloat(f.buy_price)
  const tgt = parseFloat(f.target_price)
  const stp = parseFloat(f.stop_loss_price)
  const rrPrev = (!isNaN(buy) && !isNaN(tgt) && !isNaN(stp) && buy > stp)
    ? ((tgt - buy) / (buy - stp)).toFixed(1) : null

  const handleSave = async () => {
    if (blockNewBuy) { setErr(blockReason || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）'); return }
    if (!f.buy_price) { setErr('请填写买入价'); return }
    setSaving(true); setErr('')
    try {
      const payload: Record<string, unknown> = { stock_code: code }
      if (f.buy_price)       payload.buy_price       = parseFloat(f.buy_price)
      if (f.target_price)    payload.target_price    = parseFloat(f.target_price)
      if (f.stop_loss_price) payload.stop_loss_price = parseFloat(f.stop_loss_price)
      if (f.planned_amount)  payload.planned_amount  = parseFloat(f.planned_amount)
      if (f.position_ratio)  payload.position_ratio  = parseFloat(f.position_ratio)
      if (f.reason)          payload.reason          = f.reason
      await onSave(payload)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-terminal-surface border border-terminal-border rounded px-2.5 py-1.5 text-xs font-mono text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20'

  return (
    <div className="border border-terminal-border rounded-lg p-3 bg-terminal-muted/30 mb-3 space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
          <Target size={11} className="text-accent-amber" />
          新建计划 · {stockName}
        </span>
        <button onClick={onCancel} className="text-ink-muted hover:text-ink-primary text-xs">取消</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[10px] text-ink-muted mb-1">买入价</div>
          <input className={inp} value={f.buy_price} onChange={e => p('buy_price')(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <div className="text-[10px] text-ink-muted mb-1">目标价</div>
          <input className={inp} value={f.target_price} onChange={e => p('target_price')(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <div className="text-[10px] text-ink-muted mb-1">止损价</div>
          <input className={inp} value={f.stop_loss_price} onChange={e => p('stop_loss_price')(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {rrPrev && (
        <div className={`text-[10px] font-mono ${rrColor(parseFloat(rrPrev))}`}>
          盈亏比 1:{rrPrev}  ·  预期收益 +{(((tgt - buy) / buy) * 100).toFixed(1)}%
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-ink-muted mb-1">计划金额（元）</div>
          <input className={inp} value={f.planned_amount} onChange={e => p('planned_amount')(e.target.value)} placeholder="如 50000" />
        </div>
        <div>
          <div className="text-[10px] text-ink-muted mb-1">仓位占比（%）</div>
          <input className={inp} value={f.position_ratio} onChange={e => p('position_ratio')(e.target.value)} placeholder="如 10" />
        </div>
      </div>

      <div>
        <div className="text-[10px] text-ink-muted mb-1">买入逻辑</div>
        <textarea
          className={`${inp} resize-none`} rows={2}
          value={f.reason} onChange={e => p('reason')(e.target.value)}
          placeholder="技术面/基本面/催化剂…"
        />
      </div>

      {err && <p className="text-[10px] text-accent-red font-mono">{err}</p>}

      <button
        onClick={handleSave} disabled={saving || blockNewBuy}
        className="w-full py-1.5 rounded bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-medium hover:bg-accent-amber/20 transition-colors disabled:opacity-50"
        title={blockNewBuy ? (blockReason || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
      >
        {saving ? '保存中…' : '保存计划'}
      </button>
    </div>
  )
}

// ── 计划行 ────────────────────────────────────────────────────────

interface PlanRowProps {
  plan: BuyPlan
  blockNewBuy?: boolean
  blockReason?: string
  onStatusChange: (id: number, s: BuyPlanStatus) => void
  onDelete: (id: number) => void
  onEditFull: () => void
}

function PlanRow({ plan, blockNewBuy, blockReason, onStatusChange, onDelete, onEditFull }: PlanRowProps) {
  const cfg    = STATUS_CFG[plan.status]
  const SIcon  = cfg.icon
  const isActive = plan.status === 'WATCHING' || plan.status === 'READY'

  return (
    <div className={`border border-terminal-border rounded-lg p-3 mb-2 transition-all ${
      plan.trigger_hit ? 'ring-1 ring-accent-amber/50 bg-accent-amber/5' : 'bg-terminal-surface'
    }`}>
      {/* 触发提示 */}
      {plan.trigger_hit && (
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono text-accent-amber">
          <AlertCircle size={10} className="animate-pulse" /> 已到买入区间
        </div>
      )}

      {/* 状态 + 价格 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
          <SIcon size={9} />{cfg.label}
        </span>
        {plan.current_price != null && (
          <span className="text-xs font-mono text-ink-secondary">
            现价 <span className="text-ink-primary font-semibold">¥{plan.current_price.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* 三价 */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono mb-2">
        <div className="text-center">
          <div className="text-ink-muted mb-0.5">买入价</div>
          <div className="text-accent-blue font-semibold">
            {plan.buy_price != null ? `¥${fmt(plan.buy_price)}` : '市价'}
          </div>
          {plan.dist_to_buy_pct != null && (
            <div className={plan.dist_to_buy_pct > 0 ? 'text-accent-red' : 'text-accent-green'}>
              {plan.dist_to_buy_pct > 0 ? '↑' : '↓'}{Math.abs(plan.dist_to_buy_pct).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-ink-muted mb-0.5">目标价</div>
          <div className="text-accent-green font-semibold">{plan.target_price != null ? `¥${fmt(plan.target_price)}` : '—'}</div>
          {plan.expected_return_pct != null && (
            <div className="text-accent-green">+{fmt(plan.expected_return_pct, 1)}%</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-ink-muted mb-0.5">止损价</div>
          <div className="text-accent-red font-semibold">{plan.stop_loss_price != null ? `¥${fmt(plan.stop_loss_price)}` : '—'}</div>
          {(plan.rr_calc ?? plan.risk_reward_ratio) != null && (
            <div className={rrColor(plan.rr_calc ?? plan.risk_reward_ratio ?? 0)}>
              1:{(plan.rr_calc ?? plan.risk_reward_ratio)?.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      {plan.reason && (
        <p className="text-[10px] text-ink-muted leading-relaxed mb-2 line-clamp-1">💡 {plan.reason}</p>
      )}

      {/* 操作 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isActive && (
          <button
            disabled={blockNewBuy}
            onClick={() => onStatusChange(plan.id, 'EXECUTED')}
            className="text-[10px] font-mono text-accent-green px-2 py-0.5 rounded border border-accent-green/30 hover:bg-accent-green/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={blockNewBuy ? (blockReason || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
          >
            <CheckCircle2 size={9} className="inline mr-0.5" />已执行
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onStatusChange(plan.id, 'ABANDONED')}
            className="text-[10px] font-mono text-ink-muted px-2 py-0.5 rounded border border-terminal-border hover:bg-terminal-muted transition-colors"
          >
            放弃
          </button>
        )}
        {!isActive && (
          <button
            onClick={() => onStatusChange(plan.id, 'WATCHING')}
            className="text-[10px] font-mono text-accent-blue px-2 py-0.5 rounded border border-accent-blue/30 hover:bg-accent-blue/10 transition-colors"
          >
            重新观察
          </button>
        )}
        <button onClick={onEditFull} className="ml-auto text-ink-muted hover:text-ink-primary transition-colors">
          <Pencil size={10} />
        </button>
        <button
          onClick={() => { if (confirm('确认删除此计划？')) onDelete(plan.id) }}
          className="text-ink-muted hover:text-accent-red transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────────────

interface BuyPlanPanelProps {
  code: string
  stockName?: string
  currentPrice?: number
}

export default function BuyPlanPanel({ code, stockName = code, currentPrice }: BuyPlanPanelProps) {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const { data: dailyRiskState } = useQuery(
    useCallback(() => fetchDailyRiskState(), []),
    { refetchInterval: 30_000 },
  )

  const { data, refetch } = useQuery(
    useCallback(() => fetchBuyPlansByCode(code), [code]),
  )

  const plans = data?.items ?? []
  const active = plans.filter(p => p.status === 'WATCHING' || p.status === 'READY')
  const done   = plans.filter(p => p.status !== 'WATCHING' && p.status !== 'READY')

  const handleCreate = async (req: Record<string, unknown>) => {
    await createBuyPlan(req as import('@/types/buy_plan').CreateBuyPlanRequest)
    refetch()
    setShowForm(false)
  }

  const handleStatusChange = async (id: number, status: BuyPlanStatus) => {
    await updateBuyPlanStatus(id, status)
    refetch()
  }

  const handleDelete = async (id: number) => {
    await deleteBuyPlan(id)
    refetch()
  }

  return (
    <div className="p-3">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-ink-muted">
          {plans.length > 0 ? `${active.length} 个进行中` : '暂无计划'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/buy-plans')}
            className="text-[10px] font-mono text-ink-muted hover:text-ink-primary transition-colors flex items-center gap-0.5"
          >
            全部计划 <ChevronRight size={9} />
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            disabled={dailyRiskState?.status === 'BLOCK'}
            title={dailyRiskState?.status === 'BLOCK' ? (dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
            className="flex items-center gap-1 text-[10px] font-mono text-accent-amber hover:text-accent-amber/80 px-2 py-1 rounded border border-accent-amber/30 hover:bg-accent-amber/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={9} /> 新建
          </button>
        </div>
      </div>
      {dailyRiskState?.status === 'BLOCK' && (
        <p className="text-[10px] font-mono text-accent-red mb-2">{dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）'}</p>
      )}

      {/* 快速创建表单 */}
      {showForm && (
        <QuickForm
          code={code}
          stockName={stockName}
          currentPrice={currentPrice}
          blockNewBuy={dailyRiskState?.status === 'BLOCK'}
          blockReason={dailyRiskState?.message}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 计划列表 */}
      {plans.length === 0 && !showForm && (
        <EmptyState message="暂无买入计划，点击「新建」设置买点" />
      )}

      {active.length > 0 && (
        <>
          <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">进行中</div>
          {active.map(p => (
            <PlanRow
              key={p.id}
              plan={p}
              blockNewBuy={dailyRiskState?.status === 'BLOCK'}
              blockReason={dailyRiskState?.message}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onEditFull={() => navigate('/buy-plans')}
            />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2 mt-3">已结束</div>
          {done.slice(0, 3).map(p => (
            <PlanRow
              key={p.id}
              plan={p}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onEditFull={() => navigate('/buy-plans')}
            />
          ))}
          {done.length > 3 && (
            <button
              onClick={() => navigate('/buy-plans')}
              className="w-full text-[10px] font-mono text-ink-muted hover:text-ink-primary py-2 text-center transition-colors"
            >
              查看全部 {done.length} 个历史计划 →
            </button>
          )}
        </>
      )}
    </div>
  )
}
