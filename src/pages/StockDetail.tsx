import { useCallback, useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, StarOff, RefreshCw,
  TrendingUp, TrendingDown, Minus,
  BarChart2, Activity, DollarSign,
  BrainCircuit, Banknote, PieChart, Target,
  Gauge, X, ChevronRight,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import KLineChart from '@/components/KLineChart'
import MinuteChart from '@/components/MinuteChart'
import AIReportPanel from '@/components/AIReportPanel'
import ValuationPanel from '@/components/ValuationPanel'
import BigDealPanel from '@/components/BigDealPanel'
import BuyPlanPanel from '@/components/BuyPlanPanel'
import { ToastContainer, pushToast } from '@/components/Toast'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchQuote, fetchKLine, fetchMinute, fetchAnalysis,
  addToWatchlist, removeFromWatchlist, fetchWatchlist,
  refreshMoneyFlow, fetchPositionDiagnosis,
} from '@/api/stock'
import { fetchBuyPlansByCode } from '@/api/buyPlan'
import { fetchStockScore } from '@/api/stockScore'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, formatVolume, ErrorBanner,
} from '@/components/shared'
import type { BigDealSummary } from '@/types'
import type { BuyPlan } from '@/types/buy_plan'

interface MetricProps { label: string; value: string; sub?: string; color?: string }
function Metric({ label, value, sub, color = 'text-ink-primary' }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-ink-muted">{sub}</span>}
    </div>
  )
}

type ChartMode = 'minute' | 'daily'
type Period = 60 | 120 | 250

