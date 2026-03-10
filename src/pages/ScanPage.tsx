import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScanLine, PlayCircle, RefreshCw, TrendingUp,
  BarChart2, Clock, Zap, CheckCircle2, AlertCircle,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { formatAmount, EmptyState, ErrorBanner } from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

// ══════════════════════════════════════════════════════════════
// 类型定义（对齐 service.ScanResult / model.DailyScan）
// ══════════════════════════════════════════════════════════════

interface ScanItem {
  stock_code:   string
  stock_name:   string
  signals:      string[]
  price:        number
  pct_chg:      number
  volume_ratio: number
  ma_status:    string
}

interface ScanResult {
  scan_date:   string
  total:       number
  hit_count:   number
  skipped:     number
  errors:      number
  items:       ScanItem[]
  duration_ms: number
}

interface DailyScan {
  id:           number
  scan_date:    string
  stock_code:   string
  stock_name:   string
  signals:      string[]
  price:        number
  pct_chg:      number
  volume_ratio: number
  ma_status:    string
  created_at:   string
}

// ── API 函数 ──────────────────────────────────────────────────
const runScan = () =>
  http.post<ApiResponse<ScanResult>>('/admin/scan/run', {})

const fetchTodayScans = () =>
  http.get<ApiResponse<{ date: string; count: number; items: DailyScan[] }>>('/admin/scan/today')

const fetchHistoryScans = (date: string) =>
  http.get<ApiResponse<{ date: string; count: number; items: DailyScan[] }>>(
    `/admin/scan/history?date=${date}`
  )

// ══════════════════════════════════════════════════════════════
// 信号徽章
// ══════════════════════════════════════════════════════════════
const SIGNAL_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  VOLUME_UP:  { label: '量能放大', color: 'bg-accent-amber/10 border-accent-amber/40 text-accent-amber',  icon: BarChart2  },
  MA20_BREAK: { label: '突破MA20', color: 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue',    icon: TrendingUp },
  BIG_RISE:   { label: '大涨信号', color: 'bg-accent-green/10 border-accent-green/40 text-accent-green', icon: Zap        },
}

