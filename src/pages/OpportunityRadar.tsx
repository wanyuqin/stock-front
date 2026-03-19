import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Radar, RefreshCw, Zap, TrendingUp, TrendingDown,
  ArrowUpDown, CheckCircle2, Clock, BarChart2,
  Banknote, Activity, ChevronUp, ChevronDown, Moon,
  BookmarkPlus, Layers,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import StockAnalysisModal from '@/components/StockAnalysisModal'
import TemplatePanel from '@/components/TemplatePanel'
import { useQuery } from '@/hooks/useQuery'
import {
  executeScreener, syncMarketData, fetchScreenerStatus,
} from '@/api/stock'
import { getPriceColor, formatRate } from '@/components/shared'
import type { ScoredStock, ScreenerResult } from '@/types'

// ── 工具函数 ──────────────────────────────────────────────────────
function formatYuan(v: number) {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  return `${sign}${(abs / 1e4).toFixed(0)}万`
}

function formatPrice(p: number) { return p.toFixed(2) }

// ── 评分圆环 ──────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r    = 22
  const circ = 2 * Math.PI * r
  const fill = Math.min(score / 100, 1) * circ
  const color =
    score >= 90 ? '#ef4444' :
    score >= 70 ? '#f59e0b' :
    score >= 50 ? '#06b6d4' : '#6b7280'

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#2d2d3a" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-mono font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

// ── 机会卡片 ──────────────────────────────────────────────────────
interface OpportunityCardProps {
  stock: ScoredStock
  rank: number
  onClick: () => void
}

function OpportunityCard({ stock, rank, onClick }: OpportunityCardProps) {
  const priceColor = getPriceColor(stock.pct_chg)
  const TrendIcon  = stock.pct_chg >= 0 ? TrendingUp : TrendingDown

  const tagStyle = (tag: string) => {
    if (tag.includes('资金') || tag.includes('主力')) return 'bg-accent-green/10 border-accent-green/25 text-accent-green'
    if (tag.includes('多头') || tag.includes('突破')) return 'bg-accent-cyan/10 border-accent-cyan/25 text-accent-cyan'
    if (tag.includes('量能') || tag.includes('活跃')) return 'bg-accent-amber/10 border-accent-amber/25 text-accent-amber'
    if (tag.includes('跌破') || tag.includes('弱势')) return 'bg-accent-red/10 border-accent-red/25 text-accent-red'
    return 'bg-terminal-muted border-terminal-border text-ink-secondary'
  }

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-terminal-panel border border-terminal-border rounded-xl p-4 cursor-pointer
        hover:border-accent-cyan/40 hover:bg-terminal-surface transition-all duration-200 hover:shadow-lg hover:shadow-black/20"
    >
      <div className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded bg-terminal-muted">
        <span className="text-[10px] font-mono text-ink-muted">#{rank}</span>
      </div>

      <div className="flex items-start gap-3 mb-3">
        <ScoreRing score={stock.score} />
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-ink-primary truncate">{stock.name}</p>
          <p className="text-[11px] font-mono text-ink-muted">{stock.code}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-base font-mono font-bold ${priceColor}`}>{formatPrice(stock.price)}</span>
            <span className={`flex items-center gap-0.5 text-xs font-mono ${priceColor}`}>
              <TrendIcon size={11} />{formatRate(stock.pct_chg)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
        {(stock.tags ?? []).map(tag => (
          <span key={tag} className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${tagStyle(tag)}`}>{tag}</span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 mb-3 text-center">
        {[
          { label: '主力占比', value: `${stock.main_inflow_pct.toFixed(1)}%`, color: stock.main_inflow_pct > 0 ? 'text-accent-green' : 'text-accent-red' },
          { label: '主力净入', value: formatYuan(stock.main_inflow),           color: stock.main_inflow > 0   ? 'text-accent-green' : 'text-accent-red' },
          { label: '量比',     value: stock.vol_ratio.toFixed(2),              color: stock.vol_ratio > 1.5   ? 'text-accent-amber' : 'text-ink-secondary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-terminal-muted/60 rounded-lg py-1.5 px-1">
            <p className={`text-xs font-mono font-semibold ${color}`}>{value}</p>
            <p className="text-[9px] text-ink-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-mono
        bg-accent-cyan/5 border border-accent-cyan/20 text-accent-cyan/70
        group-hover:bg-accent-cyan/15 group-hover:border-accent-cyan/40 group-hover:text-accent-cyan transition-all duration-200">
        <Zap size={11} /> 查看 AI 研报
      </button>
    </div>
  )
}

// ── ScanProgress ──────────────────────────────────────────────────
interface ScanProgressProps { onComplete: () => void }

function ScanProgress({ onComplete }: ScanProgressProps) {
  const [synced, setSynced] = useState(0)
  const [total,  setTotal]  = useState(5000)
  const [phase,  setPhase]  = useState<'sync' | 'score' | 'done'>('sync')
  const [elapsed, setElapsed] = useState(0)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef     = useRef(Date.now())
  const completedRef = useRef(false)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>
    const poll = async () => {
      try {
        const res = await fetchScreenerStatus()
        const status = res.data.data
        if (status.total > 0) {
          setSynced(status.total)
          setTotal(t => Math.max(t, status.total))
        }
        if (status.ready && status.total > 100 && phase === 'sync') {
          setPhase('score')
          clearInterval(pollTimer)
          setTimeout(() => {
            if (!completedRef.current) {
              completedRef.current = true
              setPhase('done')
              if (timerRef.current) clearInterval(timerRef.current)
              setTimeout(onComplete, 800)
            }
          }, 800)
        }
      } catch { /* 静默 */ }
    }
    poll()
    pollTimer = setInterval(poll, 1500)
    return () => clearInterval(pollTimer)
  }, [phase, onComplete])

  const progress =
    phase === 'done'  ? 100 :
    phase === 'score' ? 95  :
    Math.min((synced / total) * 90, 90)

  return (
    <div className="bg-terminal-panel border border-terminal-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar size={16} className={`text-accent-cyan ${phase !== 'done' ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium text-ink-primary">全市场雷达扫描</span>
        </div>
        <span className="text-xs font-mono text-ink-muted">{elapsed}s</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 bg-terminal-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${phase === 'done' ? 'bg-accent-green' : 'bg-accent-cyan'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-ink-muted">
            {phase === 'sync' ? `正在同步全市场数据… ${synced} / ${total}` :
             phase === 'score' ? '正在并行打分中…' : '扫描完成！'}
          </span>
          <span className="text-xs font-mono text-ink-muted">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  )
}

