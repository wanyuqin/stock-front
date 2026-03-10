import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, TrendingUp, TrendingDown, Activity, Database, ExternalLink } from 'lucide-react'
import Topbar from '@/components/Topbar'
import DailyReportView from '@/components/DailyReportView'
import { useQuery } from '@/hooks/useQuery'
import { fetchWatchlist, fetchStocks } from '@/api/stock'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, EmptyState, SkeletonRow, ErrorBanner,
} from '@/components/shared'

// ── 统计卡片 ──────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color?: string
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-ink-secondary' }: StatCardProps) {
  return (
    <div className="card p-4 flex items-start justify-between animate-fade-in">
      <div>
        <p className="text-ink-muted text-xs font-mono uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-2xl font-mono font-semibold ${color}`}>{value}</p>
        {sub && <p className="text-ink-muted text-xs mt-1">{sub}</p>}
      </div>
      <div className={`w-9 h-9 rounded-lg bg-terminal-muted border border-terminal-border flex items-center justify-center ${color}`}>
        <Icon size={16} strokeWidth={1.8} />
      </div>
    </div>
  )
}

// ── 自选股行情快照 ────────────────────────────────────────────────
function WatchlistSnapshot() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchWatchlist(), []),
    { refetchInterval: 10_000 },
  )

  const items = data?.items ?? []

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-accent-amber" />
          <span className="text-sm font-medium text-ink-primary">自选股行情</span>
          <span className="tag">{items.length} 只</span>
        </div>
        <button
          onClick={refetch}
          className="text-xs font-mono text-ink-muted hover:text-accent-cyan transition-colors"
        >
          刷新
        </button>
      </div>

      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-terminal-border">
            {['代码 / 名称', '最新价', '涨跌幅', '涨跌额', '成交额'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && items.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            : items.length === 0
              ? <tr><td colSpan={5}><EmptyState message="还没有自选股，去添加一只吧" /></td></tr>
              : items.map(item => {
                  const q     = item.quote
                  const rate  = q?.change_rate ?? 0
                  const color = getPriceColor(rate)
                  return (
                    <tr
                      key={item.id}
                      className="data-row group"
                      onClick={() => navigate(`/stocks/${item.stock_code}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-ink-muted text-xs">{item.stock_code}</span>
                        <span className="ml-2 text-ink-primary text-sm">{q?.name ?? '—'}</span>
                        {item.note && (
                          <span className="ml-2 text-[10px] text-ink-muted bg-terminal-muted px-1.5 py-0.5 rounded">
                            {item.note}
                          </span>
                        )}
                        <ExternalLink
                          size={10}
                          className="ml-1.5 inline-block text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </td>
                      <td className={`px-4 py-3 font-mono font-medium ${color}`}>
                        {q ? formatPrice(q.price) : '—'}
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${color}`}>
                        {q ? formatRate(rate) : '—'}
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${color}`}>
                        {q ? (rate > 0 ? '+' : '') + q.change.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-secondary">
                        {q ? formatAmount(q.amount) : '—'}
                      </td>
                    </tr>
                  )
                })
          }
        </tbody>
      </table>
    </div>
  )
}

// ── 股票库概览 ────────────────────────────────────────────────────
function StockLibrary() {
  const navigate = useNavigate()
  const { data, loading } = useQuery(
    useCallback(() => fetchStocks(10), []),
  )
  const stocks = data?.items ?? []

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
        <Database size={14} className="text-accent-cyan" />
        <span className="text-sm font-medium text-ink-primary">股票库</span>
        <span className="tag">最近收录</span>
      </div>

      <div className="divide-y divide-terminal-border">
        {loading && stocks.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="h-3 w-16 bg-terminal-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-terminal-muted rounded animate-pulse" />
              </div>
            ))
          : stocks.map(s => (
              <div
                key={s.id}
                className="px-5 py-2.5 flex items-center gap-3 hover:bg-terminal-muted transition-colors cursor-pointer group"
                onClick={() => navigate(`/stocks/${s.code}`)}
              >
                <span className="font-mono text-xs text-ink-muted w-16">{s.code}</span>
                <span className="text-sm text-ink-primary flex-1">{s.name}</span>
                <span className="tag">{s.market}</span>
                {s.sector && <span className="text-xs text-ink-muted">{s.sector}</span>}
                <ExternalLink size={10} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: wlData, loading: wlLoading, refetch } = useQuery(
    useCallback(() => fetchWatchlist(), []),
  )

  const items     = wlData?.items ?? []
  const upCount   = items.filter(i => (i.quote?.change_rate ?? 0) > 0).length
  const downCount = items.filter(i => (i.quote?.change_rate ?? 0) < 0).length
  const totalAmt  = items.reduce((s, i) => s + (i.quote?.amount ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="仪表盘"
        subtitle="个人 A 股分析系统"
        onRefresh={refetch}
        loading={wlLoading}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── 统计卡片行 ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="自选股"   value={String(items.length)} sub="只股票" icon={Star}
            color="text-accent-amber"
          />
          <StatCard
            label="上涨"     value={String(upCount)}
            sub={items.length > 0 ? `占比 ${Math.round(upCount   / items.length * 100)}%` : '—'}
            icon={TrendingUp}  color="text-accent-green"
          />
          <StatCard
            label="下跌"     value={String(downCount)}
            sub={items.length > 0 ? `占比 ${Math.round(downCount / items.length * 100)}%` : '—'}
            icon={TrendingDown} color="text-accent-red"
          />
          <StatCard
            label="总成交额"  value={formatAmount(totalAmt)} sub="自选股合计"
            icon={Activity}   color="text-accent-cyan"
          />
        </div>

        {/* ── 主内容区：左（行情 + 股票库）右（AI 复盘简报）── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* 左侧 3/5 */}
          <div className="xl:col-span-3 space-y-5">
            <WatchlistSnapshot />
            <StockLibrary />
          </div>

          {/* 右侧 2/5 — 每日复盘简报 */}
          <div className="xl:col-span-2">
            <DailyReportView maxContentHeight={520} />
          </div>
        </div>
      </div>
    </div>
  )
}
