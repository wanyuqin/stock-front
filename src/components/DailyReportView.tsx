import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import {
  FileText, RefreshCw, Zap, BarChart2, TrendingUp,
  Clock, Sparkles, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { useQuery } from '@/hooks/useQuery'
import { ErrorBanner } from '@/components/shared'
import { fetchDailyReport, generateDailyReport } from '@/api/stock'
import type { DailyScanItem } from '@/api/stock'

// ══════════════════════════════════════════════════════════════
// 信号元数据
// ══════════════════════════════════════════════════════════════

const SIGNAL_META: Record<string, { label: string; color: string; dot: string }> = {
  VOLUME_UP:  {
    label: '量能放大',
    color: 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber',
    dot:   'bg-accent-amber',
  },
  MA20_BREAK: {
    label: '突破MA20',
    color: 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue',
    dot:   'bg-accent-blue',
  },
  BIG_RISE: {
    label: '大涨信号',
    color: 'bg-accent-green/10 border-accent-green/30 text-accent-green',
    dot:   'bg-accent-green',
  },
}

const MOOD_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  '贪婪': { label: '贪婪 🔥', color: 'text-accent-red',   bg: 'bg-accent-red/10 border-accent-red/30',     icon: TrendingUp    },
  '中性': { label: '中性 ⚖️', color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/30', icon: BarChart2     },
  '恐惧': { label: '恐惧 ❄️', color: 'text-accent-blue',  bg: 'bg-accent-blue/10 border-accent-blue/30',   icon: AlertTriangle },
}

// ══════════════════════════════════════════════════════════════
// Markdown 渲染器样式（与 AIReportPanel 保持一致的终端风格）
// ══════════════════════════════════════════════════════════════

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-ink-primary mt-5 mb-3 pb-2 border-b border-terminal-border flex items-center gap-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-ink-primary mt-4 mb-2 flex items-center gap-1.5">
      <span className="w-0.5 h-4 bg-accent-cyan rounded-full inline-block" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-accent-cyan mt-3 mb-1.5 font-mono uppercase tracking-wider">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-ink-secondary leading-relaxed mb-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="not-italic text-accent-amber">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 mb-3 ml-1">{children}</ul>
  ),
  li: ({ children }) => (
    <li className="text-sm text-ink-secondary flex items-start gap-2">
      <span className="mt-1.5 w-1 h-1 rounded-full bg-accent-cyan flex-shrink-0" />
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-cyan/40 pl-3 my-2 text-ink-muted text-xs italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded text-[11px] font-mono bg-terminal-muted text-accent-cyan border border-terminal-border">
      {children}
    </code>
  ),
  hr: () => <hr className="border-terminal-border my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xs font-mono border border-terminal-border rounded">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-terminal-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-ink-muted uppercase tracking-wider border-b border-terminal-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-ink-secondary border-b border-terminal-border/50">{children}</td>
  ),
}

// ══════════════════════════════════════════════════════════════
// 信号看板 — 每只异动股一张卡片
// ══════════════════════════════════════════════════════════════

