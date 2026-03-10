import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, StarOff, Plus, X, RefreshCw, ExternalLink } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '@/api/stock'
import {
  getPriceColor, formatRate, formatPrice,
  formatAmount, formatVolume, EmptyState, SkeletonRow, ErrorBanner,
} from '@/components/shared'

// ── 添加自选股弹框 ────────────────────────────────────────────────
interface AddDialogProps {
  onAdd: (code: string, note: string) => Promise<void>
  onClose: () => void
}

function AddDialog({ onAdd, onClose }: AddDialogProps) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    const trimmed = code.trim()
    if (!trimmed) { setErr('请输入股票代码'); return }
    if (!/^\d{6}$/.test(trimmed)) { setErr('代码格式错误，应为 6 位数字'); return }
    setLoading(true); setErr('')
    try {
      await onAdd(trimmed, note.trim())
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '添加失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-96 shadow-panel animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-accent-amber" />
            <span className="font-medium text-sm">添加自选股</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-mono text-ink-muted mb-1.5 uppercase tracking-wider">股票代码 *</label>
            <input
              autoFocus type="text" maxLength={6} placeholder="如 600519"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-terminal-muted border border-terminal-border rounded-md px-3 py-2.5 text-sm font-mono text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-ink-muted mb-1.5 uppercase tracking-wider">备注</label>
            <input
              type="text" maxLength={30} placeholder="可选，如：白酒龙头"
              value={note} onChange={e => setNote(e.target.value)}
              className="w-full bg-terminal-muted border border-terminal-border rounded-md px-3 py-2.5 text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-colors"
            />
          </div>
          {err && <ErrorBanner message={err} />}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            {loading ? '查询中…' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function Watchlist() {
  const navigate    = useNavigate()
  const [showAdd, setShowAdd] = useState(false)

  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchWatchlist(), []),
    { refetchInterval: 15_000 },
  )

  const items = data?.items ?? []

  const handleAdd = async (code: string, note: string) => {
    await addToWatchlist(code, note)
    refetch()
  }

  const handleRemove = async (code: string) => {
    if (!confirm(`确定从自选股中移除 ${code}？`)) return
    try {
      await removeFromWatchlist(code)
      refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : '移除失败')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="自选股"
        subtitle={`共 ${items.length} 只 · 每 15s 自动刷新`}
        onRefresh={refetch}
        loading={loading}
      />

      <div className="flex-1 overflow-hidden flex flex-col p-5">
        {/* 操作栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {error && <ErrorBanner message={error} />}
            {!error && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                <span className="text-xs font-mono text-ink-muted">实时行情 · 点击行查看详情</span>
              </div>
            )}
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={13} />
            添加自选股
          </button>
        </div>

        {/* 表格 */}
        <div className="card overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-terminal-surface z-10">
                <tr className="border-b border-terminal-border">
                  {['代码', '名称', '最新价', '涨跌幅', '涨跌额', '成交量', '成交额', '换手率', '量比', '操作'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                  : items.length === 0
                    ? <tr><td colSpan={10}><EmptyState message="自选股为空，点击右上角「添加自选股」开始" /></td></tr>
                    : items.map(item => {
                        const q     = item.quote
                        const rate  = q?.change_rate ?? 0
                        const color = getPriceColor(rate)
                        return (
                          <tr
                            key={item.id}
                            className="data-row group cursor-pointer"
                            onClick={() => navigate(`/stocks/${item.stock_code}`)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                              {item.stock_code}
                              <ExternalLink size={9} className="ml-1 inline-block opacity-0 group-hover:opacity-60 transition-opacity" />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-ink-primary">{q?.name ?? item.stock_code}</span>
                              {item.note && (
                                <span className="ml-2 text-[10px] text-ink-muted bg-terminal-muted px-1.5 py-0.5 rounded">
                                  {item.note}
                                </span>
                              )}
                            </td>
                            <td className={`px-4 py-3 font-mono font-semibold text-base ${color}`}>
                              {q ? formatPrice(q.price) : '—'}
                            </td>
                            <td className={`px-4 py-3 font-mono text-sm ${color}`}>
                              {q ? formatRate(rate) : '—'}
                            </td>
                            <td className={`px-4 py-3 font-mono text-sm ${color}`}>
                              {q ? (rate >= 0 ? '+' : '') + q.change.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-ink-secondary">
                              {q ? formatVolume(q.volume) : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-ink-secondary">
                              {q ? formatAmount(q.amount) : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-ink-secondary">
                              {q ? q.turnover.toFixed(2) + '%' : '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-ink-secondary">
                              {q ? q.volume_ratio.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleRemove(item.stock_code)}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-ink-muted hover:text-accent-red transition-all duration-150"
                              >
                                <StarOff size={12} />
                                移除
                              </button>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && <AddDialog onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
