import { RefreshCw, Search, Bell, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'

interface TopbarProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  loading?: boolean
}

export default function Topbar({ title, subtitle, onRefresh, loading }: TopbarProps) {
  const [isOnline] = useState(navigator.onLine)

  const now = new Date()
  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })

  return (
    <header className="
      h-12 flex-shrink-0 flex items-center justify-between
      px-5 border-b border-terminal-border bg-terminal-surface
    ">
      {/* 左侧：页面标题 */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-semibold text-ink-primary leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-ink-muted font-mono leading-tight">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* 右侧：工具栏 */}
      <div className="flex items-center gap-2">
        {/* 时间显示 */}
        <div className="hidden sm:flex flex-col items-end mr-2">
          <span className="text-xs font-mono text-ink-primary tabular-nums">
            {timeStr}
          </span>
          <span className="text-[10px] font-mono text-ink-muted">
            {dateStr}
          </span>
        </div>

        {/* 网络状态 */}
        <div className={`w-7 h-7 rounded-md flex items-center justify-center
          ${isOnline ? 'text-accent-green' : 'text-accent-red'}
        `}>
          {isOnline
            ? <Wifi size={13} />
            : <WifiOff size={13} />
          }
        </div>

        {/* 搜索 */}
        <button className="
          w-7 h-7 rounded-md flex items-center justify-center
          text-ink-muted hover:text-ink-primary hover:bg-terminal-muted
          border border-transparent hover:border-terminal-border
          transition-all duration-150
        ">
          <Search size={13} />
        </button>

        {/* 通知 */}
        <button className="
          relative w-7 h-7 rounded-md flex items-center justify-center
          text-ink-muted hover:text-ink-primary hover:bg-terminal-muted
          border border-transparent hover:border-terminal-border
          transition-all duration-150
        ">
          <Bell size={13} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-accent-amber rounded-full" />
        </button>

        {/* 刷新 */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="
              w-7 h-7 rounded-md flex items-center justify-center
              text-ink-muted hover:text-ink-primary hover:bg-terminal-muted
              border border-transparent hover:border-terminal-border
              transition-all duration-150 disabled:opacity-40
            "
          >
            <RefreshCw
              size={13}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        )}
      </div>
    </header>
  )
}
