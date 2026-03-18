import { useCallback, useState } from 'react'
import { RefreshCw, DatabaseZap } from 'lucide-react'
import ValuationGauge from '@/components/ValuationGauge'
import { useQuery } from '@/hooks/useQuery'
import { fetchValuation, backfillValuationHistory } from '@/api/stock'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { ErrorBanner } from '@/components/shared'
import { PieChart } from 'lucide-react'

interface ValuationPanelProps {
  code: string
}

export default function ValuationPanel({ code }: ValuationPanelProps) {
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')

  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchValuation(code), [code]),
  )

  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfillMsg('')
    try {
      const resp = await backfillValuationHistory(90)
      const d = resp.data.data
      setBackfillMsg(`回补完成：写入 ${d.success} 只股票的历史数据`)
      // 延迟 1s 等后端算完分位再刷新
      setTimeout(() => refetch(), 1000)
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : '回补失败，请重试')
    } finally {
      setBackfilling(false)
    }
  }

  const histDays = data?.history_days ?? 0
  const showBackfill = histDays < 30 // 不足 30 天都显示回补入口

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <PieChart size={13} className="text-accent-amber" />
          <span className="text-xs font-medium text-ink-primary">估值分位</span>
          {data && (
            <span className="text-[10px] font-mono text-ink-muted">
              {data.updated_at?.slice(0, 16) ?? '—'}
            </span>
          )}
        </div>
        <button
          onClick={refetch}
          className="text-[11px] font-mono text-ink-muted hover:text-accent-cyan transition-colors flex items-center gap-1"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center p-4 gap-3">
        {loading && !data && (
          <div className="flex flex-col items-center gap-3 text-ink-muted mt-8">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-xs font-mono">获取估值数据…</span>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            <ValuationGauge
              peTTM={data.pe_ttm}
              pb={data.pb}
              pePercentile={data.pe_percentile}
              pbPercentile={data.pb_percentile}
              historyDays={data.history_days}
              status={data.status}
              size={220}
            />

            {/* 决策辅助标语 */}
            {data.status === 'undervalued' && (
              <div className="flex items-center gap-2 w-full px-2 py-2 rounded-lg bg-accent-green/8 border border-accent-green/25 text-xs text-accent-green font-mono">
                <TrendingUp size={12} />
                估值处于历史低位，可关注建仓机会
              </div>
            )}
            {data.status === 'overvalued' && (
              <div className="flex items-center gap-2 w-full px-2 py-2 rounded-lg bg-accent-red/8 border border-accent-red/25 text-xs text-accent-red font-mono">
                <TrendingDown size={12} />
                估值处于历史高位，注意控制仓位
              </div>
            )}
            {data.status === 'loss' && (
              <div className="w-full px-2 py-2 rounded-lg bg-ink-muted/10 border border-terminal-border text-xs text-ink-muted font-mono">
                当前处于亏损期，PE 无参考意义
              </div>
            )}

            {/* 历史数据不足时的回补入口（< 30 天均显示） */}
            {showBackfill && (
              <div className="w-full rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <DatabaseZap size={13} className="text-accent-amber mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] font-mono text-ink-muted leading-relaxed">
                    <span className="text-accent-amber font-semibold">
                      历史数据 {histDays} 天，分位参考价值有限
                    </span>
                    <br />
                    点击下方按钮用当前 PE/PB 值回补过去 90 天，
                    立即激活分位计算。后续每日 16:30 自动追加真实数据。
                  </div>
                </div>

                <button
                  onClick={handleBackfill}
                  disabled={backfilling}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-md
                    border border-accent-amber/50 bg-accent-amber/10
                    text-xs font-mono text-accent-amber
                    hover:bg-accent-amber/20 active:scale-95
                    transition-all duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {backfilling ? (
                    <><RefreshCw size={11} className="animate-spin" />回补中，请稍候（约 10s）…</>
                  ) : (
                    <><DatabaseZap size={11} />一键回补过去 90 天历史数据</>
                  )}
                </button>

                {backfillMsg && (
                  <p className={`text-[10px] font-mono text-center pt-0.5 ${
                    backfillMsg.includes('完成') ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {backfillMsg}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
