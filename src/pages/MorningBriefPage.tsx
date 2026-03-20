import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  Shield, Target, FileText, BarChart2, Sparkles,
  Clock, CheckCircle2, AlertTriangle, Info, Loader2, Newspaper, Globe2,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchSectionMarket, fetchSectionPosition, fetchSectionBuyPlans,
  fetchSectionReports, fetchSectionValuation, fetchSectionNews,
  fetchAIComment, fetchSectionExternal,
} from '@/api/morningBrief'
import type { MorningBriefSection } from '@/api/morningBrief'

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

// ── Section 样式配置 ──────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ElementType> = {
  '大盘情绪': TrendingUp,
  '持仓预警': Shield,
  '买入计划': Target,
  '研报速递': FileText,
  '估值机会': BarChart2,
  '新闻情绪': Newspaper,
  '外部信号': Globe2,
}

const LEVEL_STYLE: Record<MorningBriefSection['level'], {
  border: string; bg: string; dot: string; icon: React.ElementType
}> = {
  normal:  { border: 'border-terminal-border',  bg: '',                   dot: 'bg-ink-muted',                icon: CheckCircle2 },
  info:    { border: 'border-accent-blue/40',   bg: 'bg-accent-blue/5',   dot: 'bg-accent-blue',              icon: Info },
  warning: { border: 'border-accent-amber/50',  bg: 'bg-accent-amber/5',  dot: 'bg-accent-amber',             icon: AlertTriangle },
  danger:  { border: 'border-accent-red/50',    bg: 'bg-accent-red/5',    dot: 'bg-accent-red animate-pulse', icon: AlertTriangle },
}

// ── 已加载的 Section 卡片 ─────────────────────────────────────────

