import { useCallback, useEffect } from 'react'
import { AlertTriangle, Thermometer, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { fetchMarketSummary } from '@/api/stock'
import { formatAmount } from '@/components/shared'

interface Props {
  /**
   * 外部刷新触发器——每次仪表盘点「刷新」时把一个递增数字传进来，
   * MarketSentimentBar 检测到变化后立即重新请求。
   */
  refreshTrigger?: number
}

export default function MarketSentimentBar({ refreshTrigger = 0 }: Props) {
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchMarketSummary(), []),
    { refetchInterval: 60_000 },
  )

  // 外部 trigger 变化 → 立即刷新（trigger=0 是初始值，跳过）
  useEffect(() => {
    if (refreshTrigger > 0) refetch()
  }, [refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-24 h-4 bg-terminal-muted rounded" />
          <div className="flex-1 h-2 bg-terminal-muted rounded-full" />
          <div className="w-16 h-4 bg-terminal-muted rounded" />
        </div>
      </div>
    )
  }

  if (error || !data) return null

  const { sentiment_score, total_amount, alert_status, daily_summary, up_count, down_count } = data
  const isDanger    = alert_status === 'DANGER'
  const isWarning   = alert_status === 'WARNING'
  const isLowVolume = total_amount < 700_000_000_000

  return (
    <div className="space-y-3 animate-fade-in">
      {isDanger && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-3 flex items-center gap-3 text-accent-red animate-pulse">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <span className="font-semibold text-sm">
            [宏观警报] 市场进入极寒模式 (分数 {sentiment_score})，系统已限制激进开仓。
          </span>
        </div>
      )}

      <div className={`card p-4 flex items-center gap-6 ${isDanger ? 'border-accent-red/40' : ''}`}>

        {/* 热度仪表盘 */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-ink-primary font-medium text-sm">
              <Thermometer size={14} className={sentiment_score > 50 ? 'text-accent-red' : 'text-accent-blue'} />
              <span>市场热度</span>
              <span className={`font-mono font-bold ${
                sentiment_score > 70 ? 'text-accent-red'   :
                sentiment_score < 30 ? 'text-accent-blue'  : 'text-accent-amber'
              }`}>
                {sentiment_score}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">
                {isDanger ? '极寒' : isWarning ? '偏弱' : '情绪稳定'}
              </span>
              <button
                onClick={refetch}
                disabled={loading}
                title="刷新市场数据"
                className="text-ink-muted hover:text-ink-primary transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* 渐变进度条 */}
          <div className="h-2 w-full bg-terminal-muted rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500 opacity-80" />
            <div
              className="absolute top-0 bottom-0 right-0 bg-terminal-muted transition-all duration-1000 ease-out"
              style={{ width: `${100 - sentiment_score}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10"
              style={{ left: `${sentiment_score}%` }}
            />
          </div>
        </div>

        <div className="h-8 w-[1px] bg-terminal-border hidden md:block" />

        {/* 成交额 */}
        <div className="flex flex-col items-start min-w-[120px]">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-0.5">
            <DollarSign size={12} />
            <span>两市成交</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono font-bold text-lg ${isLowVolume ? 'text-accent-amber' : 'text-ink-primary'}`}>
              {formatAmount(total_amount)}
            </span>
            {isLowVolume && (
              <span className="text-[10px] text-accent-amber bg-accent-amber/10 px-1 rounded">存量博弈</span>
            )}
          </div>
        </div>

        <div className="h-8 w-[1px] bg-terminal-border hidden md:block" />

        {/* 涨跌分布 */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-accent-red font-mono font-bold text-base flex items-center gap-1">
              <TrendingUp size={12} /> {up_count}
            </span>
            <span className="text-ink-muted scale-90">上涨</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-accent-green font-mono font-bold text-base flex items-center gap-1">
              <TrendingDown size={12} /> {down_count}
            </span>
            <span className="text-ink-muted scale-90">下跌</span>
          </div>
        </div>

        {/* 简评 */}
        <div className="ml-auto hidden lg:block max-w-[300px] text-right">
          <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{daily_summary}</p>
        </div>
      </div>
    </div>
  )
}
