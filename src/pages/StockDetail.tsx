import { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, StarOff, RefreshCw,
  TrendingUp, TrendingDown, Minus,
  BarChart2, Activity, DollarSign,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import KLineChart from '@/components/KLineChart'
import AIReportPanel from '@/components/AIReportPanel'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchQuote, fetchKLine, fetchAnalysis,
  addToWatchlist, removeFromWatchlist, fetchWatchlist,
} from '@/api/stock'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, formatVolume, ErrorBanner,
} from '@/components/shared'

// ── 行情指标卡片 ──────────────────────────────────────────────────
interface MetricProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function Metric({ label, value, sub, color = 'text-ink-primary' }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-ink-muted">{sub}</span>}
    </div>
  )
}

// ── K 线图工具栏 ──────────────────────────────────────────────────
type Period = 60 | 120 | 250

interface KLineToolbarProps {
  period: Period
  onChange: (p: Period) => void
  loading: boolean
}

function KLineToolbar({ period, onChange, loading }: KLineToolbarProps) {
  const options: { label: string; value: Period }[] = [
    { label: '3月', value: 60 },
    { label: '6月', value: 120 },
    { label: '1年', value: 250 },
  ]
  return (
    <div className="flex items-center gap-1">
      {loading && <RefreshCw size={11} className="text-ink-muted animate-spin mr-1" />}
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 rounded text-xs font-mono transition-all ${
            period === o.value
              ? 'bg-terminal-muted border border-terminal-border text-ink-primary'
              : 'text-ink-muted hover:text-ink-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function StockDetail() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate        = useNavigate()
  const [period, setPeriod] = useState<Period>(120)
  const [inWatchlist, setInWatchlist] = useState<boolean | null>(null)

  // ── 实时行情（每 10s 刷新）────────────────────────────────────
  const {
    data: quote, loading: quoteLoading, error: quoteError, refetch: refetchQuote,
  } = useQuery(
    useCallback(() => fetchQuote(code), [code]),
    { refetchInterval: 10_000 },
  )

  // ── K 线数据 ──────────────────────────────────────────────────
  const {
    data: klineData, loading: klineLoading, error: klineError, refetch: refetchKLine,
  } = useQuery(
    useCallback(() => fetchKLine(code, period), [code, period]),
  )

  // ── AI 分析（手动触发，30min 缓存）────────────────────────────
  const {
    data: analysis, loading: analysisLoading, error: analysisError, refetch: refetchAnalysis,
  } = useQuery(
    useCallback(() => fetchAnalysis(code), [code]),
  )

  // ── 检查是否在自选股 ──────────────────────────────────────────
  useQuery(
    useCallback(() => fetchWatchlist(), []),
    {
      onSuccess: (wl) => {
        setInWatchlist(wl.items.some(i => i.stock_code === code))
      },
    },
  )

  // ── 自选股切换 ────────────────────────────────────────────────
  const toggleWatchlist = async () => {
    try {
      if (inWatchlist) {
        await removeFromWatchlist(code)
        setInWatchlist(false)
      } else {
        await addToWatchlist(code, '')
        setInWatchlist(true)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败')
    }
  }

  const rate  = quote?.change_rate ?? 0
  const color = getPriceColor(rate)
  const TrendIcon = rate > 0 ? TrendingUp : rate < 0 ? TrendingDown : Minus

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={quote ? `${quote.name}（${code}）` : code}
        subtitle={quote ? `${quote.market} · ${quote.from_cache ? '缓存行情' : '实时行情'}` : '加载中…'}
        onRefresh={() => { refetchQuote(); refetchKLine() }}
        loading={quoteLoading || klineLoading}
      />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ── 行情头部条 ───────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center justify-between flex-wrap gap-4">

            {/* 左：返回 + 价格 */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-ink-muted hover:text-ink-primary transition-colors text-sm"
              >
                <ArrowLeft size={14} />
                返回
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
                  <span className={`text-3xl font-mono font-bold ${color}`}>
                    {formatPrice(quote.price)}
                  </span>
                  <div className={`flex items-center gap-1.5 ${color}`}>
                    <TrendIcon size={16} />
                    <span className="text-base font-mono font-semibold">{formatRate(rate)}</span>
                    <span className="text-sm font-mono">
                      {rate >= 0 ? '+' : ''}{quote.change.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 右：指标 + 自选股按钮 */}
            <div className="flex items-center gap-6">
              {quote && (
                <div className="hidden lg:grid grid-cols-4 gap-6">
                  <Metric label="今开" value={formatPrice(quote.open)} />
                  <Metric label="昨收" value={formatPrice(quote.close)} />
                  <Metric
                    label="最高"
                    value={formatPrice(quote.high)}
                    color="text-accent-green"
                  />
                  <Metric
                    label="最低"
                    value={formatPrice(quote.low)}
                    color="text-accent-red"
                  />
                </div>
              )}

              {quote && (
                <div className="hidden xl:grid grid-cols-3 gap-6">
                  <Metric
                    label="成交量"
                    value={formatVolume(quote.volume)}
                    sub={`量比 ${quote.volume_ratio.toFixed(2)}`}
                  />
                  <Metric
                    label="成交额"
                    value={formatAmount(quote.amount)}
                  />
                  <Metric
                    label="换手率"
                    value={`${quote.turnover.toFixed(2)}%`}
                  />
                </div>
              )}

              <button
                onClick={toggleWatchlist}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-all ${
                  inWatchlist
                    ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red'
                    : 'border-terminal-border text-ink-muted hover:border-accent-amber/50 hover:text-accent-amber'
                }`}
              >
                {inWatchlist
                  ? <><StarOff size={13} />已自选</>
                  : <><Star size={13} />加自选</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── 主内容区：左 K 线 + 右 AI 分析 ─────────────────── */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* 左：K 线区 */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-terminal-border overflow-hidden">
            {/* K 线工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart2 size={13} className="text-ink-muted" />
                <span className="text-xs font-mono text-ink-muted">日K · 前复权</span>
                {klineData && (
                  <span className="tag">{klineData.klines.length} 根</span>
                )}
              </div>
              <KLineToolbar
                period={period}
                onChange={setPeriod}
                loading={klineLoading}
              />
            </div>

            {/* K 线图 */}
            <div className="flex-1 min-h-0 p-2">
              {klineError && (
                <div className="p-4">
                  <ErrorBanner message={klineError} />
                </div>
              )}
              {klineLoading && !klineData && (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-ink-muted">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="text-sm font-mono">加载 K 线数据…</span>
                  </div>
                </div>
              )}
              {klineData && klineData.klines.length > 0 && (
                <KLineChart
                  data={klineData}
                  height={undefined} // 自适应
                />
              )}
              {klineData && klineData.klines.length === 0 && (
                <div className="h-full flex items-center justify-center text-ink-muted text-sm">
                  暂无 K 线数据
                </div>
              )}
            </div>

            {/* 移动端指标补充 */}
            {quote && (
              <div className="lg:hidden flex-shrink-0 grid grid-cols-4 gap-3 px-4 py-3 border-t border-terminal-border">
                <Metric label="今开"  value={formatPrice(quote.open)} />
                <Metric label="昨收"  value={formatPrice(quote.close)} />
                <Metric label="最高"  value={formatPrice(quote.high)}  color="text-accent-green" />
                <Metric label="最低"  value={formatPrice(quote.low)}   color="text-accent-red" />
              </div>
            )}
          </div>

          {/* 右：AI 分析面板 */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden">
            {/* 快速指标 */}
            {quote && (
              <div className="flex-shrink-0 grid grid-cols-3 gap-0 border-b border-terminal-border">
                {[
                  { label: '量比',  value: quote.volume_ratio.toFixed(2), icon: Activity },
                  { label: '换手',  value: `${quote.turnover.toFixed(2)}%`, icon: DollarSign },
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

            {/* AI 报告 */}
            <div className="flex-1 overflow-hidden">
              <AIReportPanel
                data={analysis}
                loading={analysisLoading}
                error={analysisError}
                onRefresh={refetchAnalysis}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
