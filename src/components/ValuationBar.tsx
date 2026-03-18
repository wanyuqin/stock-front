import type { ValuationStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────
// 颜色与标签映射
// ─────────────────────────────────────────────────────────────────

function barColor(status: ValuationStatus, percentile: number | null): string {
  if (status === 'loss') return 'bg-ink-muted'
  if (status === 'unknown' || percentile === null) return 'bg-terminal-border'
  if (percentile < 20)  return 'bg-accent-green'
  if (percentile <= 80) return 'bg-accent-blue/70'
  return 'bg-accent-red'
}

function statusLabel(status: ValuationStatus): { text: string; cls: string } {
  switch (status) {
    case 'undervalued': return { text: '低估',    cls: 'text-accent-green' }
    case 'normal':      return { text: '合理',    cls: 'text-accent-blue'  }
    case 'overvalued':  return { text: '高估',    cls: 'text-accent-red'   }
    case 'loss':        return { text: '亏损',    cls: 'text-ink-muted'    }
    default:            return { text: '积累中',  cls: 'text-ink-muted'    }
  }
}

// ─────────────────────────────────────────────────────────────────
// ValuationBar — 列表行内嵌进度条（设计规格：高度 8px）
// ─────────────────────────────────────────────────────────────────

interface ValuationBarProps {
  peTTM:        number | null
  pb:           number | null
  pePercentile: number | null
  pbPercentile: number | null
  historyDays:  number
  status:       ValuationStatus
  /** 是否显示第二条 PB 进度条（默认只显示 PE） */
  showPB?:      boolean
}

/**
 * ValuationBar
 * 列表视图中的极简估值进度条。
 * - PE 分位进度条（主）
 * - 可选 PB 分位进度条（次，showPB=true）
 * - Hover 时展示 tooltip
 */
export default function ValuationBar({
  peTTM, pb, pePercentile, pbPercentile,
  historyDays, status, showPB = false,
}: ValuationBarProps) {
  const peFill  = pePercentile !== null ? Math.max(2, pePercentile) : 0
  const pbFill  = pbPercentile !== null ? Math.max(2, pbPercentile) : 0
  const label   = statusLabel(status)
  const barCls  = barColor(status, pePercentile)

  // Tooltip 内容
  const tooltipLines: string[] = []
  if (peTTM !== null && peTTM > 0)
    tooltipLines.push(`PE-TTM: ${peTTM.toFixed(2)}`)
  else if (peTTM !== null && peTTM < 0)
    tooltipLines.push(`PE-TTM: 亏损（${peTTM.toFixed(2)}）`)
  if (pb !== null)
    tooltipLines.push(`PB: ${pb.toFixed(2)}`)
  if (pePercentile !== null)
    tooltipLines.push(`PE 历史分位: ${pePercentile.toFixed(1)}%`)
  if (pbPercentile !== null)
    tooltipLines.push(`PB 历史分位: ${pbPercentile.toFixed(1)}%`)
  tooltipLines.push(`历史数据: ${historyDays} 天`)
  if (historyDays < 30)
    tooltipLines.push('⚠ 积累 ≥30 天后分位更准确')

  const tooltip = tooltipLines.join('\n')

  return (
    <div className="group relative min-w-[100px]" title={tooltip}>
      {/* 状态标签 */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-mono font-semibold ${label.cls}`}>
          {label.text}
        </span>
        {pePercentile !== null && (
          <span className="text-[10px] font-mono text-ink-muted">
            {pePercentile.toFixed(1)}%
          </span>
        )}
      </div>

      {/* PE 进度条 */}
      <div className="relative h-2 bg-terminal-muted rounded-full overflow-hidden">
        {/* 区间背景色提示（低/中/高）*/}
        <div className="absolute inset-0 flex">
          <div className="w-[20%] bg-accent-green/8" />
          <div className="w-[60%] bg-transparent" />
          <div className="w-[20%] bg-accent-red/8" />
        </div>
        {/* 实际进度 */}
        {status === 'unknown' || pePercentile === null ? (
          /* 数据积累中：动画条 */
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="h-full w-1/3 bg-ink-muted/30 rounded-full animate-pulse" />
          </div>
        ) : (
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barCls}`}
            style={{ width: `${peFill}%` }}
          />
        )}
        {/* 分界线（30% / 70%） */}
        <div className="absolute top-0 bottom-0 left-[30%] w-px bg-terminal-border/60" />
        <div className="absolute top-0 bottom-0 left-[70%] w-px bg-terminal-border/60" />
      </div>

      {/* PB 进度条（可选） */}
      {showPB && (
        <div className="mt-1 relative h-1.5 bg-terminal-muted rounded-full overflow-hidden">
          {pbPercentile !== null ? (
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${barColor(status, pbPercentile)} opacity-70`}
              style={{ width: `${pbFill}%` }}
            />
          ) : (
            <div className="h-full w-1/4 bg-ink-muted/20 rounded-full animate-pulse" />
          )}
        </div>
      )}

      {/* Hover tooltip（精致版，覆盖原生 title） */}
      <div className="
        pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
        opacity-0 group-hover:opacity-100 transition-opacity duration-150
        bg-terminal-panel border border-terminal-border rounded-lg px-3 py-2 shadow-panel
        whitespace-nowrap text-[11px] font-mono text-ink-secondary min-w-[160px]
      ">
        {tooltipLines.map((line, i) => (
          <div key={i} className={line.startsWith('⚠') ? 'text-accent-amber mt-1' : ''}>
            {line}
          </div>
        ))}
        {/* 小箭头 */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 border-r border-b border-terminal-border bg-terminal-panel rotate-45 -mt-1" />
      </div>
    </div>
  )
}
