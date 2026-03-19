import { useState, useCallback, useEffect, useRef } from 'react'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  Shield, Target, FileText, BarChart2, Sparkles,
  Clock, CheckCircle2, AlertTriangle, Info, Loader2,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { fetchMorningBrief } from '@/api/morningBrief'
import type { MorningBriefSection } from '@/api/morningBrief'
import { ErrorBanner } from '@/components/shared'

// ── 大盘情绪仪表 ──────────────────────────────────────────────────

function MoodGauge({ score, mood }: { score: number; mood: string }) {
  const color =
    mood === 'DANGER'  ? { arc: '#ef4444', text: 'text-accent-red',   label: '极寒', glow: 'shadow-[0_0_16px_rgba(239,68,68,0.35)]' }  :
    mood === 'WARNING' ? { arc: '#f59e0b', text: 'text-accent-amber', label: '偏弱', glow: 'shadow-[0_0_16px_rgba(245,158,11,0.35)]' } :
    score >= 70        ? { arc: '#00d97e', text: 'text-accent-green', label: '火热', glow: 'shadow-[0_0_16px_rgba(0,217,126,0.35)]' }  :
                         { arc: '#4b9eff', text: 'text-accent-blue',  label: '平稳', glow: 'shadow-[0_0_12px_rgba(75,158,255,0.25)]' }

  const r = 54, cx = 70, cy = 70
  const startAngle = -210, totalArc = 240
  const endAngle   = startAngle + totalArc * (score / 100)

  function polarToXY(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  function arcPath(start: number, end: number, radius: number) {
    const s = polarToXY(start, radius)
    const e = polarToXY(end, radius)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <div className={`relative flex flex-col items-center justify-center w-36 h-36 rounded-full border border-terminal-border bg-terminal-surface ${color.glow}`}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="absolute inset-0">
        <path d={arcPath(startAngle, startAngle + totalArc, r)} fill="none" stroke="var(--color-border-tertiary)" strokeWidth="8" strokeLinecap="round" />
        {score > 0 && (
          <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke={color.arc} strokeWidth="8" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color.arc}60)` }} />
        )}
      </svg>
      <span className={`text-3xl font-mono font-bold z-10 ${color.text}`}>{score}</span>
      <span className={`text-xs font-mono z-10 ${color.text} opacity-80`}>{color.label}</span>
    </div>
  )
}

// ── Section 配置 ──────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ElementType> = {
  '大盘情绪': TrendingUp,
  '持仓预警': Shield,
  '买入计划': Target,
  '研报速递': FileText,
  '估值机会': BarChart2,
}

const LEVEL_STYLE: Record<MorningBriefSection['level'], {
  border: string; bg: string; dot: string; icon: React.ElementType
}> = {
  normal:  { border: 'border-terminal-border',  bg: '',                   dot: 'bg-ink-muted',               icon: CheckCircle2 },
  info:    { border: 'border-accent-blue/40',   bg: 'bg-accent-blue/5',   dot: 'bg-accent-blue',             icon: Info },
  warning: { border: 'border-accent-amber/50',  bg: 'bg-accent-amber/5',  dot: 'bg-accent-amber',            icon: AlertTriangle },
  danger:  { border: 'border-accent-red/50',    bg: 'bg-accent-red/5',    dot: 'bg-accent-red animate-pulse', icon: AlertTriangle },
}

function SectionCard({ section }: { section: MorningBriefSection }) {
  const style   = LEVEL_STYLE[section.level]
  const Icon    = SECTION_ICONS[section.title] ?? FileText
  const LvlIcon = style.icon
  return (
    <div className={`card p-0 overflow-hidden border ${style.border} ${style.bg}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-terminal-border">
        <div className={`w-1.5 h-5 rounded-full ${style.dot}`} />
        <Icon size={14} className="text-ink-muted flex-shrink-0" />
        <span className="text-sm font-medium text-ink-primary">{section.title}</span>
        {section.level !== 'normal' && (
          <LvlIcon size={12} className={
            section.level === 'danger'  ? 'text-accent-red ml-auto'   :
            section.level === 'warning' ? 'text-accent-amber ml-auto' :
            'text-accent-blue ml-auto'
          } />
        )}
      </div>
      <ul className="px-4 py-3 space-y-2">
        {section.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-secondary leading-relaxed">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-ink-muted/50 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SkeletonSection() {
  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-5 bg-terminal-muted rounded animate-pulse" />
        <div className="h-3.5 w-20 bg-terminal-muted rounded animate-pulse" />
      </div>
      {[80, 65, 90].map((w, i) => (
        <div key={i} className="flex gap-2">
          <div className="mt-1.5 w-1 h-1 bg-terminal-muted rounded-full flex-shrink-0" />
          <div className="h-3 bg-terminal-muted rounded animate-pulse" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────

export default function MorningBriefPage() {
  const [forcing, setForcing] = useState(false)

  // 首次加载 — 读缓存（from_cache=true 时秒返回）
  const { data: brief, loading, error, refetch } = useQuery(
    useCallback(() => fetchMorningBrief(false), []),
  )

  // ── AI 点评轮询 ───────────────────────────────────────────────
  // 当 ai_pending=true 时，每 5s 静默轮询一次，拿到 AI 点评后停止
  // 关键：只更新 aiComment，不触发整体 loading，不清空内容
  const [aiComment, setAiComment]   = useState<string>('')
  const [aiPending, setAiPending]   = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!brief) return
    // 收到主体后初始化 AI 状态
    setAiComment(brief.ai_comment ?? '')
    setAiPending(brief.ai_pending ?? false)
  }, [brief?.date]) // 只在切换日期时重置，避免轮询结果覆盖

  // 当 aiPending=true 时启动轮询
  useEffect(() => {
    if (!aiPending) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const res = await fetchMorningBrief(false)
        const data = res.data.data
        if (data.ai_comment) {
          setAiComment(data.ai_comment)
          setAiPending(false)
        }
      } catch {
        // 静默失败，继续重试
      }
    }

    pollTimerRef.current = setInterval(poll, 5_000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [aiPending])

  // 强制刷新：只重新生成主体，不等 AI
  const handleForceRefresh = async () => {
    setForcing(true)
    setAiComment('')
    setAiPending(false)
    try {
      const res = await fetchMorningBrief(true)
      const data = res.data.data
      setAiComment(data.ai_comment ?? '')
      setAiPending(data.ai_pending ?? false)
      refetch() // 更新主 useQuery 的数据
    } finally {
      setForcing(false)
    }
  }

  const moodTrend =
    brief?.market_mood === 'DANGER'  ? <TrendingDown size={14} className="text-accent-red" />   :
    brief?.market_mood === 'WARNING' ? <Minus size={14} className="text-accent-amber" />         :
    <TrendingUp size={14} className="text-accent-green" />

  // 展示的 AI 点评（优先用轮询拿到的，其次用 brief 里已有的）
  const displayAI = aiComment || brief?.ai_comment || ''

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="开盘前报告"
        subtitle={
          brief
            ? `${brief.date} · ${brief.from_cache ? '缓存' : '最新'} · ${new Date(brief.generated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 生成`
            : '每日 08:50 自动生成'
        }
        onRefresh={() => refetch()}
        loading={loading || forcing}
        actions={
          <button
            onClick={handleForceRefresh}
            disabled={loading || forcing}
            className="btn-ghost text-xs disabled:opacity-40"
          >
            <RefreshCw size={12} className={forcing ? 'animate-spin' : ''} />
            强制刷新
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {/* 顶部：大盘仪表 + 总结 */}
        {(brief || loading) && (
          <div className="flex items-center gap-5 mb-6 p-5 card">
            {loading && !brief ? (
              <>
                <div className="w-36 h-36 rounded-full bg-terminal-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-24 bg-terminal-muted rounded animate-pulse" />
                  <div className="h-3 w-full bg-terminal-muted rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-terminal-muted rounded animate-pulse" />
                </div>
              </>
            ) : brief ? (
              <>
                <MoodGauge score={brief.mood_score} mood={brief.market_mood} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {moodTrend}
                    <span className="text-sm font-medium text-ink-primary">
                      {brief.market_mood === 'DANGER'  ? '市场极寒' :
                       brief.market_mood === 'WARNING' ? '市场偏弱' :
                       brief.mood_score >= 70           ? '市场火热' : '市场平稳'}
                    </span>
                    <span className="text-xs font-mono text-ink-muted ml-auto">{brief.date}</span>
                  </div>
                  <p className="text-sm text-ink-secondary leading-relaxed">{brief.mood_summary}</p>

                  {/* AI 点评区 — 有内容就展示，pending 时展示加载动效 */}
                  {(displayAI || aiPending) && (
                    <div className="mt-3 px-3 py-2 bg-accent-blue/5 border border-accent-blue/20 rounded-md">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles size={11} className="text-accent-blue" />
                        <span className="text-[10px] font-mono text-accent-blue uppercase tracking-wider">AI 点评</span>
                        {aiPending && !displayAI && (
                          <span className="ml-1 flex items-center gap-1 text-[10px] font-mono text-accent-blue/60">
                            <Loader2 size={9} className="animate-spin" />
                            生成中…
                          </span>
                        )}
                        {aiPending && displayAI && (
                          <Loader2 size={9} className="ml-1 animate-spin text-accent-blue/40" />
                        )}
                      </div>
                      {displayAI ? (
                        <p className="text-xs text-ink-secondary leading-relaxed">{displayAI}</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="h-2.5 bg-accent-blue/10 rounded animate-pulse w-full" />
                          <div className="h-2.5 bg-accent-blue/10 rounded animate-pulse w-4/5" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-ink-muted">
                    <Clock size={9} />
                    {brief.from_cache ? '读取缓存' : '实时生成'} · {new Date(brief.generated_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Section 卡片网格 */}
        {loading && !brief ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonSection key={i} />)}
          </div>
        ) : brief?.sections ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {brief.sections.map((section, i) => (
              <SectionCard key={i} section={section} />
            ))}
          </div>
        ) : !loading && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-muted gap-3">
            <div className="w-12 h-12 rounded-full border border-terminal-border flex items-center justify-center">
              <span className="text-xl font-mono">∅</span>
            </div>
            <p className="text-sm">暂无报告，点击「强制刷新」立即生成</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
