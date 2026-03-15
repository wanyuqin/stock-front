import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, RefreshCw, BellOff, CheckCheck,
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, Clock,
} from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { ErrorBanner } from '@/components/shared'
import { fetchAlerts, markAlertsRead } from '@/api/stock'
import type { Alert } from '@/types'

// ══════════════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════════════

/** 将元转换为可读的万/亿格式 */
function formatInflow(yuan: number): { value: string; unit: string; isPositive: boolean } {
  const abs = Math.abs(yuan)
  const isPositive = yuan >= 0
  if (abs >= 1e8) {
    return { value: (abs / 1e8).toFixed(2), unit: '亿', isPositive }
  }
  return { value: (abs / 1e4).toFixed(0), unit: '万', isPositive }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}小时前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

// ══════════════════════════════════════════════════════════════
// 单条告警卡片
// ══════════════════════════════════════════════════════════════

interface AlertCardProps {
  alert: Alert
  onRead: (id: number) => void
}

function AlertCard({ alert, onRead }: AlertCardProps) {
  const navigate = useNavigate()

  const inflowFmt = formatInflow(alert.main_net_inflow)
  const deltaFmt  = formatInflow(alert.delta)

  const pctColor = alert.pct_chg > 0
    ? 'text-accent-green'
    : alert.pct_chg < 0
    ? 'text-accent-red'
    : 'text-ink-muted'

  const PctIcon = alert.pct_chg > 0 ? TrendingUp : alert.pct_chg < 0 ? TrendingDown : Minus

  return (
    <div
      className={`group relative p-3.5 border-b border-terminal-border last:border-0 transition-colors
        ${alert.is_read
          ? 'bg-transparent hover:bg-terminal-muted/30'
          : 'bg-accent-amber/5 hover:bg-accent-amber/10'
        }`}
    >
      {/* 未读指示点 */}
      {!alert.is_read && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent-amber" />
      )}

      <div className="flex items-start gap-3 pl-2">
        {/* 左侧：脉冲图标 */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-amber/10 border border-accent-amber/30
          flex items-center justify-center mt-0.5">
          <Zap size={14} className="text-accent-amber" />
        </div>

        {/* 中间：内容 */}
        <div className="flex-1 min-w-0">
          {/* 股票名称 + 代码 */}
          <div className="flex items-center gap-1.5 mb-1">
            <button
              onClick={() => navigate(`/stocks/${alert.stock_code}`)}
              className="font-medium text-ink-primary hover:text-accent-cyan transition-colors text-sm"
            >
              {alert.stock_name || alert.stock_code}
            </button>
            <span className="text-[10px] font-mono text-ink-muted">{alert.stock_code}</span>
            <span className={`flex items-center gap-0.5 text-[11px] font-mono ml-auto ${pctColor}`}>
              <PctIcon size={10} />
              {alert.pct_chg > 0 ? '+' : ''}{alert.pct_chg.toFixed(2)}%
            </span>
          </div>

          {/* 资金数据行 */}
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            {/* 累计净流入 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-ink-muted">累计净入</span>
              <span className={`text-xs font-mono font-semibold ${inflowFmt.isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
                {inflowFmt.isPositive ? '+' : '-'}{inflowFmt.value}
                <span className="text-[9px] ml-0.5">{inflowFmt.unit}</span>
              </span>
            </div>
            {/* 分隔 */}
            <span className="text-terminal-border">·</span>
            {/* 本次脉冲增量 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-ink-muted">本次脉冲</span>
              <span className="text-xs font-mono font-semibold text-accent-amber">
                +{deltaFmt.value}
                <span className="text-[9px] ml-0.5">{deltaFmt.unit}</span>
              </span>
            </div>
          </div>

          {/* 告警信息 */}
          <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
            {alert.message}
          </p>

          {/* 时间 */}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock size={9} className="text-ink-muted" />
            <span className="text-[10px] font-mono text-ink-muted">
              {timeAgo(alert.triggered_at)}
            </span>
          </div>
        </div>

        {/* 右侧：标记已读按钮 */}
        {!alert.is_read && (
          <button
            onClick={(e) => { e.stopPropagation(); onRead(alert.id) }}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center
              text-ink-muted hover:text-accent-cyan transition-all rounded"
            title="标记已读"
          >
            <CheckCheck size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// AlertPanel 主组件
// ══════════════════════════════════════════════════════════════

interface AlertPanelProps {
  /** 最大展示高度（默认 400px） */
  maxHeight?: number
}

export default function AlertPanel({ maxHeight = 400 }: AlertPanelProps) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [filterKey, setFilterKey]   = useState(0)

  const { data, loading, error, refetch } = useQuery(
    useCallback(
      () => fetchAlerts(50, unreadOnly),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [filterKey, unreadOnly],
    ),
    { refetchInterval: 60_000 }, // 每分钟自动刷新，与后端轮询同步
  )

  const alerts = data?.items ?? []
  const unreadCount = alerts.filter(a => !a.is_read).length

  // 标记单条已读
  const handleRead = async (id: number) => {
    try {
      await markAlertsRead([id])
      setFilterKey(k => k + 1)
    } catch {
      // 静默失败
    }
  }

  // 全部标记已读
  const handleReadAll = async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id)
    if (unreadIds.length === 0) return
    try {
      await markAlertsRead(unreadIds)
      setFilterKey(k => k + 1)
    } catch {
      // 静默失败
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* ── 标题栏 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <AlertTriangle size={14} className="text-accent-amber" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-accent-red
                text-[8px] font-mono font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-ink-primary">主力脉冲告警</span>
          {data && (
            <span className="tag">{data.count} 条</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 未读过滤 */}
          <button
            onClick={() => setUnreadOnly(v => !v)}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              unreadOnly
                ? 'bg-accent-amber/10 border-accent-amber/40 text-accent-amber'
                : 'border-terminal-border text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {unreadOnly ? '仅未读 ✓' : '仅未读'}
          </button>

          {/* 全部已读 */}
          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              className="text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors flex items-center gap-1"
              title="全部标记已读"
            >
              <CheckCheck size={10} />
              全读
            </button>
          )}

          {/* 刷新 */}
          <button
            onClick={refetch}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 内容区 ── */}
      {error && <div className="p-3"><ErrorBanner message={error} /></div>}

      <div className="overflow-y-auto" style={{ maxHeight }}>
        {loading && alerts.length === 0 ? (
          // 骨架屏
          <div className="divide-y divide-terminal-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3.5 flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-terminal-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 bg-terminal-muted rounded" />
                  <div className="h-2 w-48 bg-terminal-muted rounded" />
                  <div className="h-2 w-64 bg-terminal-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-ink-muted">
            <BellOff size={28} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="text-xs font-mono">
              {unreadOnly ? '暂无未读告警' : '暂无告警记录'}
            </p>
            <p className="text-[10px] font-mono mt-1 opacity-60">
              主力脉冲探测每分钟自动运行
            </p>
          </div>
        ) : (
          alerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onRead={handleRead} />
          ))
        )}
      </div>

      {/* ── 底部说明 ── */}
      <div className="px-4 py-2 border-t border-terminal-border flex items-center gap-1.5 text-[10px] font-mono text-ink-muted">
        <Zap size={9} className="text-accent-amber" />
        触发条件：主力净流入 1 分钟增量 &gt; 500万元
        <span className="ml-auto opacity-60">每分钟自动检测</span>
      </div>
    </div>
  )
}
