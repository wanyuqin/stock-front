import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Star, TrendingUp, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Search, X, Zap, Bell, Building2,
  Calendar, Filter, Loader2, Radio,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ErrorBanner, EmptyState, formatAmount } from '@/components/shared'
import { useReports } from '@/hooks/useReports'
import { syncReports } from '@/api/report'
import { fetchWatchlist } from '@/api/stock'
import { useQuery } from '@/hooks/useQuery'
import type { StockReport } from '@/types'

// ═══════════════════════════════════════════════════════════════
// 智能高亮：将关键词加粗 + 黄色背景
// ═══════════════════════════════════════════════════════════════

const HIGHLIGHT_KEYWORDS = [
  '超预期', '拐点', '重组', '首次覆盖', '业绩爆发',
  '困境反转', '战略转型', '新品放量', '高增长', '大幅超预期',
  '历史新高', '突破', '核心资产', '强烈推荐',
]

function HighlightText({ text }: { text: string }) {
  if (!text) return null

  const parts: { str: string; highlight: boolean }[] = []
  let remaining = text
  let lastIdx = 0

  // 构建正则（一次性匹配所有关键词）
  const pattern = new RegExp(`(${HIGHLIGHT_KEYWORDS.join('|')})`, 'g')
  const matches = Array.from(text.matchAll(pattern))

  if (matches.length === 0) return <span>{text}</span>

  matches.forEach(match => {
    const start = match.index!
    const end = start + match[0].length
    if (start > lastIdx) {
      parts.push({ str: text.slice(lastIdx, start), highlight: false })
    }
    parts.push({ str: match[0], highlight: true })
    lastIdx = end
  })
  if (lastIdx < text.length) {
    parts.push({ str: text.slice(lastIdx), highlight: false })
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark
            key={i}
            className="bg-accent-amber/20 text-accent-amber font-semibold px-0.5 rounded not-italic"
          >
            {p.str}
          </mark>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// 评级颜色辅助
// ═══════════════════════════════════════════════════════════════

function ratingStyle(rating: string): string {
  if (rating === '买入' || rating === '买入-A' || rating === '强烈推荐') {
    return 'border-l-accent-red text-accent-red bg-accent-red/8'
  }
  if (rating === '增持' || rating === '推荐') {
    return 'border-l-accent-amber text-accent-amber bg-accent-amber/8'
  }
  return 'border-l-terminal-border text-ink-secondary bg-transparent'
}

function RatingTag({ rating }: { rating: string }) {
  const isBuy = rating === '买入' || rating === '买入-A' || rating === '强烈推荐'
  const isHold = rating === '增持' || rating === '推荐'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
      isBuy  ? 'bg-accent-red/10 border-accent-red/40 text-accent-red' :
      isHold ? 'bg-accent-amber/10 border-accent-amber/40 text-accent-amber' :
               'bg-terminal-muted border-terminal-border text-ink-muted'
    }`}>
      {isBuy && <Zap size={8} />}
      {rating || '—'}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// 单张研报卡片
// ═══════════════════════════════════════════════════════════════

interface ReportCardProps {
  report: StockReport
  watchCodes: Set<string>      // 持仓/自选股代码集合（用于高亮）
  onBuy: (code: string, name: string) => void
}

function ReportCard({ report, watchCodes, onBuy }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isWatched = watchCodes.has(report.stock_code)

  const borderClass = ratingStyle(report.rating_name)
  const publishedAt = (() => {
    try {
      const d = new Date(report.publish_date)
      const now = new Date()
      const diffH = (now.getTime() - d.getTime()) / 3600000
      if (diffH < 1) return `${Math.round(diffH * 60)}分钟前`
      if (diffH < 24) return `${Math.round(diffH)}小时前`
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    } catch { return '' }
  })()

  return (
    <div className={`
      relative card border-l-4 p-0 overflow-hidden animate-fade-in
      ${borderClass.split(' ').filter(c => c.startsWith('border-l-')).join(' ')}
      ${isWatched ? 'ring-1 ring-accent-amber/30' : ''}
      hover:border-l-opacity-100 transition-all duration-200
    `}>
      {/* 持仓/自选标记 */}
      {isWatched && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono text-accent-amber bg-accent-amber/10 border border-accent-amber/30 px-1.5 py-0.5 rounded-full z-10">
          <Star size={8} fill="currentColor" />
          自选
        </div>
      )}

      {/* 顶部 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-2 flex-wrap pr-14">
          {/* 股票标识 */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs text-ink-muted">{report.stock_code}</span>
            <span className="text-sm font-semibold text-ink-primary">{report.stock_name}</span>
          </div>
          <RatingTag rating={report.rating_name} />
        </div>

        {/* 机构 + 时间 */}
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Building2 size={10} />
            {report.org_sname || report.org_name}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
            <Calendar size={10} />
            {publishedAt}
          </span>
        </div>
      </div>

      {/* 标题 */}
      <div className="px-4 pb-3">
        <p className="text-sm text-ink-primary leading-relaxed line-clamp-2">
          <HighlightText text={report.title} />
        </p>
      </div>

      {/* AI 摘要折叠 */}
      {report.is_processed && report.ai_summary && (
        <div className="border-t border-terminal-border">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-mono text-ink-secondary hover:text-ink-primary hover:bg-terminal-muted/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Radio size={10} className="text-accent-cyan" />
              AI 核心逻辑
            </span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {expanded && (
            <div className="px-4 pb-3 bg-terminal-muted/30 border-t border-terminal-border/50">
              <p className="text-xs text-ink-secondary leading-relaxed pt-2">
                <HighlightText text={report.ai_summary} />
              </p>
            </div>
          )}
        </div>
      )}

      {/* 未生成摘要 */}
      {!report.is_processed && (
        <div className="border-t border-terminal-border px-4 py-2">
          <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
            <Loader2 size={9} className="animate-spin" />
            AI 摘要生成中…
          </span>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-terminal-border bg-terminal-muted/20">
        <button
          onClick={() => onBuy(report.stock_code, report.stock_name)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
            bg-accent-green/10 border border-accent-green/30 text-accent-green
            hover:bg-accent-green/20 hover:border-accent-green/50 transition-all"
        >
          <TrendingUp size={11} />
          买入
        </button>

        {report.detail_url ? (
          <a
            href={report.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-ink-secondary
              border border-terminal-border rounded-lg hover:text-ink-primary hover:border-ink-muted/40 transition-all"
          >
            <ExternalLink size={10} />
            原文
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 过滤栏
// ═══════════════════════════════════════════════════════════════

interface FilterBarProps {
  ratingFilter: 'all' | 'buy'
  timeFilter: 'all' | 'today' | 'week'
  searchCode: string
  onRatingChange: (v: 'all' | 'buy') => void
  onTimeChange: (v: 'all' | 'today' | 'week') => void
  onSearchChange: (v: string) => void
  total: number
  isSyncing: boolean
  onSync: () => void
}

function FilterBar({
  ratingFilter, timeFilter, searchCode,
  onRatingChange, onTimeChange, onSearchChange,
  total, isSyncing, onSync,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 总数 */}
      <span className="text-xs font-mono text-ink-muted">
        共 <span className="text-ink-secondary">{total}</span> 条
      </span>

      <div className="flex items-center gap-1 ml-auto flex-wrap">
        {/* 评级筛选 */}
        <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[11px] font-mono">
          {(['all', 'buy'] as const).map(v => (
            <button key={v} onClick={() => onRatingChange(v)}
              className={`px-2.5 py-1.5 transition-colors ${
                ratingFilter === v
                  ? 'bg-terminal-muted text-ink-primary'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}>
              {v === 'all' ? '全部评级' : '仅买入'}
            </button>
          ))}
        </div>

        {/* 时间筛选 */}
        <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[11px] font-mono">
          {([['all', '全部'], ['today', '今日'], ['week', '本周']] as const).map(([v, label]) => (
            <button key={v} onClick={() => onTimeChange(v)}
              className={`px-2.5 py-1.5 transition-colors ${
                timeFilter === v
                  ? 'bg-terminal-muted text-ink-primary'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* 代码搜索 */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text" maxLength={6} placeholder="代码筛选…"
            value={searchCode}
            onChange={e => onSearchChange(e.target.value.replace(/\D/g, ''))}
            className="pl-7 pr-7 py-1.5 w-28 bg-terminal-muted border border-terminal-border rounded-lg
              text-xs font-mono text-ink-primary placeholder-ink-muted/40
              focus:outline-none focus:border-accent-green/40 transition-colors"
          />
          {searchCode && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary">
              <X size={10} />
            </button>
          )}
        </div>

        {/* 同步按钮 */}
        <button onClick={onSync} disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono
            border border-terminal-border rounded-lg text-ink-muted
            hover:text-ink-primary hover:border-accent-cyan/40 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed">
          <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? '同步中…' : '同步'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 新研报 Banner
// ═══════════════════════════════════════════════════════════════

function NewReportBanner({ count, onRefresh, onDismiss }: {
  count: number
  onRefresh: () => void
  onDismiss: () => void
}) {
  if (count <= 0) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-sm animate-slide-up">
      <Bell size={14} className="text-accent-cyan flex-shrink-0 animate-pulse" />
      <span className="text-ink-primary flex-1">
        有 <span className="font-semibold text-accent-cyan">{count}</span> 条新研报
      </span>
      <button onClick={onRefresh}
        className="text-xs font-mono text-accent-cyan hover:text-white transition-colors">
        点击刷新
      </button>
      <button onClick={onDismiss} className="text-ink-muted hover:text-ink-primary transition-colors">
        <X size={12} />
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 空状态
// ═══════════════════════════════════════════════════════════════

function ReportEmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-ink-muted">
      <div className="w-16 h-16 rounded-2xl border border-terminal-border bg-terminal-muted flex items-center justify-center mb-4">
        <FileText size={28} strokeWidth={1.2} className="text-ink-muted" />
      </div>
      {isFiltered ? (
        <>
          <p className="text-sm font-medium text-ink-secondary mb-1">没有符合条件的研报</p>
          <p className="text-xs text-ink-muted">尝试调整筛选条件</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-secondary mb-1">今日暂无研报</p>
          <p className="text-xs text-ink-muted">市场在休息，你也可以喝杯茶 ☕</p>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 卡片骨架屏
// ═══════════════════════════════════════════════════════════════

function CardSkeleton() {
  return (
    <div className="card border-l-4 border-l-terminal-border p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-16 bg-terminal-muted rounded" />
        <div className="h-3 w-24 bg-terminal-muted rounded" />
        <div className="h-4 w-12 bg-terminal-muted rounded-full ml-auto" />
      </div>
      <div className="h-3 w-full bg-terminal-muted rounded" />
      <div className="h-3 w-3/4 bg-terminal-muted rounded" />
      <div className="flex gap-2 pt-1">
        <div className="h-6 w-14 bg-terminal-muted rounded-lg" />
        <div className="h-6 w-14 bg-terminal-muted rounded-lg" />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════════════════════

export default function IntelStation() {
  const navigate = useNavigate()

  // 筛选状态
  const [ratingFilter, setRatingFilter] = useState<'all' | 'buy'>('all')
  const [timeFilter, setTimeFilter]     = useState<'all' | 'today' | 'week'>('all')
  const [searchCode, setSearchCode]     = useState('')
  const [isSyncing, setIsSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]           = useState<string | null>(null)

  // 获取自选股列表（用于高亮 + Dashboard 联动）
  const { data: wlData } = useQuery(useCallback(() => fetchWatchlist(), []))
  const watchCodes = new Set(wlData?.items.map(i => i.stock_code) ?? [])

  // 研报数据（searchCode 作为 stockCode 联动）
  const {
    items, total, loading, loadingMore, error,
    hasMore, newCount, loadMore, refresh, dismissNewBanner,
  } = useReports({
    stockCode:    searchCode.length === 6 ? searchCode : undefined,
    ratingFilter,
    timeFilter,
  })

  // 无限滚动哨兵
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore() },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  // 手动同步
  const handleSync = async () => {
    setIsSyncing(true)
    setSyncMsg(null)
    try {
      const res = await syncReports(3)
      const { saved } = res.data.data
      setSyncMsg(saved > 0 ? `新增 ${saved} 条研报` : '已是最新')
      refresh()
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  // 买入跳转（跳到交易日志页，预填代码）
  const handleBuy = (code: string) => {
    navigate(`/trades?add=${code}`)
  }

  const isFiltered = ratingFilter !== 'all' || timeFilter !== 'all' || searchCode !== ''

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="研报情报站"
        subtitle="机构深度 · AI 提炼 · 快速决策"
        onRefresh={refresh}
        loading={loading}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* 新研报 Banner */}
        <NewReportBanner
          count={newCount}
          onRefresh={refresh}
          onDismiss={dismissNewBanner}
        />

        {/* 同步状态提示 */}
        {syncMsg && (
          <div className="flex items-center gap-2 px-4 py-2 bg-accent-green/10 border border-accent-green/30 rounded-lg text-xs font-mono text-accent-green animate-fade-in">
            <RefreshCw size={11} />
            {syncMsg}
          </div>
        )}

        {/* 错误 */}
        {error && <ErrorBanner message={error} />}

        {/* 过滤栏 */}
        <FilterBar
          ratingFilter={ratingFilter}
          timeFilter={timeFilter}
          searchCode={searchCode}
          onRatingChange={v => { setRatingFilter(v); }}
          onTimeChange={v => { setTimeFilter(v); }}
          onSearchChange={setSearchCode}
          total={total}
          isSyncing={isSyncing}
          onSync={handleSync}
        />

        {/* 主内容：左侧自选股池 + 右侧研报流 */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

          {/* 左侧：关注股票池监控 */}
          <div className="xl:col-span-1">
            <WatchPoolPanel
              watchItems={wlData?.items ?? []}
              activeCode={searchCode}
              onSelect={code => setSearchCode(prev => prev === code ? '' : code)}
            />
          </div>

          {/* 右侧：研报流 */}
          <div className="xl:col-span-3 space-y-3">
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : items.length === 0 ? (
              <div className="card">
                <ReportEmptyState isFiltered={isFiltered} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {items.map(report => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      watchCodes={watchCodes}
                      onBuy={handleBuy}
                    />
                  ))}
                </div>

                {/* 无限滚动哨兵 */}
                <div ref={sentinelRef} className="h-4" />

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-ink-muted" />
                  </div>
                )}

                {!hasMore && items.length > 0 && (
                  <p className="text-center text-xs font-mono text-ink-muted py-4">
                    — 已加载全部 {items.length} 条 —
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 左侧：关注股票池监控面板
// ═══════════════════════════════════════════════════════════════

interface WatchPoolProps {
  watchItems: { stock_code: string; quote: { name?: string; change_rate?: number } | null }[]
  activeCode: string
  onSelect: (code: string) => void
}

function WatchPoolPanel({ watchItems, activeCode, onSelect }: WatchPoolProps) {
  return (
    <div className="card overflow-hidden sticky top-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-terminal-border">
        <Filter size={13} className="text-accent-cyan" />
        <span className="text-sm font-medium text-ink-primary">关注股票池</span>
        <span className="tag text-ink-muted">{watchItems.length}</span>
      </div>

      <div className="divide-y divide-terminal-border max-h-[calc(100vh-240px)] overflow-y-auto">
        {/* 「全部」选项 */}
        <button
          onClick={() => onSelect('')}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-left
            ${activeCode === ''
              ? 'bg-terminal-muted text-ink-primary'
              : 'text-ink-secondary hover:bg-terminal-muted/50 hover:text-ink-primary'}`}
        >
          <span className="font-mono text-ink-muted w-14">ALL</span>
          <span className="flex-1">全部研报</span>
        </button>

        {watchItems.map(item => {
          const rate = item.quote?.change_rate ?? 0
          const isActive = activeCode === item.stock_code
          return (
            <button
              key={item.stock_code}
              onClick={() => onSelect(item.stock_code)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors text-left
                ${isActive
                  ? 'bg-terminal-muted text-ink-primary border-l-2 border-l-accent-green'
                  : 'text-ink-secondary hover:bg-terminal-muted/50 hover:text-ink-primary border-l-2 border-l-transparent'}`}
            >
              <span className="font-mono text-ink-muted w-14">{item.stock_code}</span>
              <span className="flex-1 text-ink-primary">{item.quote?.name ?? item.stock_code}</span>
              <span className={`font-mono text-[10px] ${rate > 0 ? 'text-accent-green' : rate < 0 ? 'text-accent-red' : 'text-ink-muted'}`}>
                {rate > 0 ? '+' : ''}{rate.toFixed(2)}%
              </span>
            </button>
          )
        })}

        {watchItems.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-ink-muted">
            添加自选股后可快速筛选
          </div>
        )}
      </div>
    </div>
  )
}
