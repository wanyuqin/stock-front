import { useState, useCallback, useRef, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, Award, RefreshCw, AlertCircle } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { ErrorBanner } from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

// ── 类型 ──────────────────────────────────────────────────────────
interface EquityPoint {
  date:           string
  equity:         number
  realized_pnl:   number
  unrealized_pnl: number
  daily_return:   number
  drawdown:       number
}

interface EquityMetrics {
  total_return:   number
  annual_return:  number
  max_drawdown:   number
  sharpe_ratio:   number
  win_days:       number
  lose_days:      number
  trading_days:   number
  current_equity: number
  peak_equity:    number
  initial_equity: number
}

interface EquityCurveDTO {
  points:  EquityPoint[]
  metrics: EquityMetrics
}

// ── API ───────────────────────────────────────────────────────────
const fetchEquityCurve = (days: number) =>
  http.get<ApiResponse<EquityCurveDTO>>('/stats/equity-curve', { params: { days } })

const takeSnapshot = () =>
  http.post<ApiResponse<{ message: string }>>('/stats/equity-snapshot', {})

// ── 工具 ──────────────────────────────────────────────────────────
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const pctColor = (v: number) => v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const yuan = (v: number) => {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(1)}万`
  return `${sign}${abs.toFixed(0)}`
}

// ── 内嵌 Canvas 折线图 ────────────────────────────────────────────
function EquityChart({ points }: { points: EquityPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width  = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const pad = { t: 16, r: 16, b: 28, l: 56 }
    const chartW = W - pad.l - pad.r
    const chartH = H - pad.t - pad.b

    const equities  = points.map(p => p.equity)
    const drawdowns = points.map(p => p.drawdown)
    const minEq = Math.min(...equities)
    const maxEq = Math.max(...equities)
    const rangeEq = maxEq - minEq || 1

    // 坐标映射
    const xOf = (i: number) => pad.l + (i / (points.length - 1)) * chartW
    const yOfEq = (v: number) => pad.t + (1 - (v - minEq) / rangeEq) * chartH

    // 回撤背景（浅红）
    const maxDD = Math.max(...drawdowns)
    if (maxDD > 0) {
      ctx.fillStyle = 'rgba(239,68,68,0.06)'
      ctx.beginPath()
      points.forEach((p, i) => {
        const x = xOf(i)
        const y = pad.t + (p.drawdown / maxDD) * chartH
        i === 0 ? ctx.moveTo(x, pad.t) : ctx.lineTo(x, y)
      })
      ctx.lineTo(xOf(points.length - 1), pad.t)
      ctx.closePath()
      ctx.fill()
    }

    // 净值曲线渐变填充
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH)
    grad.addColorStop(0,   'rgba(0,217,126,0.20)')
    grad.addColorStop(1,   'rgba(0,217,126,0.00)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOfEq(equities[0]))
    equities.forEach((v, i) => ctx.lineTo(xOf(i), yOfEq(v)))
    ctx.lineTo(xOf(points.length - 1), pad.t + chartH)
    ctx.lineTo(xOf(0), pad.t + chartH)
    ctx.closePath()
    ctx.fill()

    // 净值折线
    ctx.strokeStyle = '#00d97e'
    ctx.lineWidth   = 1.5
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    equities.forEach((v, i) => {
      i === 0 ? ctx.moveTo(xOf(i), yOfEq(v)) : ctx.lineTo(xOf(i), yOfEq(v))
    })
    ctx.stroke()

    // 零基准线
    const zeroY = yOfEq(0)
    if (zeroY > pad.t && zeroY < pad.t + chartH) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(pad.l, zeroY)
      ctx.lineTo(W - pad.r, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // X 轴刻度（最多 6 个）
    ctx.fillStyle   = 'rgba(255,255,255,0.35)'
    ctx.font        = '10px monospace'
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'top'
    const step = Math.max(1, Math.floor(points.length / 6))
    for (let i = 0; i < points.length; i += step) {
      const label = points[i].date.slice(5) // MM-DD
      ctx.fillText(label, xOf(i), pad.t + chartH + 6)
    }

    // Y 轴最高/最低标注
    ctx.textAlign   = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle   = 'rgba(255,255,255,0.45)'
    ctx.fillText(yuan(maxEq), pad.l - 4, yOfEq(maxEq))
    ctx.fillText(yuan(minEq), pad.l - 4, yOfEq(minEq))

  }, [points])

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-muted text-sm">
        <AlertCircle size={14} className="mr-2" /> 暂无历史数据，每日 16:35 自动快照后将生成曲线
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '200px', display: 'block' }}
    />
  )
}

// ── 指标卡 ────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = '' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold ${color || 'text-ink-primary'}`}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-ink-muted mt-0.5">{sub}</p>}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────
const DAY_OPTIONS = [30, 90, 180, 365] as const

