import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, FileText } from 'lucide-react'
import { fetchReportCount } from '@/api/report'
import { fetchWatchlist } from '@/api/stock'
import { useQuery } from '@/hooks/useQuery'

const POLL_INTERVAL = 30 * 60 * 1000  // 30 分钟

/**
 * ReportToast — 监控持仓股的新研报，有新研报时弹出通知条。
 * 放在 Dashboard 或 Layout 中，不阻断 UI。
 */
export default function ReportToast() {
  const navigate = useNavigate()
  const [toasts, setToasts] = useState<{ code: string; name: string; id: number }[]>([])
  const lastCountRef = { current: {} as Record<string, number> }

  // 获取自选股列表
  const { data: wlData } = useQuery(useCallback(() => fetchWatchlist(), []))
  const watchItems = wlData?.items ?? []

  // 针对每只自选股轮询研报数量
  useEffect(() => {
    if (watchItems.length === 0) return

    const check = async () => {
      for (const item of watchItems) {
        try {
          const res = await fetchReportCount(item.stock_code)
          const count = res.data.data?.total ?? 0
          const prev = lastCountRef.current[item.stock_code]

          if (prev !== undefined && count > prev) {
            setToasts(t => [
              ...t.filter(x => x.code !== item.stock_code),
              { code: item.stock_code, name: item.quote?.name ?? item.stock_code, id: Date.now() },
            ])
          }
          lastCountRef.current[item.stock_code] = count
        } catch {
          // 静默失败
        }
      }
    }

    // 首次初始化（只记录，不弹出）
    const init = async () => {
      for (const item of watchItems) {
        try {
          const res = await fetchReportCount(item.stock_code)
          lastCountRef.current[item.stock_code] = res.data.data?.total ?? 0
        } catch { /* ignore */ }
      }
    }

    init()
    const timer = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [watchItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = (code: string) =>
    setToasts(t => t.filter(x => x.code !== code))

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="flex items-start gap-3 px-4 py-3 bg-terminal-panel border border-accent-amber/40
            rounded-xl shadow-panel animate-slide-up text-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-accent-amber/10 border border-accent-amber/30
            flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText size={14} className="text-accent-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-accent-amber uppercase tracking-wider mb-0.5">
              研报更新
            </p>
            <p className="text-ink-primary text-xs leading-snug">
              持仓股 <span className="font-semibold">{toast.name}</span> 发布最新深度评级：
              <span className="text-accent-red font-semibold"> 买入</span>
            </p>
            <button
              onClick={() => { navigate('/intel'); dismiss(toast.code) }}
              className="mt-1.5 text-[11px] font-mono text-accent-cyan hover:text-white transition-colors"
            >
              查看研报 →
            </button>
          </div>
          <button
            onClick={() => dismiss(toast.code)}
            className="text-ink-muted hover:text-ink-primary transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * useReportAlert — 轻量 hook，给 Dashboard 顶部 banner 用
 * 返回有新研报的持仓股代码列表
 */
export function useReportAlert(): { alerts: string[]; dismiss: (code: string) => void } {
  const [alerts, setAlerts] = useState<string[]>([])
  const lastCountRef = useCallback(() => ({} as Record<string, number>), [])()

  const { data: wlData } = useQuery(useCallback(() => fetchWatchlist(), []))
  const watchItems = wlData?.items ?? []

  useEffect(() => {
    if (watchItems.length === 0) return

    const init = async () => {
      for (const item of watchItems) {
        try {
          const res = await fetchReportCount(item.stock_code)
          lastCountRef[item.stock_code] = res.data.data?.total ?? 0
        } catch { /* ignore */ }
      }
    }

    const check = async () => {
      for (const item of watchItems) {
        try {
          const res = await fetchReportCount(item.stock_code)
          const count = res.data.data?.total ?? 0
          const prev = lastCountRef[item.stock_code]
          if (prev !== undefined && count > prev) {
            setAlerts(a => a.includes(item.stock_code) ? a : [...a, item.stock_code])
          }
          lastCountRef[item.stock_code] = count
        } catch { /* ignore */ }
      }
    }

    init()
    const timer = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [watchItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback((code: string) => {
    setAlerts(a => a.filter(c => c !== code))
  }, [])

  return { alerts, dismiss }
}
