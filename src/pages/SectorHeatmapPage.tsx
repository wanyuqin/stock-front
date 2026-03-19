import { useCallback } from 'react'
import { BarChart2, RefreshCw } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { ErrorBanner, EmptyState } from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

interface SectorHeatItem {
  code:        string
  name:        string
  change_rate: number
  strength:    'strong_up' | 'up' | 'flat' | 'down' | 'strong_down'
}

interface SectorHeatmapDTO {
  items:      SectorHeatItem[]
  updated_at: string
  from_cache: boolean
}

const fetchHeatmap = () =>
  http.get<ApiResponse<SectorHeatmapDTO>>('/market/sector-heatmap')

const STRENGTH_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  strong_up:   { bg: 'bg-accent-green/20',  text: 'text-accent-green',  border: 'border-accent-green/40' },
  up:          { bg: 'bg-accent-green/8',   text: 'text-accent-green',  border: 'border-accent-green/20' },
  flat:        { bg: 'bg-terminal-muted',   text: 'text-ink-secondary', border: 'border-terminal-border' },
  down:        { bg: 'bg-accent-red/8',     text: 'text-accent-red',    border: 'border-accent-red/20'   },
  strong_down: { bg: 'bg-accent-red/20',    text: 'text-accent-red',    border: 'border-accent-red/40'   },
}

// 热力图色块大小根据涨跌幅绝对值动态缩放
function sizeClass(rate: number): string {
  const abs = Math.abs(rate)
  if (abs >= 5)  return 'text-base font-bold'
  if (abs >= 3)  return 'text-sm font-semibold'
  if (abs >= 1)  return 'text-xs font-medium'
  return 'text-xs'
}

function HeatBlock({ item }: { item: SectorHeatItem }) {
  const style = STRENGTH_STYLE[item.strength] ?? STRENGTH_STYLE.flat
  const sign = item.change_rate >= 0 ? '+' : ''

  return (
    <div className={`rounded-lg border ${style.bg} ${style.border} p-3 flex flex-col justify-between min-h-[72px] transition-all hover:ring-1 hover:ring-white/10`}>
      <p className="text-[10px] font-mono text-ink-muted truncate">{item.name}</p>
      <p className={`font-mono mt-1 ${sizeClass(item.change_rate)} ${style.text}`}>
        {sign}{item.change_rate.toFixed(2)}%
      </p>
    </div>
  )
}

// 涨跌分布柱状图
function DistBar({ items }: { items: SectorHeatItem[] }) {
  const counts = {
    strong_up:   items.filter(i => i.strength === 'strong_up').length,
    up:          items.filter(i => i.strength === 'up').length,
    flat:        items.filter(i => i.strength === 'flat').length,
    down:        items.filter(i => i.strength === 'down').length,
    strong_down: items.filter(i => i.strength === 'strong_down').length,
  }
  const total = items.length || 1
  const bars = [
    { key: 'strong_up',   label: '强涨', color: 'bg-accent-green',    count: counts.strong_up   },
    { key: 'up',          label: '上涨', color: 'bg-accent-green/50', count: counts.up          },
    { key: 'flat',        label: '平盘', color: 'bg-terminal-muted',  count: counts.flat        },
    { key: 'down',        label: '下跌', color: 'bg-accent-red/50',   count: counts.down        },
    { key: 'strong_down', label: '强跌', color: 'bg-accent-red',      count: counts.strong_down },
  ]

  return (
    <div className="flex items-end gap-1.5 h-8">
      {bars.map(b => (
        <div key={b.key} className="flex flex-col items-center gap-0.5 flex-1">
          <span className="text-[9px] font-mono text-ink-muted">{b.count}</span>
          <div
            className={`w-full rounded-t ${b.color}`}
            style={{ height: `${Math.max(4, (b.count / total) * 24)}px` }}
          />
          <span className="text-[9px] font-mono text-ink-muted">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function SectorHeatmapPage() {
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchHeatmap(), []),
  )

  const items = data?.items ?? []
  const leaders  = items.filter(i => i.change_rate >= 1)
  const laggards = items.filter(i => i.change_rate <= -1)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="板块热力图"
        subtitle={data?.from_cache ? `缓存 · ${data.updated_at}` : `实时 · ${data?.updated_at ?? ''}`}
        onRefresh={refetch}
        loading={loading}
        actions={
          <button onClick={refetch} className="btn-ghost text-xs">
            <RefreshCw size={12} /> 刷新
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && <ErrorBanner message={error} />}

        {/* 分布条 + 汇总 */}
        {items.length > 0 && (
          <div className="card p-4 flex items-center gap-6">
            <div className="flex-1">
              <p className="text-[10px] font-mono text-ink-muted mb-2 uppercase tracking-wider">涨跌分布</p>
              <DistBar items={items} />
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-xl font-mono font-bold text-accent-green">{leaders.length}</p>
                <p className="text-[10px] font-mono text-ink-muted">上涨</p>
              </div>
              <div>
                <p className="text-xl font-mono font-bold text-ink-muted">
                  {items.filter(i => i.strength === 'flat').length}
                </p>
                <p className="text-[10px] font-mono text-ink-muted">平盘</p>
              </div>
              <div>
                <p className="text-xl font-mono font-bold text-accent-red">{laggards.length}</p>
                <p className="text-[10px] font-mono text-ink-muted">下跌</p>
              </div>
            </div>
          </div>
        )}

        {/* 全部板块热力图 */}
        {loading
          ? <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-terminal-muted animate-pulse min-h-[72px]" />
              ))}
            </div>
          : items.length === 0
            ? <EmptyState message="板块数据加载中，请稍后刷新" />
            : (
              <div>
                <p className="text-[10px] font-mono text-ink-muted mb-2 uppercase tracking-wider">
                  全部行业板块 · 按涨跌幅排列
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {items.map(item => (
                    <HeatBlock key={item.code} item={item} />
                  ))}
                </div>
              </div>
            )
        }

        {/* 领涨板块 */}
        {leaders.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
              <BarChart2 size={13} className="text-accent-green" />
              <span className="text-sm font-medium text-ink-primary">领涨板块</span>
              <span className="tag text-ink-muted">{leaders.length} 个</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {leaders.slice(0, 12).map(item => (
                <div key={item.code}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-green/10 border border-accent-green/25">
                  <span className="text-xs font-medium text-ink-primary">{item.name}</span>
                  <span className="text-xs font-mono font-bold text-accent-green">
                    +{item.change_rate.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 领跌板块 */}
        {laggards.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
              <BarChart2 size={13} className="text-accent-red" />
              <span className="text-sm font-medium text-ink-primary">领跌板块</span>
              <span className="tag text-ink-muted">{laggards.length} 个</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {laggards.slice(-12).map(item => (
                <div key={item.code}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-red/10 border border-accent-red/25">
                  <span className="text-xs font-medium text-ink-primary">{item.name}</span>
                  <span className="text-xs font-mono font-bold text-accent-red">
                    {item.change_rate.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