function SignalBadge({ signal }: { signal: string }) {
  const meta = SIGNAL_META[signal] ?? {
    label: signal, color: 'bg-terminal-muted border-terminal-border text-ink-muted', icon: Zap,
  }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${meta.color}`}>
      <Icon size={9} />
      {meta.label}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════
// 扫描结果表格（统一渲染 ScanItem 和 DailyScan）
// ══════════════════════════════════════════════════════════════
interface ScanTableProps {
  items: (ScanItem | DailyScan)[]
  loading?: boolean
}

function ScanTable({ items, loading }: ScanTableProps) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="divide-y divide-terminal-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
            <div className="h-3 w-16 bg-terminal-muted rounded" />
            <div className="h-3 w-24 bg-terminal-muted rounded" />
            <div className="h-4 w-20 bg-terminal-muted rounded" />
            <div className="h-3 w-12 bg-terminal-muted rounded ml-auto" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <EmptyState message="暂无扫描命中记录" />
  }

  const pnlColor = (v: number) =>
    v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="border-b border-terminal-border">
            {['代码', '名称', '触发信号', '收盘价', '涨跌幅', '量比', '均线状态'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={`${'id' in item ? item.id : i}`}
              className="data-row group cursor-pointer"
              onClick={() => navigate(`/stocks/${item.stock_code}`)}
            >
              <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{item.stock_code}</td>
              <td className="px-4 py-3 text-ink-primary font-medium">{item.stock_name || '—'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {item.signals.map(s => <SignalBadge key={s} signal={s} />)}
                </div>
              </td>
              <td className="px-4 py-3 font-mono font-semibold">{item.price.toFixed(2)}</td>
              <td className={`px-4 py-3 font-mono text-sm ${pnlColor(item.pct_chg)}`}>
                {item.pct_chg > 0 ? '+' : ''}{item.pct_chg.toFixed(2)}%
              </td>
              <td className={`px-4 py-3 font-mono text-sm ${item.volume_ratio > 2 ? 'text-accent-amber font-semibold' : 'text-ink-secondary'}`}>
                {item.volume_ratio.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  item.ma_status === 'ABOVE_MA20'
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}>
                  {item.ma_status === 'ABOVE_MA20' ? '站上 MA20' : '跌破 MA20'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 触发扫描面板
// ══════════════════════════════════════════════════════════════
function RunScanPanel({ onDone }: { onDone: () => void }) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult]     = useState<ScanResult | null>(null)
  const [err, setErr]           = useState('')

  const handleRun = async () => {
    setScanning(true)
    setErr('')
    setResult(null)
    try {
      const resp = await runScan()
      setResult(resp.data)
      onDone() // 通知父组件刷新今日结果
    } catch (e) {
      setErr(e instanceof Error ? e.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <PlayCircle size={14} className="text-accent-cyan" />
          <span className="text-sm font-medium">触发扫描</span>
        </div>
        <button
          onClick={handleRun}
          disabled={scanning}
          className="btn-primary disabled:opacity-50"
        >
          {scanning
            ? <><RefreshCw size={13} className="animate-spin" />扫描中…</>
            : <><ScanLine size={13} />立即扫描</>
          }
        </button>
      </div>

      <div className="px-5 py-4">
        {/* 说明 */}
        {!result && !err && (
          <div className="text-xs font-mono text-ink-muted space-y-1.5">
            <p className="text-ink-secondary font-medium mb-2">扫描将对自选股执行以下信号检测：</p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { signal: 'VOLUME_UP',  desc: '今日量 / 5日均量 > 2.0，量能显著放大' },
                { signal: 'MA20_BREAK', desc: '收盘价上穿 MA20（昨跌今涨站上均线）' },
                { signal: 'BIG_RISE',   desc: '今日涨跌幅 > 5%，大幅上涨' },
              ].map(({ signal, desc }) => (
                <div key={signal} className="flex items-start gap-2">
                  <SignalBadge signal={signal} />
                  <span className="text-ink-muted mt-0.5">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 错误 */}
        {err && <ErrorBanner message={err} />}

        {/* 结果摘要 */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* 统计卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '扫描股票',  value: result.total,       icon: ScanLine,      color: 'text-ink-primary' },
                { label: '命中信号',  value: result.hit_count,   icon: CheckCircle2,  color: 'text-accent-green' },
                { label: '数据不足',  value: result.skipped,     icon: Clock,         color: 'text-ink-muted' },
                { label: '获取失败',  value: result.errors,      icon: AlertCircle,   color: result.errors > 0 ? 'text-accent-red' : 'text-ink-muted' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-terminal-muted rounded-lg p-3 border border-terminal-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} className={color} />
                    <span className="text-[10px] font-mono text-ink-muted uppercase">{label}</span>
                  </div>
                  <span className={`text-2xl font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* 耗时 */}
            <p className="text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
              <Clock size={10} />
              扫描完成 · 耗时 {result.duration_ms}ms · {result.scan_date}
            </p>

            {/* 命中明细 */}
            {result.items.length > 0 && (
              <div>
                <p className="text-xs font-mono text-ink-secondary mb-2 flex items-center gap-1.5">
                  <Zap size={11} className="text-accent-amber" />
                  命中 {result.items.length} 只，点击跳转 K 线详情：
                </p>
                <ScanTable items={result.items} />
              </div>
            )}
            {result.items.length === 0 && (
              <EmptyState message="本次扫描无股票触发信号" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 今日扫描历史（从 DB 读已持久化的记录）
// ══════════════════════════════════════════════════════════════
function TodayScanPanel({ refreshKey }: { refreshKey: number }) {
  const [histDate, setHistDate] = useState('')
  const [queryDate, setQueryDate] = useState('')

  const { data: todayData, loading: todayLoading, error: todayErr, refetch } = useQuery(
    useCallback(() => fetchTodayScans(), [refreshKey]),
  )

  const { data: histData, loading: histLoading, error: histErr } = useQuery(
    useCallback(
      () => (queryDate ? fetchHistoryScans(queryDate) : Promise.resolve(null as any)),
      [queryDate],
    ),
    { enabled: !!queryDate },
  )

  const displayData   = queryDate ? histData   : todayData
  const displayLoading = queryDate ? histLoading : todayLoading
  const displayErr    = queryDate ? histErr    : todayErr
  const items         = displayData?.items ?? []

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-accent-amber" />
          <span className="text-sm font-medium">扫描记录</span>
          {displayData && (
            <span className="tag">{displayData.date} · {displayData.count} 条</span>
          )}
        </div>

        {/* 历史日期查询 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={histDate}
            onChange={e => setHistDate(e.target.value)}
            className="bg-terminal-muted border border-terminal-border rounded-md px-2 py-1 text-xs font-mono text-ink-primary focus:outline-none focus:border-accent-blue transition-colors"
          />
          <button
            onClick={() => setQueryDate(histDate)}
            disabled={!histDate}
            className="btn-ghost text-xs disabled:opacity-40"
          >查历史</button>
          {queryDate && (
            <button onClick={() => { setQueryDate(''); setHistDate('') }} className="btn-ghost text-xs text-ink-muted">
              回今日
            </button>
          )}
          <button onClick={refetch} className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-accent-cyan transition-colors">
            <RefreshCw size={12} className={todayLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {displayErr && <div className="p-4"><ErrorBanner message={displayErr} /></div>}

      <ScanTable items={items} loading={displayLoading} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 主页面
// ══════════════════════════════════════════════════════════════
export default function ScanPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="信号扫描"
        subtitle="量能 · 均线突破 · 大涨检测"
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* 触发扫描 */}
        <RunScanPanel onDone={() => setRefreshKey(k => k + 1)} />

        {/* 今日 / 历史记录 */}
        <TodayScanPanel refreshKey={refreshKey} />
      </div>
    </div>
  )
}
