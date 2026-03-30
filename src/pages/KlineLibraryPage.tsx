import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, RefreshCw, Trash2, RotateCcw,
  CheckCircle2, AlertCircle, Loader2, Clock,
  TrendingUp, ChevronRight, Search,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import {
  listSyncedStocks, startKlineSync, deleteKlineSync, getKlineSyncStatus,
} from '@/api/klineSync'
import type { KlineSyncStatus, KlineSyncState } from '@/api/klineSync'

// ── 状态徽标 ─────────────────────────────────────────────────────

function StateBadge({ state }: { state: KlineSyncState }) {
  switch (state) {
    case 'done':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-accent-green">
          <CheckCircle2 size={11} />完成
        </span>
      )
    case 'running':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-accent-blue">
          <Loader2 size={11} className="animate-spin" />同步中
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-accent-red">
          <AlertCircle size={11} />失败
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 text-[10px] font-mono text-ink-muted">
          <Clock size={11} />未同步
        </span>
      )
  }
}

// ── 单行股票卡片 ──────────────────────────────────────────────────

function StockRow({
  item,
  onSync,
  onDelete,
  onNavigate,
  syncing,
}: {
  item: KlineSyncStatus
  onSync: (code: string) => void
  onDelete: (code: string) => void
  onNavigate: (code: string) => void
  syncing: boolean
}) {
  const earliest = item.earliest_date
    ? new Date(item.earliest_date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
    : '—'
  const latest = item.latest_date
    ? new Date(item.latest_date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
    : '—'
  const lastSync = item.last_synced_at
    ? new Date(item.last_synced_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-terminal-border/50
      hover:bg-terminal-muted/20 transition-colors group
      ${item.sync_state === 'error' ? 'bg-accent-red/5' : ''}
    `}>
      {/* 股票信息 */}
      <button
        onClick={() => onNavigate(item.code)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 rounded-md bg-terminal-muted border border-terminal-border
          flex items-center justify-center text-[10px] font-mono text-ink-muted flex-shrink-0">
          {item.code.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-primary">{item.stock_name || item.code}</span>
            <span className="text-[10px] font-mono text-ink-muted">{item.code}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StateBadge state={item.sync_state} />
            {item.last_error && (
              <span className="text-[10px] font-mono text-accent-red truncate max-w-40" title={item.last_error}>
                {item.last_error}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={12} className="text-ink-muted/0 group-hover:text-ink-muted/60 transition-all flex-shrink-0" />
      </button>

      {/* 数据范围 */}
      <div className="hidden md:flex flex-col items-end w-44">
        {item.total_bars > 0 ? (
          <>
            <span className="text-xs font-mono text-ink-primary">{item.total_bars.toLocaleString()} 根</span>
            <span className="text-[10px] font-mono text-ink-muted">{earliest} ~ {latest}</span>
          </>
        ) : (
          <span className="text-[10px] font-mono text-ink-muted">暂无数据</span>
        )}
      </div>

      {/* 最后同步 */}
      <div className="hidden lg:block w-32 text-right">
        <span className="text-[10px] font-mono text-ink-muted">{lastSync}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onSync(item.code)}
          disabled={syncing || item.sync_state === 'running'}
          title={item.sync_state === 'done' ? '重新同步' : '开始同步'}
          className="p-1.5 rounded border border-terminal-border text-ink-muted
            hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/5
            disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {item.sync_state === 'running'
            ? <Loader2 size={13} className="animate-spin" />
            : item.sync_state === 'done'
            ? <RotateCcw size={13} />
            : <RefreshCw size={13} />
          }
        </button>
        <button
          onClick={() => onDelete(item.code)}
          disabled={item.sync_state === 'running'}
          title="删除本地数据"
          className="p-1.5 rounded border border-terminal-border text-ink-muted
            hover:text-accent-red hover:border-accent-red/40 hover:bg-accent-red/5
            disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── 手动添加同步输入框 ────────────────────────────────────────────

function AddSyncInput({ onSync }: { onSync: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    await onSync(trimmed)
    setCode('')
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-terminal-border bg-terminal-surface">
      <Search size={13} className="text-ink-muted flex-shrink-0" />
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="输入股票代码（如 600519），回车同步"
        className="flex-1 bg-transparent text-sm font-mono text-ink-primary placeholder:text-ink-muted/40
          outline-none focus:outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!code.trim() || loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono
          bg-accent-green/10 border border-accent-green/30 text-accent-green
          hover:bg-accent-green/20 disabled:opacity-40 disabled:cursor-not-allowed
          transition-all"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
        同步历史 K 线
      </button>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────

export default function KlineLibraryPage() {
  const navigate = useNavigate()
  const [syncingCodes, setSyncingCodes] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  // 轮询 running 状态用
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data, loading, refetch } = useQuery(
    useCallback(() => listSyncedStocks(), []),
  )

  const items = data?.items ?? []
  const hasRunning = items.some(i => i.sync_state === 'running')

  // 有 running 状态时每 3 秒轮询一次
  useEffect(() => {
    if (hasRunning) {
      pollRef.current = setInterval(refetch, 3_000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasRunning, refetch])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 触发同步，并在 syncing 时本地轮询该股的状态
  const handleSync = async (code: string) => {
    setSyncingCodes(prev => new Set(prev).add(code))
    try {
      await startKlineSync(code)
      showToast(`${code} 开始同步，请稍候…`, 'ok')
      // 同步启动后刷新列表，会出现 running 状态触发自动轮询
      setTimeout(refetch, 800)
    } catch (e) {
      showToast(`${code} 触发失败`, 'err')
    } finally {
      setSyncingCodes(prev => { const s = new Set(prev); s.delete(code); return s })
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`确认删除 ${code} 的本地 K 线数据？此操作不可恢复。`)) return
    try {
      await deleteKlineSync(code)
      showToast(`${code} 数据已删除`, 'ok')
      refetch()
    } catch (e) {
      showToast(`删除失败`, 'err')
    }
  }

  // 汇总统计
  const totalBars  = items.reduce((s, i) => s + i.total_bars, 0)
  const doneCount  = items.filter(i => i.sync_state === 'done').length
  const errorCount = items.filter(i => i.sync_state === 'error').length

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg border text-sm font-mono
          shadow-lg animate-fade-in transition-all
          ${toast.type === 'ok'
            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}>
          {toast.msg}
        </div>
      )}

      <Topbar
        title="K 线数据库"
        subtitle={`${items.length} 只股票 · ${totalBars.toLocaleString()} 根历史数据`}
        onRefresh={refetch}
        loading={loading}
      />

      {/* 统计概览 */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-0 border-b border-terminal-border bg-terminal-surface">
        {[
          { label: '已同步股票', value: items.length, icon: Database, color: 'text-accent-blue' },
          { label: '同步完成',   value: doneCount,    icon: CheckCircle2, color: 'text-accent-green' },
          { label: '同步失败',   value: errorCount,   icon: AlertCircle,  color: errorCount > 0 ? 'text-accent-red' : 'text-ink-muted' },
          { label: '历史总根数', value: totalBars.toLocaleString(), icon: TrendingUp, color: 'text-accent-cyan' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col items-center py-4 border-r border-terminal-border last:border-r-0">
            <Icon size={14} className={`${color} mb-1.5`} />
            <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
            <span className="text-[10px] font-mono text-ink-muted mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* 输入框：手动添加股票同步 */}
      <AddSyncInput onSync={handleSync} />

      {/* 表头 */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-terminal-surface border-b border-terminal-border">
        <div className="flex-1 text-[10px] font-mono text-ink-muted uppercase tracking-wider">股票</div>
        <div className="hidden md:block w-44 text-right text-[10px] font-mono text-ink-muted uppercase tracking-wider">数据范围</div>
        <div className="hidden lg:block w-32 text-right text-[10px] font-mono text-ink-muted uppercase tracking-wider">最后同步</div>
        <div className="w-20 text-right text-[10px] font-mono text-ink-muted uppercase tracking-wider">操作</div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-muted">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm font-mono">加载中…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-ink-muted">
            <Database size={40} strokeWidth={1} className="opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium mb-1">本地 K 线库为空</p>
              <p className="text-xs font-mono text-ink-muted/60">在上方输入股票代码，触发全量历史 K 线同步</p>
            </div>
          </div>
        ) : (
          items.map(item => (
            <StockRow
              key={item.code}
              item={item}
              onSync={handleSync}
              onDelete={handleDelete}
              onNavigate={code => navigate(`/stocks/${code}`)}
              syncing={syncingCodes.has(item.code)}
            />
          ))
        )}
      </div>
    </div>
  )
}