// ── 排序控制 ──────────────────────────────────────────────────────
type SortKey = 'score' | 'main_inflow' | 'pct_chg'
type SortDir = 'desc' | 'asc'

function SortButton({ label, sortKey, icon: Icon, current, dir, onChange }: {
  label: string; sortKey: SortKey; icon: React.ElementType
  current: SortKey; dir: SortDir; onChange: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button onClick={() => onChange(sortKey)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
        active ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' :
        'border-terminal-border text-ink-muted hover:text-ink-secondary hover:border-terminal-border/80'
      }`}
    >
      <Icon size={11} />
      {label}
      {active && (dir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
    </button>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
export default function OpportunityRadar() {
  const [minScore,       setMinScore]       = useState(40)
  const [sortKey,        setSortKey]        = useState<SortKey>('score')
  const [sortDir,        setSortDir]        = useState<SortDir>('desc')
  const [scanning,       setScanning]       = useState(false)
  const [syncError,      setSyncError]      = useState('')
  const [nonTrading,     setNonTrading]     = useState(false)
  const [nonTradingNote, setNonTradingNote] = useState('')
  const [selectedStock,  setSelectedStock]  = useState<ScoredStock | null>(null)
  const [refetchKey,     setRefetchKey]     = useState(0)
  const [showTemplates,  setShowTemplates]  = useState(false)

  const { data: result, loading, error, refetch } = useQuery(
    useCallback(() => executeScreener({ min_score: minScore, limit: 100 }), // eslint-disable-line react-hooks/exhaustive-deps
    [minScore, refetchKey]),
  )

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedItems: ScoredStock[] = [...(result?.items ?? [])].sort((a, b) => {
    let diff = 0
    if (sortKey === 'score')       diff = a.score       - b.score
    if (sortKey === 'main_inflow') diff = a.main_inflow - b.main_inflow
    if (sortKey === 'pct_chg')     diff = a.pct_chg     - b.pct_chg
    return sortDir === 'desc' ? -diff : diff
  })

  const handleStartScan = async () => {
    setSyncError('')
    setNonTrading(false)
    setNonTradingNote('')
    setScanning(true)
    try {
      const res = await syncMarketData()
      const payload = res.data.data
      if (payload.non_trading) {
        setNonTrading(true)
        setNonTradingNote(payload.notice || '当前为非交易时段，行情数据暂不可用')
        setScanning(false)
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '同步请求失败，请检查网络后重试')
      setScanning(false)
    }
  }

  const handleScanComplete = useCallback(() => {
    setScanning(false)
    setRefetchKey(k => k + 1)
  }, [])

  const stats = result ? {
    total:   result.total,
    matched: result.matched,
    high:    result.items.filter(s => s.score >= 70).length,
    elapsed: result.elapsed_ms,
  } : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="机会雷达" subtitle="全市场多因子量化筛选" onRefresh={refetch} loading={loading} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
        {scanning && <ScanProgress onComplete={handleScanComplete} />}

        {/* 概览卡片行 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={handleStartScan} disabled={scanning}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-accent-cyan/30 bg-accent-cyan/5 hover:bg-accent-cyan/10 hover:border-accent-cyan/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group col-span-2 lg:col-span-1">
            {scanning ? <RefreshCw size={22} className="text-accent-cyan animate-spin" /> :
              <Radar size={22} className="text-accent-cyan group-hover:scale-110 transition-transform" />}
            <span className="text-xs font-mono text-accent-cyan">{scanning ? '扫描中…' : '开始全市场雷达扫描'}</span>
          </button>

          {[
            { label: '全市场快照', value: stats ? stats.total.toLocaleString() : '—', sub: stats ? '今日已同步' : '点击扫描以加载', icon: BarChart2, color: 'text-accent-cyan' },
            { label: '高分机会',   value: stats ? `${stats.high} 只` : '—', sub: stats ? `≥70分 / 共 ${stats.matched} 只达标` : '—', icon: Zap, color: 'text-accent-amber' },
            { label: '打分耗时',   value: stats ? `${stats.elapsed}ms` : '—', sub: '服务端并行打分', icon: Clock, color: 'text-accent-green' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 p-4 bg-terminal-panel border border-terminal-border rounded-xl">
              <Icon size={20} className={`${color} flex-shrink-0`} strokeWidth={1.5} />
              <div>
                <p className="text-lg font-mono font-bold text-ink-primary">{value}</p>
                <p className="text-[10px] text-ink-muted">{label}</p>
                <p className="text-[10px] text-ink-muted/60">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {nonTrading && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent-amber/5 border border-accent-amber/25">
            <Moon size={15} className="text-accent-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-accent-amber mb-0.5">非交易时段</p>
              <p className="text-xs font-mono text-ink-muted">{nonTradingNote}</p>
            </div>
          </div>
        )}

        {syncError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-xs font-mono">
            <span>⚠</span><span>{syncError}</span>
            <button onClick={() => setSyncError('')} className="ml-auto text-accent-red/60 hover:text-accent-red">✕</button>
          </div>
        )}

        {/* 控制栏 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink-muted">最低分</span>
            {[0, 20, 40, 60, 70].map(v => (
              <button key={v} onClick={() => setMinScore(v)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                  minScore === v ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan' :
                  'border-terminal-border text-ink-muted hover:text-ink-secondary'
                }`}>
                {v === 0 ? '全部' : `${v}+`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* 筛选模板按钮 */}
            <button
              onClick={() => setShowTemplates(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                showTemplates
                  ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber'
                  : 'border-terminal-border text-ink-muted hover:text-ink-secondary'
              }`}
            >
              <Layers size={11} /> 筛选模板
            </button>

            <ArrowUpDown size={12} className="text-ink-muted" />
            <SortButton label="评分"     sortKey="score"       icon={BarChart2} current={sortKey} dir={sortDir} onChange={handleSort} />
            <SortButton label="主力净入" sortKey="main_inflow" icon={Banknote}  current={sortKey} dir={sortDir} onChange={handleSort} />
            <SortButton label="涨跌幅"   sortKey="pct_chg"     icon={Activity}  current={sortKey} dir={sortDir} onChange={handleSort} />
          </div>
        </div>

        {/* 模板管理面板（折叠） */}
        {showTemplates && (
          <div className="card p-4">
            <TemplatePanel />
          </div>
        )}

        {/* 保存当前条件为模板 */}
        {!showTemplates && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1 text-[11px] font-mono text-ink-muted hover:text-accent-amber transition-colors">
              <BookmarkPlus size={11} /> 将当前条件保存为模板
            </button>
          </div>
        )}

        {result && (
          <p className="text-xs font-mono text-ink-muted">
            全市场扫描完成，共发现{' '}
            <span className="text-accent-amber font-semibold">{stats?.high ?? 0}</span>{' '}
            只高分机会股（≥70分），当前显示{' '}
            <span className="text-ink-secondary">{sortedItems.length}</span>{' '}
            只（最低 {minScore} 分）
            {result.elapsed_ms > 0 && <span className="ml-2 text-ink-muted/50">· 打分耗时 {result.elapsed_ms}ms</span>}
          </p>
        )}

        {loading && !result && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 bg-terminal-panel border border-terminal-border rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !error && sortedItems.length === 0 && result && (
          <div className="flex flex-col items-center justify-center py-20 text-ink-muted gap-3">
            <Radar size={36} strokeWidth={1} className="opacity-30" />
            <p className="text-sm font-mono">未发现符合条件的机会股</p>
            <p className="text-xs text-ink-muted/60">
              {result.total === 0 ? '今日快照为空，请先点击扫描' : `当前最低分 ${minScore}，无符合条件`}
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-accent-red text-sm font-mono">⚠ {error}</p>
            <button onClick={refetch} className="text-xs font-mono text-accent-cyan hover:underline">重试</button>
          </div>
        )}

        {sortedItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedItems.map((stock, idx) => (
              <OpportunityCard key={stock.code} stock={stock} rank={idx + 1} onClick={() => setSelectedStock(stock)} />
            ))}
          </div>
        )}
      </div>

      {selectedStock && (
        <StockAnalysisModal stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}