function SignalBoard({ scans }: { scans: DailyScanItem[] }) {
  const navigate = useNavigate()

  if (scans.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs font-mono text-ink-muted">
        <Zap size={11} />
        今日暂无异动信号
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
      {scans.map(sc => {
        const pnlColor = sc.pct_chg > 0
          ? 'text-accent-green'
          : sc.pct_chg < 0
          ? 'text-accent-red'
          : 'text-ink-secondary'

        return (
          <button
            key={sc.id}
            onClick={() => navigate(`/stocks/${sc.stock_code}`)}
            className="group flex items-start gap-3 p-3 rounded-lg border border-terminal-border bg-terminal-muted/40
              hover:bg-terminal-muted hover:border-accent-cyan/40 transition-all text-left w-full"
          >
            {/* 左侧：代码 + 名称 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="font-mono text-[11px] text-ink-muted">{sc.stock_code}</span>
                <span className="text-sm font-medium text-ink-primary truncate">{sc.stock_name || sc.stock_code}</span>
              </div>

              {/* 信号徽章 */}
              <div className="flex flex-wrap gap-1">
                {sc.signals.map(sig => {
                  const meta = SIGNAL_META[sig] ?? {
                    label: sig, color: 'bg-terminal-muted border-terminal-border text-ink-muted', dot: 'bg-ink-muted',
                  }
                  return (
                    <span
                      key={sig}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${meta.color}`}
                    >
                      <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* 右侧：涨跌 + 跳转 */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`font-mono text-sm font-semibold ${pnlColor}`}>
                {sc.pct_chg > 0 ? '+' : ''}{sc.pct_chg.toFixed(2)}%
              </span>
              <span className="font-mono text-[11px] text-ink-muted">{sc.price.toFixed(2)}</span>
              <ChevronRight
                size={12}
                className="text-ink-muted opacity-0 group-hover:opacity-100 group-hover:text-accent-cyan transition-all"
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DailyReportView 主组件
// ══════════════════════════════════════════════════════════════

interface DailyReportViewProps {
  /** 展开时的最大高度（默认 500px），超出滚动 */
  maxContentHeight?: number
}

export default function DailyReportView({ maxContentHeight = 500 }: DailyReportViewProps) {
  const [forceKey, setForceKey] = useState(0)
  const [isForce,  setIsForce]  = useState(false)
  const [generating, setGenerating] = useState(false)

  const { data, loading, error, refetch } = useQuery(
    useCallback(
      () => fetchDailyReport(undefined, isForce),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [forceKey],
    ),
  )

  // 手动触发生成（调 POST 接口，保证 AI 重新跑一次）
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateDailyReport()
      setIsForce(false)
      setForceKey(k => k + 1) // 重新 fetch
    } finally {
      setGenerating(false)
    }
  }

  const report = data
  const mood   = report?.market_mood ?? '中性'
  const moodMeta = MOOD_META[mood] ?? MOOD_META['中性']
  const MoodIcon = moodMeta.icon

  // ── 骨架屏 ────────────────────────────────────────────────────
  if (loading && !report) {
    return (
      <div className="card overflow-hidden animate-pulse">
        <div className="px-5 py-3 border-b border-terminal-border flex items-center gap-3">
          <div className="h-3 w-24 bg-terminal-muted rounded" />
          <div className="h-4 w-16 bg-terminal-muted rounded ml-auto" />
        </div>
        <div className="p-5 space-y-3">
          {[80, 60, 90, 50, 70].map((w, i) => (
            <div key={i} className="h-3 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* ── 标题栏 ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-accent-cyan" />
          <span className="text-sm font-medium text-ink-primary">每日复盘简报</span>
          {report && (
            <span className="text-[11px] font-mono text-ink-muted">{report.date}</span>
          )}
          {/* 市场情绪徽章 */}
          {report && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${moodMeta.bg} ${moodMeta.color}`}>
              <MoodIcon size={9} />
              {moodMeta.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 缓存提示 */}
          {report?.from_cache && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-ink-muted">
              <Clock size={9} />
              缓存
            </span>
          )}
          {/* 刷新按钮 */}
          <button
            onClick={refetch}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-40"
            title="刷新报告"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          {/* 重新生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="btn-ghost text-xs disabled:opacity-40"
            title="调用 AI 重新生成"
          >
            {generating
              ? <><RefreshCw size={11} className="animate-spin" />生成中…</>
              : <><Sparkles size={11} />重新生成</>
            }
          </button>
        </div>
      </div>

      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      {report && (
        <>
          {/* ── 信号看板 ────────────────────────────────────────── */}
          <div className="border-b border-terminal-border">
            <div className="flex items-center gap-2 px-5 py-2">
              <Zap size={12} className="text-accent-amber" />
              <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                今日异动信号
              </span>
              <span className="tag">{report.scans?.length ?? 0} 只</span>
            </div>
            <SignalBoard scans={report.scans ?? []} />
          </div>

          {/* ── Markdown 简报正文 ────────────────────────────────── */}
          <div
            className="overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-terminal-border"
            style={{ maxHeight: maxContentHeight }}
          >
            {report.content
              ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={mdComponents}
                >
                  {report.content}
                </ReactMarkdown>
              )
              : (
                <p className="text-xs font-mono text-ink-muted text-center py-8">
                  暂无复盘内容，请先运行信号扫描后生成。
                </p>
              )
            }
          </div>

          {/* ── 底部元信息 ──────────────────────────────────────── */}
          {report.generated_at && (
            <div className="px-5 py-2 border-t border-terminal-border flex items-center gap-1.5 text-[10px] font-mono text-ink-muted">
              <Clock size={9} />
              生成于 {new Date(report.generated_at).toLocaleString('zh-CN')}
              {report.from_cache && ' · 来自缓存'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