function SectionCard({ section }: { section: MorningBriefSection }) {
  const style   = LEVEL_STYLE[section.level]
  const Icon    = SECTION_ICONS[section.title] ?? FileText
  const LvlIcon = style.icon

  return (
    <div className={`card p-0 overflow-hidden border ${style.border} ${style.bg} transition-all duration-300`}>
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

// ── 加载中的 Skeleton 卡片 ────────────────────────────────────────

function SkeletonCard({ title, icon: Icon }: { title: string; icon?: React.ElementType }) {
  const Ic = Icon ?? FileText
  return (
    <div className="card p-0 overflow-hidden border border-terminal-border/50">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-terminal-border/40">
        <div className="w-1.5 h-5 rounded-full bg-terminal-muted animate-pulse" />
        <Ic size={14} className="text-ink-muted/40 flex-shrink-0" />
        <span className="text-sm font-medium text-ink-muted/60">{title}</span>
        <Loader2 size={12} className="ml-auto text-ink-muted/40 animate-spin" />
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {[80, 65, 90].map((w, i) => (
          <div key={i} className="flex gap-2">
            <div className="mt-1.5 w-1 h-1 bg-terminal-muted/50 rounded-full flex-shrink-0" />
            <div className="h-3 bg-terminal-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 容器：加载中显示 skeleton，加载完显示卡片 ──────────────

function SectionContainer({
  data, loading, title, icon,
}: {
  data: MorningBriefSection | null | undefined
  loading: boolean
  title: string
  icon?: React.ElementType
}) {
  if (loading && !data) return <SkeletonCard title={title} icon={icon} />
  if (!data) return null
  return <SectionCard section={data} />
}

// ── 主页面 ────────────────────────────────────────────────────────

export default function MorningBriefPage() {
  const today = new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })

  // 6 个独立请求——并行发出，各自独立渲染
  const { data: marketData,    loading: ml } = useQuery(useCallback(() => fetchSectionMarket(), []))
  const { data: positionData,  loading: pl } = useQuery(useCallback(() => fetchSectionPosition(), []))
  const { data: buyPlanData,   loading: bl } = useQuery(useCallback(() => fetchSectionBuyPlans(), []))
  const { data: reportData,    loading: rl } = useQuery(useCallback(() => fetchSectionReports(), []))
  const { data: valuationData, loading: vl } = useQuery(useCallback(() => fetchSectionValuation(), []))
  // 新闻情绪（含 LLM，最慢）— 独立加载，不影响其他 section
  const { data: newsData,      loading: nl } = useQuery(useCallback(() => fetchSectionNews(), []))
  const { data: externalData,  loading: xl } = useQuery(useCallback(() => fetchSectionExternal(), []))

  // AI 点评：轮询拿结果
  const [aiComment, setAiComment] = useState('')
  const [aiReady,   setAiReady]   = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 只要其他 section 都加载完，就开始轮询 AI 点评
  const coreLoaded = !ml && !pl && !bl && !rl && !vl

  useEffect(() => {
    if (!coreLoaded || aiReady) return

    const poll = async () => {
      try {
        const res = await fetchAIComment()
        const d = res.data.data
        if (d.ready && d.ai_comment) {
          setAiComment(d.ai_comment)
          setAiReady(true)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch { /* 静默 */ }
    }

    poll() // 立即尝试一次
    pollRef.current = setInterval(poll, 5_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [coreLoaded, aiReady])

  const market = marketData
  const moodTrend =
    market?.market_mood === 'DANGER'  ? <TrendingDown size={14} className="text-accent-red" />   :
    market?.market_mood === 'WARNING' ? <Minus size={14} className="text-accent-amber" />        :
    <TrendingUp size={14} className="text-accent-green" />

  const anyLoading = ml || pl || bl || rl || vl || nl || xl

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="开盘前报告"
        subtitle={`${today} · 各模块独立加载`}
        loading={anyLoading}
      />

      <div className="flex-1 overflow-y-auto p-5">

        {/* 顶部：大盘仪表 + 总结 + AI 点评 */}
        <div className="mb-6 p-5 card">
          <div className="flex items-center gap-5">
            {/* 仪表盘 */}
            {ml && !market ? (
              <div className="w-36 h-36 rounded-full bg-terminal-muted animate-pulse flex-shrink-0" />
            ) : market ? (
              <MoodGauge score={market.mood_score} mood={market.market_mood} />
            ) : null}

            {/* 右侧文字区 */}
            <div className="flex-1 min-w-0">
              {ml && !market ? (
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-terminal-muted rounded animate-pulse" />
                  <div className="h-3 w-full bg-terminal-muted rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-terminal-muted rounded animate-pulse" />
                </div>
              ) : market ? (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    {moodTrend}
                    <span className="text-sm font-medium text-ink-primary">
                      {market.market_mood === 'DANGER'  ? '市场极寒' :
                       market.market_mood === 'WARNING' ? '市场偏弱' :
                       market.mood_score >= 70           ? '市场火热' : '市场平稳'}
                    </span>
                  </div>
                  <p className="text-sm text-ink-secondary leading-relaxed">{market.mood_summary}</p>
                </>
              ) : null}

              {/* AI 点评区 */}
              <div className="mt-3 px-3 py-2 bg-accent-blue/5 border border-accent-blue/20 rounded-md min-h-[48px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={11} className="text-accent-blue" />
                  <span className="text-[10px] font-mono text-accent-blue uppercase tracking-wider">AI 点评</span>
                  {!aiReady && (
                    <span className="ml-1 flex items-center gap-1 text-[10px] font-mono text-accent-blue/60">
                      <Loader2 size={9} className="animate-spin" />
                      {coreLoaded ? '生成中…' : '等待数据加载…'}
                    </span>
                  )}
                </div>
                {aiComment ? (
                  <p className="text-xs text-ink-secondary leading-relaxed">{aiComment}</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-accent-blue/10 rounded animate-pulse w-full" />
                    <div className="h-2.5 bg-accent-blue/10 rounded animate-pulse w-4/5" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-ink-muted">
                <Clock size={9} />
                各模块独立加载，先到先显示
              </div>
            </div>
          </div>
        </div>

        {/* Section 卡片网格 — 哪个 section 先回来就先渲染 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SectionContainer
            data={marketData?.section}
            loading={ml}
            title="大盘情绪"
            icon={TrendingUp}
          />
          <SectionContainer
            data={positionData}
            loading={pl}
            title="持仓预警"
            icon={Shield}
          />
          <SectionContainer
            data={buyPlanData}
            loading={bl}
            title="买入计划"
            icon={Target}
          />
          <SectionContainer
            data={reportData}
            loading={rl}
            title="研报速递"
            icon={FileText}
          />
          <SectionContainer
            data={valuationData}
            loading={vl}
            title="估值机会"
            icon={BarChart2}
          />
          {/* 新闻情绪：最慢，skeleton 持续显示直到返回 */}
          <SectionContainer
            data={newsData}
            loading={nl}
            title="新闻情绪"
            icon={Newspaper}
          />
          <SectionContainer
            data={externalData}
            loading={xl}
            title="外部信号"
            icon={Globe2}
          />
        </div>
      </div>
    </div>
  )
}
