import { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, StarOff, RefreshCw,
  TrendingUp, TrendingDown, Minus,
  BarChart2, Activity, DollarSign,
  BrainCircuit, Banknote,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import KLineChart from '@/components/KLineChart'
import AIReportPanel from '@/components/AIReportPanel'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchQuote, fetchKLine, fetchAnalysis,
  addToWatchlist, removeFromWatchlist, fetchWatchlist,
  fetchMoneyFlow, refreshMoneyFlow,
} from '@/api/stock'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, formatVolume, ErrorBanner,
} from '@/components/shared'
import type { MoneyFlowLog } from '@/types'

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

// ── 资金流向面板 ──────────────────────────────────────────────────

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

interface MoneyFlowPanelProps {
  code: string
}

function MoneyFlowPanel({ code }: MoneyFlowPanelProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [liveData, setLiveData]     = useState<Record<string, string | number> | null>(null)
  const [liveErr,  setLiveErr]      = useState('')
  const [histKey,  setHistKey]      = useState(0)

  // 历史快照（DB）
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchMoneyFlow(code, 10), [code, histKey]),
  )

  const logs: MoneyFlowLog[] = data?.items ?? []
  const latest = logs[0] ?? null

  // 手动抓取实时数据
  const handleRefresh = async () => {
    setRefreshing(true)
    setLiveErr('')
    try {
      const resp = await refreshMoneyFlow(code)
      setLiveData(resp.data.data as Record<string, string | number>)
      setHistKey(k => k + 1) // 重新拉历史
    } catch (e) {
      setLiveErr(e instanceof Error ? e.message : '抓取失败')
    } finally {
      setRefreshing(false)
    }
  }

  // 展示优先级：实时抓取结果 > DB 最新快照
  const mainInflow  = liveData
    ? Number(liveData.main_net_inflow)
    : latest?.main_net_inflow ?? null

  const superInflow = liveData
    ? Number(liveData.super_large_inflow)
    : latest?.super_large_inflow ?? null

  const largeInflow = liveData
    ? Number(liveData.large_inflow)
    : latest?.large_inflow ?? null

  const pct = liveData
    ? Number(liveData.main_inflow_pct)
    : latest?.main_inflow_pct ?? null

  const updatedAt = liveData
    ? '刚刚'
    : latest
      ? new Date(latest.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Banknote size={13} className="text-accent-green" />
          <span className="text-xs font-medium text-ink-primary">主力资金流向</span>
          {updatedAt && (
            <span className="text-[10px] font-mono text-ink-muted">更新 {updatedAt}</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-[11px] font-mono text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-40"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          实时刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {liveErr && <ErrorBanner message={liveErr} />}

        {loading && logs.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-terminal-muted rounded animate-pulse" />
            ))}
          </div>
        ) : mainInflow === null ? (
          /* 没有任何数据 */
          <div className="flex flex-col items-center justify-center py-10 text-ink-muted gap-3">
            <Banknote size={28} strokeWidth={1.2} className="opacity-30" />
            <p className="text-xs font-mono text-center">
              暂无资金流向数据
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-ghost text-xs disabled:opacity-40"
            >
              {refreshing
                ? <><RefreshCw size={11} className="animate-spin" />抓取中…</>
                : '立即抓取实时数据'
              }
            </button>
          </div>
        ) : (
          <>
            {/* 核心指标卡片组 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '主力净流入', value: mainInflow,  highlight: true },
                { label: '超大单净入', value: superInflow ?? 0 },
                { label: '大单净流入', value: largeInflow ?? 0 },
                { label: '主力占比',   value: null, pct: pct ?? 0 },
              ].map(({ label, value, highlight, pct: p }) => (
                <div
                  key={label}
                  className={`rounded-lg p-3 border ${
                    highlight
                      ? 'border-accent-green/30 bg-accent-green/5'
                      : 'border-terminal-border bg-terminal-muted/40'
                  }`}
                >
                  <p className="text-[10px] font-mono text-ink-muted mb-1">{label}</p>
                  {value !== null && value !== undefined ? (
                    <p className={`text-sm font-mono font-bold ${inflowColor(value)}`}>
                      {formatYuan(value)}
                    </p>
                  ) : (
                    <p className={`text-sm font-mono font-bold ${(p ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {(p ?? 0) >= 0 ? '+' : ''}{(p ?? 0).toFixed(2)}%
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 资金流向柱状可视化 */}
            {mainInflow !== null && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">资金结构</p>
                {[
                  { label: '超大单', value: superInflow ?? 0, max: Math.abs(mainInflow) || 1 },
                  { label: '大单',   value: largeInflow ?? 0, max: Math.abs(mainInflow) || 1 },
                ].map(({ label, value, max }) => {
                  const pct = Math.min(Math.abs(value) / max * 100, 100)
                  const isPos = value >= 0
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-ink-muted w-10 flex-shrink-0">{label}</span>
                      <div className="flex-1 h-2 bg-terminal-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isPos ? 'bg-accent-green/60' : 'bg-accent-red/60'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono w-16 text-right flex-shrink-0 ${inflowColor(value)}`}>
                        {formatYuan(value)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 历史快照表（最近 10 条） */}
            {logs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">历史快照</p>
                <div className="rounded-lg border border-terminal-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-terminal-border bg-terminal-muted">
                        <th className="px-2 py-1.5 text-left font-mono text-ink-muted text-[10px]">时间</th>
                        <th className="px-2 py-1.5 text-right font-mono text-ink-muted text-[10px]">主力净入</th>
                        <th className="px-2 py-1.5 text-right font-mono text-ink-muted text-[10px]">占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-terminal-border/50 last:border-0">
                          <td className="px-2 py-1.5 font-mono text-ink-muted text-[10px]">
                            {new Date(log.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className={`px-2 py-1.5 font-mono text-right text-[10px] font-semibold ${inflowColor(log.main_net_inflow)}`}>
                            {formatYuan(log.main_net_inflow)}
                          </td>
                          <td className={`px-2 py-1.5 font-mono text-right text-[10px] ${inflowColor(log.main_inflow_pct)}`}>
                            {log.main_inflow_pct >= 0 ? '+' : ''}{log.main_inflow_pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3 flex-shrink-0">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  )
}

// ── 右侧面板 Tab ──────────────────────────────────────────────────
type RightTab = 'ai' | 'moneyflow'

// ── 主页面 ────────────────────────────────────────────────────────
export default function StockDetail() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate        = useNavigate()
  const [period, setPeriod]       = useState<Period>(120)
  const [inWatchlist, setInWatchlist] = useState<boolean | null>(null)
  const [rightTab, setRightTab]   = useState<RightTab>('ai')

  const {
    data: quote, loading: quoteLoading, error: quoteError, refetch: refetchQuote,
  } = useQuery(
    useCallback(() => fetchQuote(code), [code]),
    { refetchInterval: 10_000 },
  )

  const {
    data: klineData, loading: klineLoading, error: klineError, refetch: refetchKLine,
  } = useQuery(
    useCallback(() => fetchKLine(code, period), [code, period]),
  )

  const {
    data: analysis, loading: analysisLoading, error: analysisError, refetch: refetchAnalysis,
  } = useQuery(
    useCallback(() => fetchAnalysis(code), [code]),
  )

  useQuery(
    useCallback(() => fetchWatchlist(), []),
    {
      onSuccess: (wl) => {
        setInWatchlist(wl.items.some(i => i.stock_code === code))
      },
    },
  )

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
        {/* 行情头部条 */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center justify-between flex-wrap gap-4">
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

            <div className="flex items-center gap-6">
              {quote && (
                <div className="hidden lg:grid grid-cols-4 gap-6">
                  <Metric label="今开" value={formatPrice(quote.open)} />
                  <Metric label="昨收" value={formatPrice(quote.close)} />
                  <Metric label="最高" value={formatPrice(quote.high)} color="text-accent-green" />
                  <Metric label="最低" value={formatPrice(quote.low)}  color="text-accent-red"   />
                </div>
              )}
              {quote && (
                <div className="hidden xl:grid grid-cols-3 gap-6">
                  <Metric label="成交量" value={formatVolume(quote.volume)} sub={`量比 ${quote.volume_ratio.toFixed(2)}`} />
                  <Metric label="成交额" value={formatAmount(quote.amount)} />
                  <Metric label="换手率" value={`${quote.turnover.toFixed(2)}%`} />
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
                {inWatchlist ? <><StarOff size={13} />已自选</> : <><Star size={13} />加自选</>}
              </button>
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* 左：K 线区 */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-terminal-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <BarChart2 size={13} className="text-ink-muted" />
                <span className="text-xs font-mono text-ink-muted">日K · 前复权</span>
                {klineData && <span className="tag">{klineData.klines.length} 根</span>}
              </div>
              <KLineToolbar period={period} onChange={setPeriod} loading={klineLoading} />
            </div>

            <div className="flex-1 min-h-0 p-2">
              {klineError && <div className="p-4"><ErrorBanner message={klineError} /></div>}
              {klineLoading && !klineData && (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-ink-muted">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="text-sm font-mono">加载 K 线数据…</span>
                  </div>
                </div>
              )}
              {klineData && klineData.klines.length > 0 && (
                <KLineChart data={klineData} height={undefined} />
              )}
              {klineData && klineData.klines.length === 0 && (
                <div className="h-full flex items-center justify-center text-ink-muted text-sm">
                  暂无 K 线数据
                </div>
              )}
            </div>

            {quote && (
              <div className="lg:hidden flex-shrink-0 grid grid-cols-4 gap-3 px-4 py-3 border-t border-terminal-border">
                <Metric label="今开"  value={formatPrice(quote.open)} />
                <Metric label="昨收"  value={formatPrice(quote.close)} />
                <Metric label="最高"  value={formatPrice(quote.high)}  color="text-accent-green" />
                <Metric label="最低"  value={formatPrice(quote.low)}   color="text-accent-red" />
              </div>
            )}
          </div>

          {/* 右：Tab 面板（AI 分析 / 资金流向） */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden">

            {/* 快速指标行 */}
            {quote && (
              <div className="flex-shrink-0 grid grid-cols-3 gap-0 border-b border-terminal-border">
                {[
                  { label: '量比',   value: quote.volume_ratio.toFixed(2), icon: Activity    },
                  { label: '换手',   value: `${quote.turnover.toFixed(2)}%`, icon: DollarSign },
                  { label: '成交额', value: formatAmount(quote.amount),    icon: BarChart2   },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center py-3 border-r border-terminal-border last:border-r-0">
                    <Icon size={12} className="text-ink-muted mb-1" />
                    <span className="text-[10px] font-mono text-ink-muted">{label}</span>
                    <span className="text-sm font-mono font-medium text-ink-primary mt-0.5">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 切换按钮 */}
            <div className="flex-shrink-0 flex border-b border-terminal-border">
              {([
                { key: 'ai',        label: 'AI 分析', icon: BrainCircuit },
                { key: 'moneyflow', label: '资金流向', icon: Banknote     },
              ] as { key: RightTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors border-b-2 ${
                    rightTab === key
                      ? 'border-accent-cyan text-accent-cyan'
                      : 'border-transparent text-ink-muted hover:text-ink-secondary'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-hidden">
              {rightTab === 'ai' ? (
                <AIReportPanel
                  data={analysis}
                  loading={analysisLoading}
                  error={analysisError}
                  onRefresh={refetchAnalysis}
                />
              ) : (
                <MoneyFlowPanel code={code} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
