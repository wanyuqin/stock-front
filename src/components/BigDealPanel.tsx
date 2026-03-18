import { useCallback, useState } from 'react'
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { fetchBigDeal } from '@/api/stock'
import { ErrorBanner } from '@/components/shared'
import type { BigDealSummary, TickSizeStat, TickSize } from '@/types'

// ─────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────

function fmtWan(yuan: number): string {
  const abs = Math.abs(yuan)
  const sign = yuan >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  return `${sign}${(abs / 1e4).toFixed(0)}万`
}

function netFlowColor(v: number): string {
  if (v > 0) return 'text-accent-green'
  if (v < 0) return 'text-accent-red'
  return 'text-ink-muted'
}

// ─────────────────────────────────────────────────────────────────
// 散户/主力饼图（纯 SVG，无额外依赖）
// ─────────────────────────────────────────────────────────────────

interface PieSegment { pct: number; color: string; label: string }

function DonutPie({ segments }: { segments: PieSegment[] }) {
  const r = 36
  const cx = 50
  const cy = 50
  const strokeWidth = 14

  let cumAngle = -90 // 从 12 点钟方向开始
  const arcs = segments.map(seg => {
    const startAngle = cumAngle
    const sweep = seg.pct / 100 * 360
    cumAngle += sweep
    const endAngle = cumAngle

    const toRad = (deg: number) => (deg * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(endAngle))
    const y2 = cy + r * Math.sin(toRad(endAngle))
    const large = sweep > 180 ? 1 : 0

    return { ...seg, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, sweep }
  })

  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20 flex-shrink-0">
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={arc.d}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────
// 量级行
// ─────────────────────────────────────────────────────────────────

const SIZE_META: Record<TickSize, { label: string; color: string }> = {
  super:  { label: '特大单 ≥200万', color: '#f97316' },
  large:  { label: '大单 50~200万',  color: '#eab308' },
  medium: { label: '中单 20~50万',   color: '#22d3ee' },
  small:  { label: '小单 <20万',     color: '#475569' },
}

function SizeRow({ size, stat }: { size: TickSize; stat: TickSizeStat }) {
  const meta = SIZE_META[size]
  const total = stat.buy_amount + stat.sell_amount
  const buyPct = total > 0 ? stat.buy_amount / total * 100 : 50

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span style={{ color: meta.color }} className="font-semibold">{meta.label}</span>
        <span className={netFlowColor(stat.net_flow)}>{fmtWan(stat.net_flow)}</span>
      </div>
      {/* 买卖比例条 */}
      <div className="h-1.5 rounded-full overflow-hidden bg-accent-red/40 flex">
        <div
          className="h-full rounded-l-full transition-all duration-500"
          style={{ width: `${buyPct}%`, background: '#00d97e' }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-ink-muted">
        <span>买 {fmtWan(stat.buy_amount)}</span>
        <span className="text-ink-muted/60">{stat.count}笔</span>
        <span>卖 {fmtWan(stat.sell_amount)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 洗盘信号提示
// ─────────────────────────────────────────────────────────────────

function WashingAlert({ desc }: { desc: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/8 px-3 py-2">
      <ShieldAlert size={14} className="text-accent-amber mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-accent-amber">⚠️ 疑似主力洗盘吸筹</p>
        <p className="text-[10px] font-mono text-ink-muted mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// BigDealPanel 主组件
// ─────────────────────────────────────────────────────────────────

interface BigDealPanelProps {
  code: string
  changeRate?: number   // 实时涨跌幅，用于洗盘判断
  compact?: boolean     // K 线下方嵌入时用紧凑模式
}

export default function BigDealPanel({ code, changeRate, compact = false }: BigDealPanelProps) {
  // key 控制重新请求（按需刷新）
  const [fetchKey, setFetchKey] = useState(0)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [cooldown, setCooldown] = useState(false)

  const { data, loading, error } = useQuery<BigDealSummary>(
    useCallback(
      () => fetchBigDeal(code, changeRate),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [code, fetchKey],
    ),
  )

  const handleRefresh = () => {
    if (cooldown) return
    setFetchKey(k => k + 1)
    setLastFetchTime(new Date())
    // 30秒冷却，避免频繁触发腾讯限流
    setCooldown(true)
    setTimeout(() => setCooldown(false), 30_000)
  }

  if (loading && !data) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} flex items-center justify-center`}>
        <div className="flex items-center gap-2 text-ink-muted text-xs font-mono">
          <RefreshCw size={12} className="animate-spin" />
          加载大单数据…
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className={compact ? 'p-2' : 'p-4'}>
        <ErrorBanner message={error} />
      </div>
    )
  }

  // ── 未加载状态（首次未请求）──
  if (!data) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} flex flex-col items-center gap-2`}>
        <p className="text-[11px] font-mono text-ink-muted">大单分析（按需拉取）</p>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-border text-[11px] font-mono text-ink-muted hover:text-accent-cyan hover:border-accent-cyan/50 transition-all"
        >
          <RefreshCw size={11} />拉取今日大单
        </button>
      </div>
    )
  }

  // ── 数据已加载 ──
  const { main_flow_pct, retail_flow_pct, main_net_flow, stats,
          washing_signal, washing_signal_desc, time, desc } = data

  const pieSegments: PieSegment[] = [
    { pct: main_flow_pct,   color: '#f97316', label: '主力' },
    { pct: retail_flow_pct, color: '#475569', label: '散户' },
  ]

  const timeStr = time ? `${time.slice(0,2)}:${time.slice(2,4)}` : ''

  return (
    <div className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} space-y-3`}>

      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-ink-muted">大单分析</span>
          {timeStr && <span className="text-[10px] font-mono text-ink-muted/60">{timeStr}</span>}
          {lastFetchTime && (
            <span className="text-[9px] font-mono text-ink-muted/50">
              {lastFetchTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={cooldown || loading}
          title={cooldown ? '30秒冷却中，避免限流' : '刷新大单数据'}
          className="flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-30"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {cooldown ? '冷却中…' : '刷新'}
        </button>
      </div>

      {/* 洗盘信号 */}
      {washing_signal && <WashingAlert desc={washing_signal_desc} />}

      {/* 饼图 + 主力净流入 */}
      <div className="flex items-center gap-4">
        <DonutPie segments={pieSegments} />
        <div className="flex-1 space-y-2">
          {/* 图例 */}
          {pieSegments.map(seg => (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-[10px] font-mono text-ink-muted">{seg.label}</span>
              <span className="text-[10px] font-mono text-ink-primary ml-auto font-semibold">
                {seg.pct.toFixed(1)}%
              </span>
            </div>
          ))}
          {/* 主力净流入 */}
          <div className="pt-1 border-t border-terminal-border/50">
            <p className="text-[9px] font-mono text-ink-muted">主力净流入</p>
            <p className={`text-sm font-mono font-bold ${netFlowColor(main_net_flow)}`}>
              {main_net_flow >= 0
                ? <><TrendingUp size={12} className="inline mr-0.5" />{fmtWan(main_net_flow)}</>
                : <><TrendingDown size={12} className="inline mr-0.5" />{fmtWan(main_net_flow)}</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* 各量级详情 */}
      {stats && (
        <div className="space-y-2.5 border-t border-terminal-border/50 pt-2.5">
          {(['super', 'large', 'medium', 'small'] as TickSize[]).map(size => (
            stats[size] && stats[size].count > 0
              ? <SizeRow key={size} size={size} stat={stats[size]} />
              : null
          ))}
        </div>
      )}

      {/* 接口说明 */}
      {desc && (
        <p className="text-[9px] font-mono text-ink-muted/40 border-t border-terminal-border/30 pt-1.5">{desc}</p>
      )}
    </div>
  )
}