function ChartToolbar({
  mode, onModeChange, period, onPeriodChange, loading,
}: {
  mode: ChartMode; onModeChange: (m: ChartMode) => void
  period: Period; onPeriodChange: (p: Period) => void; loading: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {loading && <RefreshCw size={11} className="text-ink-muted animate-spin mr-1" />}
      {(['minute', 'daily'] as ChartMode[]).map(m => (
        <button key={m} onClick={() => onModeChange(m)}
          className={`px-2 py-1 rounded text-xs font-mono transition-all ${
            mode === m ? 'bg-terminal-muted border border-terminal-border text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
          }`}>
          {m === 'minute' ? '分时' : '日K'}
        </button>
      ))}
      {mode === 'daily' && (
        <>
          <span className="text-ink-muted/30 text-xs">|</span>
          {([{ label: '3月', value: 60 }, { label: '6月', value: 120 }, { label: '1年', value: 250 }] as { label: string; value: Period }[]).map(o => (
            <button key={o.value} onClick={() => onPeriodChange(o.value)}
              className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                period === o.value ? 'bg-terminal-muted border border-terminal-border text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
              }`}>
              {o.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

// ── 综合评分浮层 ──────────────────────────────────────────────────

function ScoreGauge({ score, level }: { score: number; level: string }) {
  const color =
    level === 'go'      ? { ring: '#22c55e', text: 'text-accent-green' } :
    level === 'caution' ? { ring: '#f59e0b', text: 'text-accent-amber' } :
                          { ring: '#ef4444', text: 'text-accent-red'   }
  const dash = 2 * Math.PI * 28 // circumference r=28
  const offset = dash * (1 - score / 100)

  return (
    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-terminal-muted" />
        <circle cx="32" cy="32" r="28" fill="none" stroke={color.ring} strokeWidth="4"
          strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className={`text-lg font-mono font-bold z-10 ${color.text}`}>{score}</span>
    </div>
  )
}

function ScorePanel({
  code, onClose,
}: { code: string; onClose: () => void }) {
  const { data: score, loading, error, refetch } = useQuery(
    useCallback(() => fetchStockScore(code), [code]),
    { enabled: true },
  )

  const verdictStyle =
    score?.verdict_level === 'go'      ? 'bg-accent-green/10 border-accent-green/40 text-accent-green' :
    score?.verdict_level === 'caution' ? 'bg-accent-amber/10 border-accent-amber/40 text-accent-amber' :
                                         'bg-accent-red/10 border-accent-red/40 text-accent-red'

  const levelColor = (l: string) =>
    l === 'good'   ? 'text-accent-green' :
    l === 'bad'    ? 'text-accent-red'   : 'text-ink-secondary'

  const barColor = (l: string) =>
    l === 'good' ? 'bg-accent-green' :
    l === 'bad'  ? 'bg-accent-red'   : 'bg-accent-amber'

  return (
    <div className="absolute top-0 right-0 w-72 z-20 card shadow-panel border border-terminal-border bg-terminal-panel animate-fade-in overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-accent-cyan" />
          <span className="text-sm font-medium text-ink-primary">综合建仓评分</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="text-ink-muted hover:text-ink-primary transition-colors">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading && !score && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-terminal-muted rounded animate-pulse" />
            ))}
          </div>
        )}
        {error && <div className="text-xs text-accent-red font-mono">{error}</div>}
        {score && (
          <>
            {/* 总分 + 结论 */}
            <div className="flex items-center gap-3 mb-4">
              <ScoreGauge score={score.total_score} level={score.verdict_level} />
              <div className="flex-1 min-w-0">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium mb-1.5 ${verdictStyle}`}>
                  {score.verdict}
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">{score.summary}</p>
              </div>
            </div>

            {/* 分维度评分 */}
            <div className="space-y-2.5 mb-4">
              {score.items.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-secondary">{item.name}</span>
                    <span className={`text-xs font-mono font-semibold ${levelColor(item.level)}`}>
                      {item.score}/{item.max}
                    </span>
                  </div>
                  <div className="h-1.5 bg-terminal-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor(item.level)}`}
                      style={{ width: `${(item.score / item.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-ink-muted mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* 关键价位参考 */}
            {(score.ma20 > 0 || score.support > 0) && (
              <div className="pt-3 border-t border-terminal-border">
                <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">关键价位</div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  {score.ma20 > 0 && (
                    <div className="flex justify-between px-2 py-1 bg-terminal-muted rounded">
                      <span className="text-ink-muted">MA20</span>
                      <span className="text-purple-400">¥{score.ma20.toFixed(2)}</span>
                    </div>
                  )}
                  {score.support > 0 && (
                    <div className="flex justify-between px-2 py-1 bg-terminal-muted rounded">
                      <span className="text-ink-muted">支撑</span>
                      <span className="text-accent-green">¥{score.support.toFixed(2)}</span>
                    </div>
                  )}
                  {score.resistance > 0 && (
                    <div className="flex justify-between px-2 py-1 bg-terminal-muted rounded">
                      <span className="text-ink-muted">压力</span>
                      <span className="text-accent-red">¥{score.resistance.toFixed(2)}</span>
                    </div>
                  )}
                  {score.atr > 0 && (
                    <div className="flex justify-between px-2 py-1 bg-terminal-muted rounded">
                      <span className="text-ink-muted">ATR</span>
                      <span className="text-ink-secondary">¥{score.atr.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── MoneyFlowPanel（保留原样）────────────────────────────────────

function formatYuan(yuan: number) {
  const abs = Math.abs(yuan)
  const sign = yuan >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  return `${sign}${(abs / 1e4).toFixed(0)}万`
}
function inflowColor(v: number) {
  if (v > 0) return 'text-accent-green'
  if (v < 0) return 'text-accent-red'
  return 'text-ink-muted'
}

interface QTFlow {
  outer_vol: number; inner_vol: number; net_vol: number
  outer_amt: number; inner_amt: number; net_amt: number
  net_pct: number; big_buy_pct: number; big_sell_pct: number
  sml_buy_pct: number; sml_sell_pct: number
  price: number; change_rate: number
  volume: number; amount: number; turnover: number
  flow_desc: string; updated_at: string
}

function OuterInnerBar({ outer, inner }: { outer: number; inner: number }) {
  const total = outer + inner
  if (total === 0) return null
  const outerPct = outer / total * 100
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-accent-green">外盘 {outerPct.toFixed(1)}%</span>
        <span className="text-accent-red">内盘 {(100 - outerPct).toFixed(1)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-accent-red/40 flex">
        <div className="h-full bg-accent-green/70 rounded-l-full transition-all duration-500"
          style={{ width: `${outerPct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-ink-muted">
        <span>{(outer / 1e4).toFixed(0)}万手</span>
        <span>{(inner / 1e4).toFixed(0)}万手</span>
      </div>
    </div>
  )
}

function PanKouBar({ bigBuy, bigSell, smlBuy, smlSell }: {
  bigBuy: number; bigSell: number; smlBuy: number; smlSell: number
}) {
  if (!bigBuy && !bigSell) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">盘口大单比例</p>
      {[
        { label: '大单买', value: bigBuy, color: 'bg-accent-green/70' },
        { label: '大单卖', value: bigSell, color: 'bg-accent-red/70' },
        { label: '小单买', value: smlBuy, color: 'bg-accent-green/30' },
        { label: '小单卖', value: smlSell, color: 'bg-accent-red/30' },
      ].map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-ink-muted w-10 flex-shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-terminal-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value * 100, 100)}%` }} />
          </div>
          <span className="text-[9px] font-mono text-ink-muted w-10 text-right flex-shrink-0">{(value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function MoneyFlowPanel({ code }: { code: string }) {
  const [refreshing, setRefreshing] = useState(false)
  const [liveData, setLiveData] = useState<QTFlow | null>(null)
  const [liveErr, setLiveErr] = useState('')

  const handleRefresh = async () => {
    setRefreshing(true); setLiveErr('')
    try {
      const resp = await refreshMoneyFlow(code)
      setLiveData(resp.data.data as unknown as QTFlow)
    } catch (e) { setLiveErr(e instanceof Error ? e.message : '抓取失败') }
    finally { setRefreshing(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Banknote size={13} className="text-accent-green" />
          <span className="text-xs font-medium text-ink-primary">资金流向</span>
          {liveData?.updated_at && <span className="text-[10px] font-mono text-ink-muted/60">{liveData.updated_at}</span>}
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1 text-[11px] font-mono text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-40">
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />实时刷新
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {liveErr && <ErrorBanner message={liveErr} />}
        {!liveData && !refreshing && !liveErr && (
          <div className="flex flex-col items-center justify-center py-10 text-ink-muted gap-3">
            <Banknote size={28} strokeWidth={1.2} className="opacity-30" />
            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-border text-[11px] font-mono text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/50 transition-all">
              <RefreshCw size={11} />拉取实时数据
            </button>
          </div>
        )}
        {refreshing && !liveData && (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-terminal-muted rounded animate-pulse" />)}</div>
        )}
        {liveData && (
          <>
            {liveData.flow_desc && (
              <div className="rounded-lg border border-terminal-border bg-terminal-muted/30 px-3 py-2">
                <p className="text-[11px] font-mono text-ink-secondary leading-relaxed">{liveData.flow_desc}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '净流入金额', value: liveData.net_amt, sub: `${liveData.net_pct >= 0 ? '+' : ''}${liveData.net_pct.toFixed(1)}% 占比`, highlight: true },
                { label: '外盘金额',   value: liveData.outer_amt,  sub: `${(liveData.outer_vol / 1e4).toFixed(1)}万手`, highlight: false },
                { label: '内盘金额',   value: -liveData.inner_amt, sub: `${(liveData.inner_vol / 1e4).toFixed(1)}万手`, highlight: false },
                { label: '成交额',     value: null, sub: `换手 ${liveData.turnover.toFixed(2)}%`, amtWan: liveData.amount, highlight: false },
              ].map(({ label, value, sub, highlight, amtWan }) => (
                <div key={label} className={`rounded-lg p-3 border ${highlight ? 'border-accent-green/30 bg-accent-green/5' : 'border-terminal-border bg-terminal-muted/40'}`}>
                  <p className="text-[10px] font-mono text-ink-muted mb-1">{label}</p>
                  {amtWan !== undefined
                    ? <p className="text-sm font-mono font-bold text-ink-primary">{amtWan.toFixed(0)}万</p>
                    : <p className={`text-sm font-mono font-bold ${inflowColor(value ?? 0)}`}>{formatYuan(value ?? 0)}</p>}
                  {sub && <p className="text-[9px] font-mono text-ink-muted mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
            <OuterInnerBar outer={liveData.outer_vol} inner={liveData.inner_vol} />
            <PanKouBar bigBuy={liveData.big_buy_pct} bigSell={liveData.big_sell_pct} smlBuy={liveData.sml_buy_pct} smlSell={liveData.sml_sell_pct} />
          </>
        )}
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
type RightTab = 'ai' | 'moneyflow' | 'bigdeal' | 'valuation' | 'buyplan'

export default function StockDetail() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [chartMode, setChartMode] = useState<ChartMode>('daily')
  const [period, setPeriod] = useState<Period>(120)
  const [inWatchlist, setInWatchlist] = useState<boolean | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('ai')
  const [showScore, setShowScore] = useState(false)

  const [bigDealData, setBigDealData] = useState<BigDealSummary | null>(null)
  const lastToastAmtRef = useRef<number>(0)
  const [smartSummary, setSmartSummary] = useState<string>('')
  const summaryTriggeredRef = useRef(false)

  useEffect(() => {
    if (!bigDealData || summaryTriggeredRef.current) return
    const superTicks = bigDealData.ticks?.filter(t => t.size === 'super' && t.direction === 'B') ?? []
    if (superTicks.length === 0) return
    summaryTriggeredRef.current = true
    const avgCost = bigDealData.main_avg_cost
    const allAboveAvg = avgCost > 0 && superTicks.every(t => t.price >= avgCost)
    const summary = `今日特大单买入坚决（${superTicks.length} 笔），且全部发生在${allAboveAvg ? '均价线上方' : '均价线附近'}，属于${allAboveAvg ? '主动型抢筹' : '震荡吸筹'}。`
    setTimeout(() => setSmartSummary(summary), 800)
  }, [bigDealData])

  useEffect(() => {
    if (!bigDealData?.ticks) return
    const superBuyTicks = bigDealData.ticks.filter(t => t.size === 'super' && t.direction === 'B')
    const totalSuperBuy = superBuyTicks.reduce((s, t) => s + t.amount, 0)
    if (totalSuperBuy > 5_000_000 && totalSuperBuy > lastToastAmtRef.current + 5_000_000) {
      const latest = superBuyTicks[superBuyTicks.length - 1]
      pushToast({
        type: 'flash', message: '⚡ 主力资金闪击',
        sub: `价格 ${latest?.price?.toFixed(2) ?? ''} · 特大买单累计 ${(totalSuperBuy / 1e4).toFixed(0)} 万`,
        duration: 8000,
      })
      lastToastAmtRef.current = totalSuperBuy
    }
  }, [bigDealData])

  const { data: quote, loading: quoteLoading, error: quoteError, refetch: refetchQuote } = useQuery(
    useCallback(() => fetchQuote(code), [code]), { refetchInterval: 10_000 })
  const { data: klineData, loading: klineLoading, error: klineError, refetch: refetchKLine } = useQuery(
    useCallback(() => fetchKLine(code, period), [code, period]),
    { enabled: chartMode === 'daily' },
  )
  const { data: minuteData, loading: minuteLoading, error: minuteError, refetch: refetchMinute } = useQuery(
    useCallback(() => fetchMinute(code, 1), [code]),
    { enabled: chartMode === 'minute', refetchInterval: 60_000 },
  )
  const { data: analysis, loading: analysisLoading, error: analysisError, refetch: refetchAnalysis } = useQuery(
    useCallback(() => fetchAnalysis(code), [code]), { enabled: false },
  )

  // 买入计划（用于 K 线图标注）
  const { data: buyPlanData } = useQuery(
    useCallback(() => fetchBuyPlansByCode(code), [code]),
  )
  const activeBuyPlans: BuyPlan[] = (buyPlanData?.items ?? []).filter(
    p => p.status === 'WATCHING' || p.status === 'READY'
  )

  useQuery(useCallback(() => fetchWatchlist(), []), {
    onSuccess: (wl) => setInWatchlist(wl.items.some(i => i.stock_code === code)),
  })

  const { data: diagData } = useQuery(useCallback(() => fetchPositionDiagnosis(), []))
  const positionCost = diagData?.items?.find(i => i.stock_code === code)?.position?.avg_cost

  const toggleWatchlist = async () => {
    try {
      if (inWatchlist) { await removeFromWatchlist(code); setInWatchlist(false) }
      else { await addToWatchlist(code, ''); setInWatchlist(true) }
    } catch (e) { alert(e instanceof Error ? e.message : '操作失败') }
  }

  const rate = quote?.change_rate ?? 0
  const color = getPriceColor(rate)
  const TrendIcon = rate > 0 ? TrendingUp : rate < 0 ? TrendingDown : Minus

  return (
    <div className="flex flex-col h-full">
      <ToastContainer />

      <Topbar
        title={quote ? `${quote.name}（${code}）` : code}
        subtitle={quote ? `${quote.market} · ${quote.from_cache ? '缓存行情' : '实时行情'}` : '加载中…'}
        onRefresh={() => { refetchQuote(); if (chartMode === 'daily') refetchKLine(); else refetchMinute() }}
        loading={quoteLoading || klineLoading}
      />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* 价格栏 */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-ink-muted hover:text-ink-primary transition-colors text-sm">
                <ArrowLeft size={14} />返回
              </button>
              <div className="w-px h-8 bg-terminal-border" />
              {quoteLoading && !quote ? (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-24 bg-terminal-muted rounded animate-pulse" />
                  <div className="h-5 w-16 bg-terminal-muted rounded animate-pulse" />
                </div>
              ) : quoteError ? (
                <span className="text-accent-red text-sm font-mono">{quoteError}</span>
              ) : quote ? (
                <div className="flex items-center gap-4">
                  <span className={`text-3xl font-mono font-bold ${color}`}>{formatPrice(quote.price)}</span>
                  <div className={`flex items-center gap-1.5 ${color}`}>
                    <TrendIcon size={16} />
                    <span className="text-base font-mono font-semibold">{formatRate(rate)}</span>
                    <span className="text-sm font-mono">{rate >= 0 ? '+' : ''}{quote.change.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-6">
              {quote && (
                <div className="hidden lg:grid grid-cols-4 gap-6">
                  <Metric label="今开" value={formatPrice(quote.open)} />
                  <Metric label="昨收" value={formatPrice(quote.close)} />
                  <Metric label="最高" value={formatPrice(quote.high)} color="text-accent-green" />
                  <Metric label="最低" value={formatPrice(quote.low)} color="text-accent-red" />
                </div>
              )}
              {quote && (
                <div className="hidden xl:grid grid-cols-3 gap-6">
                  <Metric label="成交量" value={formatVolume(quote.volume)} sub={`量比 ${quote.volume_ratio.toFixed(2)}`} />
                  <Metric label="成交额" value={formatAmount(quote.amount)} />
                  <Metric label="换手率" value={`${quote.turnover.toFixed(2)}%`} />
                </div>
              )}
              <button onClick={toggleWatchlist}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-all ${
                  inWatchlist
                    ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red'
                    : 'border-terminal-border text-ink-muted hover:border-accent-amber/50 hover:text-accent-amber'
                }`}>
                {inWatchlist ? <><StarOff size={13} />已自选</> : <><Star size={13} />加自选</>}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* 左：K 线区 */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-terminal-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart2 size={13} className="text-ink-muted" />
                <span className="text-xs font-mono text-ink-muted">
                  {chartMode === 'minute' ? '分时 · 腾讯' : '日K · 前复权'}
                </span>
                {chartMode === 'daily' && klineData && <span className="tag">{klineData.klines.length} 根</span>}
                {chartMode === 'minute' && minuteData && (
                  <>
                    <span className="tag">{minuteData.bars.length} 分钟</span>
                    {bigDealData && bigDealData.ticks?.filter(t => t.size === 'super').length > 0 && (
                      <span className="tag" style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }}>
                        ▲{bigDealData.ticks.filter(t => t.size === 'super').length} 特大单
                      </span>
                    )}
                  </>
                )}
                {/* 买入计划标注提示 */}
                {activeBuyPlans.length > 0 && chartMode === 'daily' && (
                  <span className="tag" style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>
                    {activeBuyPlans.filter(p => p.trigger_hit).length > 0 ? '⚡' : '●'} {activeBuyPlans.length} 个买入计划
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ChartToolbar
                  mode={chartMode} onModeChange={m => setChartMode(m)}
                  period={period} onPeriodChange={setPeriod}
                  loading={klineLoading || minuteLoading}
                />
                {/* 综合评分按钮 */}
                <div className="relative">
                  <button
                    onClick={() => setShowScore(s => !s)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-all border ${
                      showScore
                        ? 'bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan'
                        : 'border-terminal-border text-ink-muted hover:text-ink-primary hover:border-terminal-border'
                    }`}
                  >
                    <Gauge size={11} />
                    评分
                    <ChevronRight size={9} className={`transition-transform ${showScore ? 'rotate-90' : ''}`} />
                  </button>
                  {showScore && (
                    <ScorePanel code={code} onClose={() => setShowScore(false)} />
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-2">
              {(chartMode === 'daily' ? klineError : minuteError) && (
                <div className="p-4"><ErrorBanner message={(chartMode === 'daily' ? klineError : minuteError) ?? ''} /></div>
              )}
              {((chartMode === 'daily' && klineLoading && !klineData) ||
                (chartMode === 'minute' && minuteLoading && !minuteData)) && (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-ink-muted">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="text-sm font-mono">{chartMode === 'minute' ? '加载分时数据…' : '加载 K 线数据…'}</span>
                  </div>
                </div>
              )}
              {chartMode === 'daily' && klineData && klineData.klines.length > 0 && (
                <KLineChart
                  data={klineData}
                  height={undefined}
                  costPrice={positionCost != null ? Number(positionCost) : undefined}
                  buyPlans={activeBuyPlans.length > 0 ? activeBuyPlans : undefined}
                />
              )}
              {chartMode === 'daily' && klineData && klineData.klines.length === 0 && (
                <div className="h-full flex items-center justify-center text-ink-muted text-sm">暂无 K 线数据</div>
              )}
              {chartMode === 'minute' && minuteData && minuteData.bars.length > 0 && (
                <MinuteChart data={minuteData} bigDealData={bigDealData} />
              )}
              {chartMode === 'minute' && minuteData && minuteData.bars.length === 0 && (
                <div className="h-full flex items-center justify-center text-ink-muted text-sm">暂无分时数据</div>
              )}
            </div>

            {quote && (
              <div className="lg:hidden flex-shrink-0 grid grid-cols-4 gap-3 px-4 py-3 border-t border-terminal-border">
                <Metric label="今开" value={formatPrice(quote.open)} />
                <Metric label="昨收" value={formatPrice(quote.close)} />
                <Metric label="最高" value={formatPrice(quote.high)} color="text-accent-green" />
                <Metric label="最低" value={formatPrice(quote.low)} color="text-accent-red" />
              </div>
            )}
          </div>

          {/* 右：Tab 面板 */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden">
            {quote && (
              <div className="flex-shrink-0 grid grid-cols-3 gap-0 border-b border-terminal-border">
                {[
                  { label: '量比', value: quote.volume_ratio.toFixed(2), icon: Activity },
                  { label: '换手', value: `${quote.turnover.toFixed(2)}%`, icon: DollarSign },
                  { label: '成交额', value: formatAmount(quote.amount), icon: BarChart2 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center py-3 border-r border-terminal-border last:border-r-0">
                    <Icon size={12} className="text-ink-muted mb-1" />
                    <span className="text-[10px] font-mono text-ink-muted">{label}</span>
                    <span className="text-sm font-mono font-medium text-ink-primary mt-0.5">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-shrink-0 flex border-b border-terminal-border overflow-x-auto">
              {([
                { key: 'ai',        label: 'AI',      icon: BrainCircuit },
                { key: 'moneyflow', label: '资金',     icon: Banknote },
                { key: 'bigdeal',   label: '大单',     icon: Activity },
                { key: 'valuation', label: '估值',     icon: PieChart },
                { key: 'buyplan',   label: '买入计划', icon: Target },
              ] as { key: RightTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setRightTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-mono transition-colors border-b-2 whitespace-nowrap ${
                    rightTab === key
                      ? key === 'buyplan'
                        ? 'border-accent-amber text-accent-amber'
                        : 'border-accent-cyan text-accent-cyan'
                      : 'border-transparent text-ink-muted hover:text-ink-secondary'
                  }`}>
                  <Icon size={11} />{label}
                  {key === 'buyplan' && activeBuyPlans.length > 0 && (
                    <span className="ml-0.5 text-[9px] bg-accent-amber/20 text-accent-amber px-1 rounded">{activeBuyPlans.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden overflow-y-auto">
              {rightTab === 'ai' ? (
                <AIReportPanel data={analysis} loading={analysisLoading} error={analysisError} onRefresh={refetchAnalysis} smartSummary={smartSummary} />
              ) : rightTab === 'moneyflow' ? (
                <MoneyFlowPanel code={code} />
              ) : rightTab === 'bigdeal' ? (
                <BigDealPanel code={code} changeRate={quote?.change_rate} onDataLoaded={setBigDealData} />
              ) : rightTab === 'valuation' ? (
                <ValuationPanel code={code} />
              ) : (
                <BuyPlanPanel code={code} stockName={quote?.name ?? code} currentPrice={quote?.price} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
