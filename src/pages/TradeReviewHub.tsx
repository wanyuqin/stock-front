import React, { useState, useEffect, useCallback } from 'react'
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Activity, Eye, ShieldCheck, AlertCircle,
  ArrowRight, BarChart2, Sparkles, ChevronDown, ChevronUp,
  Zap, BarChart,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import {
  fetchReviewStats,
  fetchScatterData,
  fetchTradeReviews,
  fetchAiAudit,
  submitImprovementPlan,
  fetchBehaviorStats,
} from '../api/review'
import { ReviewStats, TradeReview, ScatterPoint, AiAudit, BehaviorStat, BuyContext } from '../types/review'
import DarkRoomModal from '../components/Review/DarkRoomModal'

// ── 工具 ──────────────────────────────────────────────────────────
const pnlColor = (v: number) => v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const pnlSign  = (v: number) => v > 0 ? '+' : ''
const fmt2     = (v: number) => v.toFixed(2)

// ── 行为配置 ──────────────────────────────────────────────────────
const BEHAVIOR_CONFIG: Record<string, {
  label: string; desc: string; icon: React.ElementType; color: string; bg: string
}> = {
  NORMAL:         { label: '逻辑一致',  desc: '买卖行为符合预设逻辑',    icon: CheckCircle2,  color: 'text-accent-green', bg: 'bg-accent-green/8 border-accent-green/25' },
  PANIC_SELL:     { label: '恐慌卖出',  desc: '盈利时因恐惧情绪卖出',    icon: AlertTriangle, color: 'text-accent-red',   bg: 'bg-accent-red/8 border-accent-red/25' },
  CHASING_HIGH:   { label: '追高买入',  desc: '买入价显著偏高',          icon: TrendingUp,    color: 'text-accent-amber', bg: 'bg-accent-amber/8 border-accent-amber/25' },
  LOGIC_CONFLICT: { label: '策略冲突',  desc: '长线理由却短期操作',      icon: Brain,         color: 'text-accent-purple', bg: 'bg-accent-purple/8 border-accent-purple/25' },
  PREMATURE_EXIT: { label: '过早止盈',  desc: '盈利不足就卖出',          icon: TrendingDown,  color: 'text-accent-amber', bg: 'bg-accent-amber/8 border-accent-amber/25' },
}

