import { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Star, TrendingUp, TrendingDown, Activity, ExternalLink,
  Shield, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  Wallet, BarChart2, Target, Sunset, RefreshCw, Sparkles,
  BookOpen, ChevronRight,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import DailyReportView from '@/components/DailyReportView'
import AlertPanel from '@/components/AlertPanel'
import MarketSentimentBar from '@/components/MarketSentimentBar'
import { useQuery } from '@/hooks/useQuery'
import { fetchWatchlist } from '@/api/stock'
import http from '@/api/http'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, SkeletonRow, ErrorBanner,
} from '@/components/shared'
import type { ApiResponse } from '@/types'

// ── 类型 ──────────────────────────────────────────────────────────

interface PerformanceData {
  total_pnl: number
  total_realized_pnl: number
  total_unrealized_pnl: number
  total_trades: number
  win_positions: number
  lose_positions: number
  positions: Array<{
    stock_code: string
    hold_volume: number
    avg_cost_price: number
    current_price: number
    unrealized_pnl: number
    unrealized_pct: number
    realized_pnl: number
    total_pnl: number
  }>
}

interface DailyRiskState {
  status: 'SAFE' | 'WARN' | 'BLOCK'
  daily_loss_amount: number
  loss_limit_amount: number
  today_buy_open_count: number
  max_buy_open_per_day: number
  consecutive_loss_days: number
  message: string
  remaining_loss_amount: number
}

interface GuardianItem {
  stock_code: string
  stock_name: string
  signal: 'STOP_LOSS' | 'SELL' | 'SELL_T' | 'BUY_T' | 'HOLD'
  health_score: number
  snapshot: { pnl_pct: number; price: number }
}

interface TodoItem {
  id: string
  stock_code: string
  stock_name: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  action_hint: string
  event_type: string
  done: boolean
}

interface TodoResult {
  total: number
  pending: number
  items: TodoItem[]
}

interface BuyPlanData {
  total: number
  items: Array<{ stock_code: string; stock_name: string; status: string; trigger_hit: boolean }>
}

interface WeeklyReviewData {
  total_trades: number
  win_rate: number
  realized_pnl: number
  max_drawdown_pct: number
  summary: string
  suggestions: string[]
  top_issues: Array<{ key: string; label: string; count: number }>
  from_date: string
  to_date: string
}

// ── API ───────────────────────────────────────────────────────────
const fetchPerformance  = () => http.get<ApiResponse<PerformanceData>>('/stats/performance')
const fetchDailyRisk    = () => http.get<ApiResponse<DailyRiskState>>('/risk/daily-state')
const fetchGuardian     = () => http.get<ApiResponse<{ items: GuardianItem[] }>>('/positions/diagnose')
const fetchTodo         = () => http.get<ApiResponse<TodoResult>>('/risk/today-todo')
const fetchActivePlans  = () => http.get<ApiResponse<BuyPlanData>>('/buy-plans?status=active')
const fetchWeekly       = () => http.get<ApiResponse<WeeklyReviewData>>('/risk/weekly-review?days=1')

// ── 工具 ──────────────────────────────────────────────────────────
const pnlColor  = (v: number) => v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const pnlSign   = (v: number) => v > 0 ? '+' : ''
const fmtPnl    = (v: number) => `${pnlSign(v)}${formatAmount(Math.abs(v))}`
const fmtPct    = (v: number) => `${pnlSign(v)}${v.toFixed(2)}%`

// 判断是否为盘后时间（15:00 后 或非交易时段）
function isAfterMarket(): boolean {
  const now = new Date()
  const h = now.getHours(), m = now.getMinutes()
  const totalMin = h * 60 + m
  return totalMin >= 15 * 60  // 15:00 之后
}

