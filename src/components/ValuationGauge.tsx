import type { ValuationStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────────────────────────

/** 把 0-100 的分位值映射到半圆弧的角度（-90° ~ +90°，从左到右） */
function percentileToAngle(pct: number): number {
  // 分位 0 → -90°，分位 100 → +90°
  return (pct / 100) * 180 - 90
}

/** 极坐标转 SVG XY（圆心在 cx,cy，半径 r，角度从 9点钟方向顺时针） */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/** 生成 SVG 弧路径 */
function arc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const s = polar(cx, cy, r, startAngle)
  const e = polar(cx, cy, r, endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

// ─────────────────────────────────────────────────────────────────
// 颜色
// ─────────────────────────────────────────────────────────────────

function gaugeColor(status: ValuationStatus, pct: number | null): {
  track: string; needle: string; label: string; badge: string
} {
  if (status === 'loss')    return { track: '#3d5166', needle: '#7a8fa6', label: '亏损期',  badge: 'bg-ink-muted/20 text-ink-muted' }
  if (status === 'unknown') return { track: '#3d5166', needle: '#7a8fa6', label: '积累中',  badge: 'bg-ink-muted/20 text-ink-muted' }
  if (pct === null)         return { track: '#3d5166', needle: '#7a8fa6', label: '—',       badge: 'bg-ink-muted/20 text-ink-muted' }
  if (pct < 20)  return { track: '#00d97e', needle: '#00d97e', label: '低估',  badge: 'bg-accent-green/15 text-accent-green border border-accent-green/30' }
  if (pct <= 80) return { track: '#3b82f6', needle: '#3b82f6', label: '合理',  badge: 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30' }
  return              { track: '#ff4d6a', needle: '#ff4d6a', label: '高估',  badge: 'bg-accent-red/15 text-accent-red border border-accent-red/30' }
}

// ─────────────────────────────────────────────────────────────────
// ValuationGauge — 详情页半圆仪表盘
// ─────────────────────────────────────────────────────────────────

interface ValuationGaugeProps {
  peTTM:        number | null
  pb:           number | null
  pePercentile: number | null
  pbPercentile: number | null
  historyDays:  number
  status:       ValuationStatus
  /** 仪表盘宽度（px），默认 240 */
  size?:        number
}

export default function ValuationGauge({
  peTTM, pb, pePercentile, pbPercentile,
  historyDays, status, size = 240,
}: ValuationGaugeProps) {
  const cx = size / 2
  const cy = size * 0.55   // 圆心略低于中心，给文字留空间
  const outerR = size * 0.42
  const innerR = size * 0.30
  const needleR = outerR - 4

  const colors = gaugeColor(status, pePercentile)

  // 弧段：低估区（0-20）/ 合理区（20-80）/ 高估区（80-100）
  // 半圆：从 180° 到 360°（SVG 坐标系，顶部为 0°）
  const totalStart = 180
  const totalEnd   = 360
  const span       = totalEnd - totalStart  // 180°

  function segArc(from: number, to: number) {
    const s = totalStart + (from / 100) * span
    const e = totalStart + (to   / 100) * span
    return arc(cx, cy, (outerR + innerR) / 2, s, e)
  }

  const trackStroke = (outerR - innerR) + 2

  // 指针角度
  const needleAngleDeg = pePercentile !== null
    ? totalStart + (pePercentile / 100) * span
    : totalStart  // 指向最左（未知）

  const needleTip  = polar(cx, cy, needleR, needleAngleDeg)
  const needleBase = polar(cx, cy, innerR - 8, needleAngleDeg)

  return (
    <div className="flex flex-col items-center select-none">
      <svg
        width={size} height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
        aria-label={`估值仪表盘 ${status}`}
      >
        {/* 背景轨道 */}
        <path
          d={arc(cx, cy, (outerR + innerR) / 2, totalStart, totalEnd)}
          fill="none"
          stroke="#1e2d3d"
          strokeWidth={trackStroke}
          strokeLinecap="butt"
        />

        {/* 低估区（绿）0-20% */}
        <path d={segArc(0, 20)}   fill="none" stroke="#00d97e" strokeWidth={trackStroke} strokeOpacity={0.35} strokeLinecap="butt" />
        {/* 合理区（蓝）20-80% */}
        <path d={segArc(20, 80)}  fill="none" stroke="#3b82f6" strokeWidth={trackStroke} strokeOpacity={0.25} strokeLinecap="butt" />
        {/* 高估区（红）80-100% */}
        <path d={segArc(80, 100)} fill="none" stroke="#ff4d6a" strokeWidth={trackStroke} strokeOpacity={0.35} strokeLinecap="butt" />

        {/* 活跃进度（从起点到当前分位） */}
        {pePercentile !== null && pePercentile >= 0 && (
          <path
            d={arc(cx, cy, (outerR + innerR) / 2, totalStart, totalStart + (pePercentile / 100) * span)}
            fill="none"
            stroke={colors.track}
            strokeWidth={trackStroke}
            strokeOpacity={0.9}
            strokeLinecap="butt"
          />
        )}

        {/* 刻度标记 */}
        {[0, 20, 50, 80, 100].map(v => {
          const a = totalStart + (v / 100) * span
          const outer = polar(cx, cy, outerR + 4, a)
          const inner = polar(cx, cy, outerR + 12, a)
          return (
            <g key={v}>
              <line
                x1={outer.x} y1={outer.y}
                x2={inner.x} y2={inner.y}
                stroke="#3d5166" strokeWidth={1.5}
              />
              <text
                x={polar(cx, cy, outerR + 18, a).x}
                y={polar(cx, cy, outerR + 18, a).y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fill="#3d5166"
                fontFamily="monospace"
              >
                {v}
              </text>
            </g>
          )
        })}

        {/* 指针 */}
        {pePercentile !== null && (
          <>
            <line
              x1={needleBase.x} y1={needleBase.y}
              x2={needleTip.x}  y2={needleTip.y}
              stroke={colors.needle}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={5} fill={colors.needle} />
            <circle cx={cx} cy={cy} r={3} fill="#0d1117" />
          </>
        )}

        {/* 中心文字：PE 值 */}
        {peTTM !== null && peTTM > 0 && (
          <text
            x={cx} y={cy + 20}
            textAnchor="middle"
            fontSize={13}
            fontWeight="600"
            fill="#e8edf3"
            fontFamily="monospace"
          >
            PE {peTTM.toFixed(1)}
          </text>
        )}
        {peTTM !== null && peTTM < 0 && (
          <text x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fill="#7a8fa6" fontFamily="monospace">
            亏损
          </text>
        )}
        {peTTM === null && (
          <text x={cx} y={cy + 20} textAnchor="middle" fontSize={11} fill="#7a8fa6" fontFamily="monospace">
            PE N/A
          </text>
        )}
      </svg>

      {/* 状态徽章 */}
      <div className={`mt-1 px-3 py-0.5 rounded-full text-xs font-semibold font-mono ${colors.badge}`}>
        {colors.label}
        {pePercentile !== null && ` · ${pePercentile.toFixed(1)}% 分位`}
      </div>

      {/* 指标行 */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-center">
        {[
          { label: 'PE-TTM',   value: peTTM        !== null && peTTM > 0  ? peTTM.toFixed(2)        : peTTM !== null ? '亏损' : '—' },
          { label: 'PB',       value: pb            !== null               ? pb.toFixed(2)           : '—' },
          { label: 'PE 分位',  value: pePercentile  !== null               ? pePercentile.toFixed(1) + '%' : '积累中' },
          { label: 'PB 分位',  value: pbPercentile  !== null               ? pbPercentile.toFixed(1) + '%' : '积累中' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col">
            <span className="text-[10px] font-mono text-ink-muted">{label}</span>
            <span className="text-sm font-mono font-medium text-ink-primary">{value}</span>
          </div>
        ))}
      </div>

      {/* 历史天数提示 */}
      <p className="mt-2 text-[10px] font-mono text-ink-muted">
        {historyDays < 30
          ? `已积累 ${historyDays} 天 · ≥30 天后分位更准确`
          : `历史数据 ${historyDays} 天`}
      </p>
    </div>
  )
}