export default function EquityCurvePage() {
  const [days, setDays]           = useState<number>(365)
  const [snapshotMsg, setSnapshotMsg] = useState('')
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchEquityCurve(days), [days]),
  )

  const handleSnapshot = async () => {
    setSnapshotLoading(true)
    setSnapshotMsg('')
    try {
      const res = await takeSnapshot()
      setSnapshotMsg(res.data.data?.message ?? '快照已保存')
      refetch()
    } catch (e) {
      setSnapshotMsg(e instanceof Error ? e.message : '快照失败')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const m = data?.metrics
  const points = data?.points ?? []

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="账户绩效"
        subtitle="净值曲线 · 最大回撤 · 夏普比率"
        onRefresh={refetch}
        loading={loading}
        actions={
          <button
            onClick={handleSnapshot}
            disabled={snapshotLoading}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            <RefreshCw size={12} className={snapshotLoading ? 'animate-spin' : ''} />
            手动快照
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && <ErrorBanner message={error} />}
        {snapshotMsg && (
          <div className="text-xs font-mono text-accent-green px-3 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20">
            {snapshotMsg}
          </div>
        )}

        {/* 指标卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="总收益率"
            value={m ? pct(m.total_return) : '—'}
            sub={m ? `当前净值 ${yuan(m.current_equity)}` : undefined}
            color={m ? pctColor(m.total_return) : ''}
          />
          <MetricCard
            label="年化收益率"
            value={m ? pct(m.annual_return) : '—'}
            sub={m ? `交易 ${m.trading_days} 天` : undefined}
            color={m ? pctColor(m.annual_return) : ''}
          />
          <MetricCard
            label="最大回撤"
            value={m ? `-${m.max_drawdown.toFixed(2)}%` : '—'}
            sub={m ? `峰值 ${yuan(m.peak_equity)}` : undefined}
            color={m && m.max_drawdown > 10 ? 'text-accent-red' : 'text-ink-primary'}
          />
          <MetricCard
            label="夏普比率"
            value={m ? m.sharpe_ratio.toFixed(2) : '—'}
            sub={m ? `胜 ${m.win_days} 天 / 负 ${m.lose_days} 天` : undefined}
            color={m && m.sharpe_ratio >= 1 ? 'text-accent-green' : m && m.sharpe_ratio < 0 ? 'text-accent-red' : 'text-ink-primary'}
          />
        </div>

        {/* 日期范围切换 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">查看：</span>
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                days === d
                  ? 'bg-accent-green/15 border-accent-green/40 text-accent-green'
                  : 'border-terminal-border text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {d === 365 ? '1年' : `${d}天`}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono text-ink-muted">
            {points.length} 个交易日快照
          </span>
        </div>

        {/* 净值曲线图 */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} className="text-accent-green" />
            <span className="text-sm font-medium text-ink-primary">净值曲线</span>
            <span className="text-[10px] font-mono text-ink-muted ml-auto">绿线=净值 · 红区=回撤</span>
          </div>
          {loading
            ? <div className="h-48 bg-terminal-muted rounded animate-pulse" />
            : <EquityChart points={points} />
          }
        </div>

        {/* 每日明细表（最近 30 条） */}
        {points.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
              <TrendingUp size={13} className="text-ink-secondary" />
              <span className="text-sm font-medium text-ink-primary">每日明细</span>
              <span className="tag text-ink-muted">最近 30 条</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-terminal-border">
                    {['日期', '净值', '当日收益', '回撤', '已实现', '浮动'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().slice(0, 30).map(p => (
                    <tr key={p.date} className="data-row">
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{p.date}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-primary">{yuan(p.equity)}</td>
                      <td className={`px-4 py-2.5 font-mono text-xs ${pctColor(p.daily_return)}`}>{pct(p.daily_return)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-accent-red/70">
                        {p.drawdown > 0 ? `-${p.drawdown.toFixed(2)}%` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 font-mono text-xs ${pctColor(p.realized_pnl)}`}>{yuan(p.realized_pnl)}</td>
                      <td className={`px-4 py-2.5 font-mono text-xs ${pctColor(p.unrealized_pnl)}`}>{yuan(p.unrealized_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 空态 */}
        {!loading && points.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-muted">
            <TrendingDown size={36} strokeWidth={1} className="opacity-30" />
            <p className="text-sm">暂无净值快照数据</p>
            <p className="text-xs text-ink-muted/60 max-w-xs text-center">
              系统每天 16:35 盘后自动快照。<br />
              或点击右上角「手动快照」立即生成今日数据。
            </p>
            <button onClick={handleSnapshot} disabled={snapshotLoading}
              className="px-4 py-2 text-xs font-mono rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20 transition-colors disabled:opacity-40">
              立即生成快照
            </button>
          </div>
        )}

        {/* 说明 */}
        <div className="px-4 py-3 bg-terminal-panel border border-terminal-border rounded-xl text-[10px] font-mono text-ink-muted leading-relaxed">
          <span className="text-ink-secondary font-medium">计算说明：</span>
          净值 = 累计已实现盈亏 + 当日浮动盈亏。
          年化收益率 = (终值/初值)^(365/天数) - 1。
          最大回撤 = max((峰值 - 谷值) / 峰值)。
          夏普比率基于无风险利率 2.5%/年（日化 0.00993%），√252 年化。
        </div>
      </div>
    </div>
  )
}