// ── 收盘总结卡 ────────────────────────────────────────────────────
function ClosingSummaryCard() {
  const navigate = useNavigate()
  const [perf,    setPerf]    = useState<PerformanceData | null>(null)
  const [risk,    setRisk]    = useState<DailyRiskState | null>(null)
  const [weekly,  setWeekly]  = useState<WeeklyReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([fetchPerformance(), fetchDailyRisk(), fetchWeekly()])
      .then(([p, r, w]) => {
        setPerf(p.data.data ?? null)
        setRisk(r.data.data ?? null)
        setWeekly(w.data.data ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // 盘中时间不显示
  if (!isAfterMarket() && !loading && !perf) return null

  if (loading) return (
    <div className="card p-5 animate-pulse space-y-2">
      <div className="h-4 bg-terminal-muted rounded w-32" />
      <div className="h-3 bg-terminal-muted rounded w-full" />
      <div className="h-3 bg-terminal-muted rounded w-4/5" />
    </div>
  )

  // 若没有今日交易，也不强制显示
  const todayTrades = weekly?.total_trades ?? 0
  const realizedToday = perf?.total_realized_pnl ?? 0
  const unrealized    = perf?.total_unrealized_pnl ?? 0
  const totalPnl      = perf?.total_pnl ?? 0

  // 生成简洁的收盘评语
  const getClosingMessage = () => {
    if (todayTrades === 0 && realizedToday === 0) return '今日未操作，保持观察。'
    if (realizedToday > 0 && (risk?.consecutive_loss_days ?? 0) === 0)
      return `盈利出局 ${fmtPnl(realizedToday)}，执行纪律，继续保持。`
    if (realizedToday < 0 && (risk?.consecutive_loss_days ?? 0) >= 1)
      return `今日亏损 ${fmtPnl(Math.abs(realizedToday))}，已连亏 ${risk?.consecutive_loss_days} 天，明日降低操作频率。`
    if (realizedToday < 0)
      return `今日亏损 ${fmtPnl(Math.abs(realizedToday))}，仍在风控范围内。`
    return `今日实现盈亏 ${fmtPnl(realizedToday)}。`
  }

  const riskState = risk?.status ?? 'SAFE'
  const headerColor = riskState === 'BLOCK' ? 'border-accent-red/40'
    : riskState === 'WARN' ? 'border-accent-amber/40'
    : totalPnl >= 0 ? 'border-accent-green/30' : 'border-accent-red/30'

  if (collapsed) return (
    <button
      onClick={() => setCollapsed(false)}
      className={`w-full card p-3 border ${headerColor} flex items-center justify-between text-xs font-mono`}
    >
      <span className="flex items-center gap-2 text-ink-secondary">
        <Sunset size={12} className="text-accent-amber" />
        今日收盘总结
      </span>
      <span className={`font-semibold ${pnlColor(totalPnl)}`}>
        {fmtPnl(totalPnl)} · 展开
      </span>
    </button>
  )

  return (
    <div className={`card p-5 border ${headerColor}`}>
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sunset size={14} className="text-accent-amber" />
          <span className="text-sm font-medium text-ink-primary">今日收盘总结</span>
          <span className="text-[10px] font-mono text-ink-muted">
            {new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-ink-muted hover:text-ink-secondary transition-colors">
            <RefreshCw size={11} />
          </button>
          <button onClick={() => setCollapsed(true)}
            className="text-[10px] font-mono text-ink-muted hover:text-ink-secondary transition-colors">
            收起
          </button>
        </div>
      </div>

      {/* 今日盈亏三格 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: '今日总盈亏', v: totalPnl },
          { label: '已实现',     v: realizedToday },
          { label: '持仓浮动',   v: unrealized },
        ].map(({ label, v }) => (
          <div key={label} className="bg-terminal-muted rounded-lg px-3 py-2.5">
            <p className="text-[9px] font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-base font-mono font-bold ${pnlColor(v)}`}>{fmtPnl(v)}</p>
          </div>
        ))}
      </div>

      {/* 收盘评语 */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent-amber/5 border border-accent-amber/20 mb-3">
        <Sparkles size={11} className="text-accent-amber mt-0.5 flex-shrink-0" />
        <p className="text-xs text-ink-secondary leading-relaxed">{getClosingMessage()}</p>
      </div>

      {/* 风控状态摘要 */}
      {risk && (
        <div className="flex items-center justify-between text-xs font-mono mb-3">
          <span className="text-ink-muted">今日风控</span>
          <span className={`px-2 py-0.5 rounded border ${
            riskState === 'BLOCK' ? 'border-accent-red/40 text-accent-red bg-accent-red/10' :
            riskState === 'WARN'  ? 'border-accent-amber/40 text-accent-amber bg-accent-amber/10' :
            'border-accent-green/40 text-accent-green bg-accent-green/10'
          }`}>
            {riskState === 'SAFE' ? '✓ 安全结束' : riskState === 'WARN' ? '⚠ 接近阈值' : '✕ 已触发熔断'}
          </span>
        </div>
      )}

      {/* 周度建议（折叠展开） */}
      {weekly?.suggestions && weekly.suggestions.length > 0 && (
        <div className="border-t border-terminal-border/50 pt-3">
          <button
            onClick={() => setShowFull(f => !f)}
            className="flex items-center gap-1.5 text-[10px] font-mono text-ink-muted hover:text-ink-secondary transition-colors mb-2"
          >
            <BookOpen size={10} />
            近期操作建议
            <ChevronRight size={9} className={`transition-transform ${showFull ? 'rotate-90' : ''}`} />
          </button>
          {showFull && (
            <ul className="space-y-1.5">
              {weekly.suggestions.slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink-muted">
                  <span className="text-ink-muted/50 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 跳转复盘 */}
      <button
        onClick={() => navigate('/review')}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-mono border border-terminal-border text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/30 transition-all"
      >
        <Activity size={11} /> 去深度复盘 →
      </button>
    </div>
  )
}

// ── 账户健康总览卡 ────────────────────────────────────────────────
function AccountHealthCard() {
  const navigate = useNavigate()
  const [perf,    setPref]    = useState<PerformanceData | null>(null)
  const [risk,    setRisk]    = useState<DailyRiskState | null>(null)
  const [guardian, setGuardian] = useState<GuardianItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([fetchPerformance(), fetchDailyRisk(), fetchGuardian()])
      .then(([p, r, g]) => {
        if (!active) return
        setPref(p.data.data ?? null)
        setRisk(r.data.data ?? null)
        setGuardian(g.data.data?.items ?? [])
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="card p-5 space-y-3 animate-pulse">
        {[60, 40, 80, 50].map((w, i) => (
          <div key={i} className="h-4 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }

  const holding    = perf?.positions.filter(p => p.hold_volume > 0) ?? []
  const stopCount  = guardian.filter(g => g.signal === 'STOP_LOSS').length
  const riskStatus = risk?.status ?? 'SAFE'
  const totalPnl   = perf?.total_pnl ?? 0

  let healthScore = 80
  if (stopCount > 0) healthScore -= stopCount * 20
  if (riskStatus === 'BLOCK') healthScore -= 25
  if (riskStatus === 'WARN')  healthScore -= 10
  if (totalPnl < 0 && perf) {
    const drawPct = Math.abs(totalPnl) / ((risk?.loss_limit_amount ?? 4000) * 50) * 100
    healthScore -= Math.min(drawPct, 20)
  }
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

  const scoreColor = healthScore >= 70 ? 'text-accent-green' : healthScore >= 45 ? 'text-accent-amber' : 'text-accent-red'
  const scoreBg    = healthScore >= 70 ? 'bg-accent-green/10 border-accent-green/30' : healthScore >= 45 ? 'bg-accent-amber/10 border-accent-amber/30' : 'bg-accent-red/10 border-accent-red/30'

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-accent-cyan" />
          <span className="text-sm font-medium text-ink-primary">账户状况</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${scoreBg} ${scoreColor}`}>
          <Shield size={10} />
          健康分 {healthScore}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="px-3 py-3 bg-terminal-muted rounded-lg">
          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">总盈亏</p>
          <p className={`text-lg font-mono font-semibold ${pnlColor(totalPnl)}`}>{fmtPnl(totalPnl)}</p>
        </div>
        <div className="px-3 py-3 bg-terminal-muted rounded-lg">
          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">已实现</p>
          <p className={`text-lg font-mono font-semibold ${pnlColor(perf?.total_realized_pnl ?? 0)}`}>
            {fmtPnl(perf?.total_realized_pnl ?? 0)}
          </p>
        </div>
        <div className="px-3 py-3 bg-terminal-muted rounded-lg">
          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">浮动</p>
          <p className={`text-lg font-mono font-semibold ${pnlColor(perf?.total_unrealized_pnl ?? 0)}`}>
            {fmtPnl(perf?.total_unrealized_pnl ?? 0)}
          </p>
        </div>
      </div>

      {risk && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono mb-4 ${
          riskStatus === 'BLOCK' ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' :
          riskStatus === 'WARN'  ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber' :
          'bg-accent-green/10 border-accent-green/30 text-accent-green'
        }`}>
          <span className="flex items-center gap-1.5">
            {riskStatus === 'SAFE' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
            当日风控 {riskStatus}
          </span>
          <span>亏损 {formatAmount(risk.daily_loss_amount)} / 阈值 {formatAmount(risk.loss_limit_amount)}</span>
        </div>
      )}

      {holding.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">当前持仓</p>
          {holding.map(pos => {
            const g = guardian.find(x => x.stock_code === pos.stock_code)
            const signal = g?.signal ?? 'HOLD'
            return (
              <div key={pos.stock_code}
                className="flex items-center justify-between py-2 border-b border-terminal-border/50 last:border-0 cursor-pointer group"
                onClick={() => navigate(`/guardian`)}>
                <div className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    signal === 'STOP_LOSS' ? 'bg-accent-red animate-pulse' :
                    signal === 'SELL' ? 'bg-accent-amber' : 'bg-accent-green'
                  }`} />
                  <span className="font-mono text-xs text-ink-secondary">{pos.stock_code}</span>
                  <span className="text-xs text-ink-primary">{g?.stock_name ?? '—'}</span>
                  {signal === 'STOP_LOSS' && (
                    <span className="text-[10px] font-mono text-accent-red bg-accent-red/10 px-1 py-0.5 rounded">止损</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono ${pnlColor(pos.unrealized_pct)}`}>{fmtPct(pos.unrealized_pct)}</span>
                  <span className={`text-xs font-mono ${pnlColor(pos.unrealized_pnl)}`}>{fmtPnl(pos.unrealized_pnl)}</span>
                  <ArrowRight size={11} className="text-ink-muted opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
          <BarChart2 size={12} className="opacity-40" />
          暂无持仓 · 去「买入计划」看机会
        </div>
      )}

      {stopCount > 0 && (
        <button onClick={() => navigate('/guardian')}
          className="mt-3 w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs font-mono hover:bg-accent-red/15 transition-colors">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={11} className="animate-pulse" />
            {stopCount} 只持仓已触发止损，立即处理
          </span>
          <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

// ── 今日待办卡 ────────────────────────────────────────────────────
function TodayTodoCard() {
  const navigate = useNavigate()
  const [todo, setTodo] = useState<TodoResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchTodo()
      .then(r => { if (active) setTodo(r.data.data ?? null) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="card p-5 animate-pulse space-y-2">
        <div className="h-4 bg-terminal-muted rounded w-40" />
        <div className="h-3 bg-terminal-muted rounded w-full" />
        <div className="h-3 bg-terminal-muted rounded w-3/4" />
      </div>
    )
  }

  const pending    = todo?.items.filter(t => !t.done) ?? []
  const highItems  = pending.filter(t => t.priority === 'HIGH').slice(0, 3)
  const otherItems = pending.filter(t => t.priority !== 'HIGH').slice(0, 2)
  const showItems  = [...highItems, ...otherItems].slice(0, 4)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-accent-amber" />
          <span className="text-sm font-medium text-ink-primary">今日待办</span>
        </div>
        {todo && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            todo.pending > 0
              ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
              : 'bg-accent-green/15 text-accent-green border-accent-green/30'
          }`}>
            {todo.pending > 0 ? `${todo.pending} 待处理` : '全部完成'}
          </span>
        )}
      </div>

      {showItems.length === 0 ? (
        <p className="text-xs text-ink-muted py-2">今日无待处理事项，状态良好</p>
      ) : (
        <div className="space-y-2">
          {showItems.map(item => (
            <div key={item.id} className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
              onClick={() => navigate('/risk-center')}>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                item.priority === 'HIGH' ? 'bg-accent-red animate-pulse' : 'bg-accent-amber'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-primary truncate">{item.stock_name} — {item.title}</p>
                <p className="text-[10px] font-mono text-ink-muted truncate mt-0.5">{item.action_hint}</p>
              </div>
              <ArrowRight size={10} className="text-ink-muted mt-1 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {todo && todo.pending > showItems.length && (
        <button onClick={() => navigate('/risk-center')}
          className="mt-2 w-full text-center text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors py-1">
          还有 {todo.pending - showItems.length} 条 · 查看全部
        </button>
      )}
    </div>
  )
}

// ── 买入机会卡 ────────────────────────────────────────────────────
function ActivePlansCard() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<BuyPlanData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchActivePlans()
      .then(r => { if (active) setPlans(r.data.data ?? null) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return (
    <div className="card p-4 animate-pulse">
      <div className="h-3 bg-terminal-muted rounded w-32 mb-2" />
      <div className="h-3 bg-terminal-muted rounded w-full" />
    </div>
  )

  const triggered = plans?.items.filter(p => p.trigger_hit) ?? []
  const watching  = plans?.items.filter(p => !p.trigger_hit) ?? []

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-accent-amber" />
          <span className="text-sm font-medium text-ink-primary">买入计划</span>
        </div>
        <button onClick={() => navigate('/buy-plans')}
          className="text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors">
          查看全部 →
        </button>
      </div>

      {triggered.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-mono text-accent-amber mb-1.5">已触发买点</p>
          {triggered.slice(0, 2).map(p => (
            <div key={p.stock_code} className="flex items-center gap-2 py-1.5 cursor-pointer group"
              onClick={() => navigate('/buy-plans')}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse flex-shrink-0" />
              <span className="font-mono text-xs text-ink-secondary">{p.stock_code}</span>
              <span className="text-xs text-ink-primary">{p.stock_name}</span>
              <ArrowRight size={10} className="text-ink-muted ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          ))}
        </div>
      )}

      {watching.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-ink-muted mb-1.5">观察中</p>
          {watching.slice(0, 3).map(p => (
            <div key={p.stock_code} className="flex items-center gap-2 py-1 text-xs text-ink-muted">
              <Clock size={10} className="flex-shrink-0" />
              <span className="font-mono">{p.stock_code}</span>
              <span>{p.stock_name}</span>
            </div>
          ))}
        </div>
      )}

      {(!plans || plans.total === 0) && (
        <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
          <Target size={12} className="opacity-40" />
          暂无进行中的计划
        </div>
      )}
    </div>
  )
}

// ── 自选股行情快照 ────────────────────────────────────────────────
function WatchlistSnapshot() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchWatchlist(), []),
    { refetchInterval: 15_000 },
  )

  const items = data?.items ?? []

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-accent-amber" />
          <span className="text-sm font-medium text-ink-primary">自选股行情</span>
          <span className="tag">{items.length} 只</span>
        </div>
        <button onClick={refetch} className="text-xs font-mono text-ink-muted hover:text-accent-cyan transition-colors">
          刷新
        </button>
      </div>

      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-terminal-border">
            {['代码 / 名称', '最新价', '涨跌幅', '涨跌额', '成交额'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && items.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            : items.length === 0
              ? (
                <tr><td colSpan={5}>
                  <div className="flex flex-col items-center py-10 text-ink-muted gap-2">
                    <Star size={24} strokeWidth={1} className="opacity-30" />
                    <span className="text-sm">还没有自选股，去添加一只吧</span>
                  </div>
                </td></tr>
              )
              : items.map(item => {
                  const q     = item.quote
                  const rate  = q?.change_rate ?? 0
                  const color = getPriceColor(rate)
                  return (
                    <tr key={item.id} className="data-row group" onClick={() => navigate(`/stocks/${item.stock_code}`)}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-ink-muted text-xs">{item.stock_code}</span>
                        <span className="ml-2 text-ink-primary text-sm">{q?.name ?? '—'}</span>
                        {item.note && (
                          <span className="ml-2 text-[10px] text-ink-muted bg-terminal-muted px-1.5 py-0.5 rounded">{item.note}</span>
                        )}
                        <ExternalLink size={10} className="ml-1.5 inline-block text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                      <td className={`px-4 py-3 font-mono font-medium ${color}`}>{q ? formatPrice(q.price) : '—'}</td>
                      <td className={`px-4 py-3 font-mono text-sm ${color}`}>{q ? formatRate(rate) : '—'}</td>
                      <td className={`px-4 py-3 font-mono text-sm ${color}`}>{q ? (rate > 0 ? '+' : '') + q.change.toFixed(2) : '—'}</td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-secondary">{q ? formatAmount(q.amount) : '—'}</td>
                    </tr>
                  )
                })
          }
        </tbody>
      </table>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [refreshTick, setRefreshTick] = useState(0)

  const { data: wlData, loading: wlLoading, refetch: refetchWl } = useQuery(
    useCallback(() => fetchWatchlist(), []),
    { refetchInterval: 15_000 },
  )

  const handleRefresh = () => {
    refetchWl()
    setRefreshTick(t => t + 1)
  }

  const items     = wlData?.items ?? []
  const upCount   = items.filter(i => (i.quote?.change_rate ?? 0) > 0).length
  const downCount = items.filter(i => (i.quote?.change_rate ?? 0) < 0).length

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="仪表盘"
        subtitle="个人 A 股分析系统"
        onRefresh={handleRefresh}
        loading={wlLoading}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <MarketSentimentBar refreshTrigger={refreshTick} />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* 左侧主区域 */}
          <div className="xl:col-span-3 space-y-5">
            <AccountHealthCard />
            <WatchlistSnapshot />
          </div>

          {/* 右侧边栏 */}
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">自选股</p>
                <p className="text-2xl font-mono font-semibold text-accent-amber">{items.length}</p>
                <p className="text-xs text-ink-muted mt-1">涨 {upCount} / 跌 {downCount}</p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">市场情绪</p>
                <div className="flex items-center gap-1 mt-1">
                  {upCount > downCount
                    ? <TrendingUp size={20} className="text-accent-green" />
                    : <TrendingDown size={20} className="text-accent-red" />}
                  <p className={`text-xl font-mono font-semibold ${upCount > downCount ? 'text-accent-green' : 'text-accent-red'}`}>
                    {upCount > downCount ? '偏多' : '偏空'}
                  </p>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  {items.length > 0 ? `涨跌比 ${upCount}:${downCount}` : '—'}
                </p>
              </div>
            </div>

            {/* 今日待办 */}
            <TodayTodoCard />

            {/* 收盘总结（15:00 后出现） */}
            <ClosingSummaryCard />

            {/* 买入计划 */}
            <ActivePlansCard />

            {/* 日报 */}
            <DailyReportView maxContentHeight={300} />

            {/* 主力告警 */}
            <AlertPanel maxHeight={260} />
          </div>
        </div>
      </div>
    </div>
  )
}