// ── 买入上下文面板 ────────────────────────────────────────────────
function BuyContextPanel({ ctx }: { ctx: BuyContext }) {
  if (!ctx.data_sufficient) {
    return (
      <div className="px-3 py-2 rounded-lg bg-terminal-muted/40 border border-terminal-border/50">
        <p className="text-[10px] font-mono text-ink-muted">买入上下文：K线数据不足，无法分析</p>
      </div>
    )
  }

  // 日内位置颜色
  const posColor = ctx.buy_position_in_day_range >= 0.75
    ? 'text-accent-red' : ctx.buy_position_in_day_range <= 0.3
    ? 'text-accent-green' : 'text-ink-primary'

  // MA20 偏离颜色
  const ma20Color = ctx.ma20_deviation_pct >= 8
    ? 'text-accent-red' : ctx.ma20_deviation_pct <= -5
    ? 'text-accent-green' : 'text-ink-primary'

  // 量比颜色
  const volColor = ctx.volume_ratio_vs_5d >= 1.5
    ? 'text-accent-green' : ctx.volume_ratio_vs_5d <= 0.7
    ? 'text-ink-muted' : 'text-ink-primary'

  // 综合标签样式
  const labelStyle = ctx.is_chasing_high
    ? 'bg-accent-red/10 border-accent-red/30 text-accent-red'
    : ctx.is_bottom_fishing
    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
    : ctx.is_trend_aligned
    ? 'bg-accent-teal/10 border-accent-teal/30 text-accent-teal'
    : 'bg-terminal-muted border-terminal-border text-ink-secondary'

  return (
    <div className="rounded-lg bg-terminal-muted/30 border border-terminal-border/60 overflow-hidden">
      {/* 标题行 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border/40">
        <div className="flex items-center gap-1.5">
          <BarChart size={11} className="text-ink-muted" />
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">买入价格行为（K线客观分析）</span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${labelStyle}`}>
          {ctx.buy_label}
        </span>
      </div>

      {/* 核心指标网格 */}
      <div className="grid grid-cols-3 gap-px bg-terminal-border/30">
        {[
          {
            label: '日内位置',
            value: `${(ctx.buy_position_in_day_range * 100).toFixed(0)}%`,
            sub: ctx.buy_position_in_day_range >= 0.75 ? '追高区间' : ctx.buy_position_in_day_range <= 0.3 ? '低位买入' : '中间区间',
            color: posColor,
          },
          {
            label: 'MA20偏离',
            value: `${ctx.ma20_deviation_pct >= 0 ? '+' : ''}${ctx.ma20_deviation_pct.toFixed(1)}%`,
            sub: ctx.ma20_uptrend ? 'MA20向上' : 'MA20向下',
            color: ma20Color,
          },
          {
            label: '量比',
            value: `${ctx.volume_ratio_vs_5d.toFixed(1)}x`,
            sub: ctx.volume_ratio_vs_5d >= 1.5 ? '放量' : ctx.volume_ratio_vs_5d <= 0.7 ? '缩量' : '正常',
            color: volColor,
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-terminal-bg/50 px-3 py-2">
            <p className="text-[9px] font-mono text-ink-muted mb-0.5 uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
            <p className="text-[9px] font-mono text-ink-muted mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* 背景涨幅条 */}
      <div className="px-3 py-2 flex items-center gap-3 text-[10px] font-mono border-t border-terminal-border/40">
        <span className="text-ink-muted flex-shrink-0">买入前涨幅：</span>
        {[
          { label: '3日', value: ctx.prior_3d_gain_pct },
          { label: '5日', value: ctx.prior_5d_gain_pct },
          { label: '10日', value: ctx.prior_10d_gain_pct },
        ].map(({ label, value }) => (
          <span key={label} className={value >= 0 ? 'text-accent-red' : 'text-accent-green'}>
            {label} {value >= 0 ? '+' : ''}{value.toFixed(1)}%
          </span>
        ))}
        <span className={`ml-auto flex items-center gap-1 ${ctx.is_trend_aligned ? 'text-accent-green' : 'text-accent-red'}`}>
          {ctx.is_trend_aligned ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
          {ctx.is_trend_aligned ? '顺势' : '逆势'}
        </span>
      </div>
    </div>
  )
}

// ── 执行概览 ──────────────────────────────────────────────────────
function ExecutionOverview({ stats, scatterData }: { stats: ReviewStats; scatterData: ScatterPoint[] }) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload
      return (
        <div className="bg-terminal-panel border border-terminal-border p-2 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-ink-primary mb-1 font-mono">{d.id}</p>
          <p className="text-ink-muted">情绪指数：{d.sentiment_score.toFixed(0)}</p>
          <p className={pnlColor(d.pnl_percent)}>盈亏：{pnlSign(d.pnl_percent)}{d.pnl_percent.toFixed(2)}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: '逻辑一致率',   value: `${stats.consistency_rate}%`,              sub: '符合最初买入逻辑的交易占比', icon: Activity,      warn: false },
          { label: '平均卖飞空间', value: `${stats.avg_regret_percent.toFixed(1)}%`, sub: '基于卖出后5日最高价计算',    icon: AlertTriangle, warn: stats.avg_regret_percent > 10 },
          { label: '执行力评分',   value: String(stats.avg_execution_score),          sub: '系统综合打分（满分100）',     icon: TrendingUp,    warn: false },
        ].map(({ label, value, sub, icon: Icon, warn }) => (
          <div key={label} className={`card p-4 ${warn ? 'border-accent-red/40 bg-accent-red/5' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{label}</p>
              <Icon size={13} className={warn ? 'text-accent-red' : 'text-ink-muted'} />
            </div>
            <p className={`text-2xl font-mono font-bold ${warn ? 'text-accent-red' : 'text-ink-primary'}`}>{value}</p>
            <p className="text-[10px] text-ink-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={13} className="text-ink-secondary" />
          <span className="text-sm font-medium text-ink-primary">情绪 vs 盈亏散点图</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-ink-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-green inline-block" />逻辑一致</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-red inline-block" />情绪化</span>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" dataKey="sentiment_score" name="情绪" domain={[0, 100]}
                tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }}
                label={{ value: '情绪指数 →', position: 'bottom', offset: 4, fill: 'var(--color-text-tertiary)', fontSize: 10 }} />
              <YAxis type="number" dataKey="pnl_percent" name="盈亏" unit="%"
                tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }} />
              <ZAxis range={[50, 50]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
              <Scatter data={scatterData.filter(d => d.is_consistent)}  fill="var(--color-accent-green)" fillOpacity={0.8} />
              <Scatter data={scatterData.filter(d => !d.is_consistent)} fill="var(--color-accent-red)"   fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 行为归因 ──────────────────────────────────────────────────────
function BehaviorPanel() {
  const [data, setData]       = useState<{ items: BehaviorStat[]; total_trades: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBehaviorStats().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4 animate-pulse h-32" />)}
    </div>
  )
  if (!data || data.items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-muted gap-3">
      <Brain size={28} strokeWidth={1} className="opacity-30" />
      <p className="text-sm">暂无行为数据，完成更多复盘后自动统计</p>
    </div>
  )

  const worstFlag = data.items
    .filter(i => i.flag !== 'NORMAL' && i.count > 0)
    .sort((a, b) => a.total_pnl - b.total_pnl)[0]?.flag

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs font-mono text-ink-muted">
        <span>共分析 <span className="text-ink-primary font-bold">{data.total_trades}</span> 笔</span>
        {worstFlag && worstFlag !== 'NORMAL' && (
          <span className="text-accent-amber">最贵坏习惯：{BEHAVIOR_CONFIG[worstFlag]?.label ?? worstFlag}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map(item => {
          const cfg = BEHAVIOR_CONFIG[item.flag] ?? { label: item.flag, desc: '', icon: Brain, color: 'text-ink-muted', bg: 'bg-terminal-muted border-terminal-border' }
          const Icon = cfg.icon
          const isWorst = item.flag === worstFlag
          return (
            <div key={item.flag} className={`card p-4 border ${cfg.bg} ${isWorst ? 'ring-1 ring-accent-amber/40' : ''} relative`}>
              {isWorst && (
                <span className="absolute top-2 right-2 text-[9px] font-mono bg-accent-amber/15 text-accent-amber px-1.5 py-0.5 rounded border border-accent-amber/30">最贵习惯</span>
              )}
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={cfg.color} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
              {cfg.desc && <p className="text-[10px] text-ink-muted mb-3">{cfg.desc}</p>}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: String(item.count), label: '次数', color: 'text-ink-primary' },
                  { v: `${item.win_rate.toFixed(0)}%`, label: '胜率', color: item.win_rate >= 50 ? 'text-accent-green' : 'text-accent-red' },
                  { v: `${pnlSign(item.avg_pnl)}${item.avg_pnl.toFixed(1)}%`, label: '均盈亏', color: pnlColor(item.avg_pnl) },
                ].map(({ v, label, color }) => (
                  <div key={label}>
                    <p className={`text-lg font-mono font-bold ${color}`}>{v}</p>
                    <p className="text-[10px] text-ink-muted">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1 bg-terminal-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${item.win_rate >= 50 ? 'bg-accent-green/50' : 'bg-accent-red/50'}`}
                     style={{ width: `${item.win_rate}%` }} />
              </div>
              {item.flag !== 'NORMAL' && (
                <p className={`mt-2 text-[10px] font-mono ${pnlColor(item.total_pnl)}`}>
                  累计 {pnlSign(item.total_pnl)}{item.total_pnl.toFixed(1)}% 盈亏贡献
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 复盘时间轴单卡 ────────────────────────────────────────────────
function ReviewRow({ review, onAudit }: { review: TradeReview; onAudit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isRegret  = review.regret_index > 10
  const isGood    = review.regret_index < -5
  const cardBorder = isRegret ? 'border-accent-red/30 bg-accent-red/4' : 'border-terminal-border'

  // 一致性标志样式
  const flagCfg = BEHAVIOR_CONFIG[review.consistency_flag ?? 'NORMAL'] ?? BEHAVIOR_CONFIG['NORMAL']

  return (
    <div className={`card p-4 border ${cardBorder} relative`}>
      {isRegret && (
        <span className="absolute -top-2 -right-2 bg-accent-red text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 z-10 border border-accent-red/60">
          <AlertCircle size={9} /> 止盈过早
        </span>
      )}

      {/* 顶部：代码/名称 + 盈亏 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-muted">{review.stock_code}</span>
            <span className="text-sm font-semibold text-ink-primary">{review.stock_name}</span>
            {review.is_disciplined && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-accent-green/30 text-accent-green bg-accent-green/10">
                <ShieldCheck size={9} /> 守纪
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-ink-muted">
            <span>{review.buy_date !== '—' ? review.buy_date : '买入日未知'}</span>
            <ArrowRight size={9} />
            <span>{review.sell_date}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-lg font-mono font-bold ${pnlColor(review.pnl_percent)}`}>
            {pnlSign(review.pnl_percent)}{review.pnl_percent}%
          </p>
          <p className="text-[10px] font-mono text-ink-muted">含万一免五手续费</p>
        </div>
      </div>

      {/* ★ 买入上下文面板（核心新增） */}
      {review.buy_context && review.buy_context.data_sufficient && (
        <div className="mb-3">
          <BuyContextPanel ctx={review.buy_context} />
        </div>
      )}

      {/* 卖出 vs 5日残影 */}
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-terminal-muted/40 border border-terminal-border/50 p-3 mb-3">
        <div>
          <p className="text-[10px] font-mono text-ink-muted mb-1">卖出价格</p>
          <p className="text-base font-mono text-ink-primary">¥{fmt2(review.sell_price)}</p>
          <p className="text-[10px] text-ink-muted mt-1 truncate" title={review.sell_reason}>
            {review.sell_reason || <span className="opacity-40">未填写理由</span>}
          </p>
        </div>
        <div className="border-l border-terminal-border pl-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-ink-muted mb-1">5日残影价</p>
            {isRegret && <span className="text-[9px] font-mono text-accent-red animate-pulse">后悔提醒</span>}
            {isGood   && <span className="text-[9px] font-mono text-accent-green">完美逃顶</span>}
          </div>
          <p className={`text-base font-mono ${isRegret ? 'text-accent-red' : isGood ? 'text-accent-green' : 'text-ink-muted'}`}>
            ¥{fmt2(review.price_5d_after)}
          </p>
          <p className="text-[10px] text-ink-muted mt-1">
            {isRegret ? `错失 ¥${(review.price_5d_after - review.sell_price).toFixed(2)}` : '未踏空'}
          </p>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          review.consistency_flag === 'NORMAL'
            ? 'border-accent-green/30 text-accent-green bg-accent-green/10'
            : `${flagCfg.bg} ${flagCfg.color}`
        }`}>
          {review.consistency_flag === 'NORMAL' ? '逻辑自洽' : flagCfg.label}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink-secondary transition-colors">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? '收起' : '详情'}
          </button>
          <button onClick={onAudit}
            className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors">
            <Eye size={11} />
            AI 审计
          </button>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-terminal-border space-y-2 text-xs">
          {review.consistency_note && (
            <div className="px-3 py-2 rounded-lg bg-accent-amber/5 border border-accent-amber/20 text-accent-amber text-xs">
              {review.consistency_note}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-ink-muted">
            <div className="flex justify-between"><span>买入理由</span><span className="text-ink-secondary max-w-[50%] truncate text-right">{review.buy_reason || '—'}</span></div>
            <div className="flex justify-between"><span>后悔指数</span><span className={isRegret ? 'text-accent-red' : 'text-ink-secondary'}>{review.regret_index.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span>执行力评分</span><span className="text-ink-secondary">{review.execution_score || '—'}</span></div>
            {review.buy_context && (
              <div className="flex justify-between col-span-2">
                <span>分析时间</span>
                <span className="text-ink-secondary">{review.buy_context.analyzed_at?.slice(0, 10) || '—'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
type TabKey = 'overview' | 'behavior' | 'timeline'

export default function TradeReviewHub() {
  const [activeTab, setActiveTab]   = useState<TabKey>('overview')
  const [loading,   setLoading]     = useState(true)
  const [stats,     setStats]       = useState<ReviewStats | null>(null)
  const [scatter,   setScatter]     = useState<ScatterPoint[]>([])
  const [reviews,   setReviews]     = useState<TradeReview[]>([])
  const [error,     setError]       = useState('')

  const [isModalOpen,    setIsModalOpen]    = useState(false)
  const [currentAudit,   setCurrentAudit]   = useState<AiAudit | null>(null)
  const [selectedTrade,  setSelectedTrade]  = useState<TradeReview | null>(null)
  const [auditLoading,   setAuditLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, sc, r] = await Promise.all([fetchReviewStats(), fetchScatterData(), fetchTradeReviews()])
      setStats(s); setScatter(sc); setReviews(r)
    } catch { setError('加载复盘数据失败，请检查后端连接') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAudit = async (trade: TradeReview) => {
    setSelectedTrade(trade); setAuditLoading(true); setIsModalOpen(true)
    try {
      const audit = await fetchAiAudit(trade.id, trade.ai_audit_comment)
      setCurrentAudit(audit)
    } catch {
      setCurrentAudit({ trade_id: trade.id, comment: '获取 AI 审计失败，请稍后重试。', kline_data: [], is_generating: false })
    } finally { setAuditLoading(false) }
  }

  const handleImprovement = async (plan: string) => {
    if (selectedTrade?.trade_log_id) {
      try { await submitImprovementPlan(parseInt(selectedTrade.trade_log_id, 10), plan) }
      catch { /* 静默 */ }
    }
    setIsModalOpen(false); setCurrentAudit(null); setSelectedTrade(null); load()
  }

  // 统计：有多少条记录有 buy_context
  const withContext = reviews.filter(r => r.buy_context?.data_sufficient).length
  const chasingHighCount = reviews.filter(r => r.buy_context?.is_chasing_high).length

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'overview',  label: '执行概览',  icon: BarChart2 },
    { key: 'behavior',  label: '行为归因',  icon: Brain },
    { key: 'timeline',  label: '复盘时间轴', icon: Activity },
  ]

  const isEmpty = !loading && reviews.length === 0

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="深度复盘"
        subtitle="数据追踪 · 行为归因 · AI 毒舌审计"
        onRefresh={load}
        loading={loading}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Tab 导航 */}
        <div className="flex gap-1 rounded-xl border border-terminal-border bg-terminal-panel p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === key ? 'bg-terminal-muted text-ink-primary shadow-sm' : 'text-ink-muted hover:text-ink-secondary'
              }`}>
              <Icon size={12} />
              {label}
              {key === 'behavior' && (
                <span className="ml-1 text-[9px] font-mono px-1 py-0.5 rounded bg-accent-purple/20 text-accent-purple border border-accent-purple/30">AI</span>
              )}
            </button>
          ))}
        </div>

        {/* 买入上下文数据横幅（有数据时展示） */}
        {!loading && withContext > 0 && activeTab === 'timeline' && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-terminal-panel border border-terminal-border text-xs font-mono">
            <Zap size={12} className="text-accent-amber flex-shrink-0" />
            <span className="text-ink-secondary">
              {withContext} 条记录已完成买入价格行为分析
            </span>
            {chasingHighCount > 0 && (
              <span className="ml-auto flex items-center gap-1 text-accent-red">
                <AlertTriangle size={11} />
                检测到 {chasingHighCount} 次追高买入
              </span>
            )}
            {chasingHighCount === 0 && (
              <span className="ml-auto flex items-center gap-1 text-accent-green">
                <CheckCircle2 size={11} />
                本期无追高行为
              </span>
            )}
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
            <AlertTriangle size={14} />
            {error}
            <button onClick={load} className="ml-auto flex items-center gap-1 text-xs hover:opacity-80">
              <RefreshCw size={11} /> 重试
            </button>
          </div>
        )}

        {/* 加载态 */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse" />)}
          </div>
        )}

        {/* 空态 */}
        {isEmpty && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-terminal-muted border border-terminal-border flex items-center justify-center">
              <Brain size={28} className="text-ink-muted" />
            </div>
            <p className="text-ink-secondary font-medium">暂无复盘记录</p>
            <p className="text-ink-muted text-sm max-w-xs leading-relaxed">
              先在「交易日志」中记录卖出交易，然后点击「初始化复盘」生成草稿。
            </p>
          </div>
        )}

        {/* 内容区 */}
        {!loading && !isEmpty && (
          <>
            {activeTab === 'overview' && stats && (
              <ExecutionOverview stats={stats} scatterData={scatter} />
            )}
            {activeTab === 'behavior' && <BehaviorPanel />}
            {activeTab === 'timeline' && (
              <div className="space-y-3">
                {reviews.map(review => (
                  <ReviewRow key={review.id} review={review} onAudit={() => handleAudit(review)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 说明 */}
        {!loading && !isEmpty && (
          <div className="px-4 py-3 bg-terminal-panel border border-terminal-border rounded-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={11} className="text-ink-muted" />
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">关于买入上下文分析</span>
            </div>
            <p className="text-[10px] font-mono text-ink-muted leading-relaxed">
              买入价格行为分析基于 K 线客观数据计算，不依赖你填写的理由文字。
              日内位置 &gt; 75% = 追高区间；MA20 偏离 &gt; +8% = 偏高买入；量比 &gt; 1.5x = 放量；
              每次卖出记录后系统异步计算，通常 30 秒内完成（需后端迁移 buy_context 列）。
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <DarkRoomModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setCurrentAudit(null); setSelectedTrade(null) }}
          auditData={currentAudit}
          isLoading={auditLoading}
          onImprovementSubmit={handleImprovement}
        />
      )}
    </div>
  )
}
