import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Brain, RefreshCw, Clock, Zap } from 'lucide-react'
import type { AnalysisResult } from '@/types'

interface AIReportPanelProps {
  data: AnalysisResult | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  smartSummary?: string  // 大单模块异步生成的一句话判定
}

export default function AIReportPanel({ data, loading, error, onRefresh, smartSummary }: AIReportPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-terminal-muted border border-terminal-border flex items-center justify-center">
            <Brain size={12} className="text-accent-cyan" />
          </div>
          <span className="text-sm font-medium text-ink-primary">AI 分析报告</span>
          {data?.from_cache && (
            <span className="tag">
              <Clock size={9} />
              缓存
            </span>
          )}
          {data?.model && data.model !== 'mock' && (
            <span className="tag">
              <Zap size={9} />
              {data.model}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-6 h-6 rounded flex items-center justify-center text-ink-muted hover:text-ink-primary hover:bg-terminal-muted transition-all disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 未触发状态：显示生成按鈕 */}
        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6 py-12">
            <div className="w-12 h-12 rounded-xl bg-terminal-muted border border-terminal-border flex items-center justify-center">
              <Brain size={22} className="text-ink-muted" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-ink-primary">AI 深度分析</p>
              <p className="text-[11px] text-ink-muted leading-relaxed">基于实时行情、技术面、资金面生成综合报告</p>
            </div>
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-sm font-mono hover:bg-accent-cyan/20 transition-all"
            >
              <Brain size={13} />
              生成 AI 分析
            </button>
          </div>
        )}

        {loading && !data && (
          <AILoadingSkeleton />
        )}

        {error && !data && (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
              <span className="text-accent-red text-base mt-0.5">⚠</span>
              <div>
                <p className="text-accent-red text-sm font-medium mb-1">分析失败</p>
                <p className="text-ink-muted text-xs">{error}</p>
              </div>
            </div>
            <button
              onClick={onRefresh}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-terminal-border text-ink-muted text-xs font-mono hover:text-ink-primary hover:border-ink-muted transition-all"
            >
              <RefreshCw size={11} />重试
            </button>
          </div>
        )}

        {data && (
          <div className="p-4 animate-fade-in">
            {/* 大单智能总结（异步展示，不阻塞 AI 报告） */}
            {smartSummary && (
              <div className="flex items-start gap-2 mb-4 rounded-lg border border-orange-500/30 bg-orange-500/8 px-3 py-2">
                <span className="text-orange-400 text-xs mt-0.5 flex-shrink-0">⚡</span>
                <p className="text-[11px] font-mono text-orange-200 leading-relaxed">{smartSummary}</p>
              </div>
            )}
            {/* 生成时间 */}
            <p className="text-[11px] font-mono text-ink-muted mb-4 flex items-center gap-1.5">
              <Clock size={10} />
              {new Date(data.created_at).toLocaleString('zh-CN')} 生成
              {loading && <span className="ml-2 text-accent-cyan animate-pulse">更新中…</span>}
            </p>

            {/* Markdown 渲染 */}
            <div className="prose-terminal">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {data.report}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 加载骨架屏 ────────────────────────────────────────────────────
function AILoadingSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <Brain size={14} className="text-accent-cyan animate-pulse" />
        <span className="text-sm text-ink-muted">AI 正在分析行情数据…</span>
      </div>
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} className={`h-3 bg-terminal-muted rounded`} style={{ width: `${w}%` }} />
      ))}
      <div className="border-t border-terminal-border pt-4 space-y-3">
        <div className="h-4 bg-terminal-muted rounded w-24" />
        {[65, 85, 55].map((w, i) => (
          <div key={i} className="h-3 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="border-t border-terminal-border pt-4 space-y-3">
        <div className="h-4 bg-terminal-muted rounded w-24" />
        {[70, 50].map((w, i) => (
          <div key={i} className="h-3 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── 自定义 Markdown 组件（终端主题）────────────────────────────────
const markdownComponents = {
  h2: ({ children }: any) => (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-primary mt-5 mb-2 pb-1.5 border-b border-terminal-border first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-medium text-ink-primary mt-3 mb-1.5">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="text-sm text-ink-secondary leading-relaxed mb-2">{children}</p>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-ink-primary">{children}</strong>
  ),
  em: ({ children }: any) => (
    <em className="text-accent-amber not-italic font-medium">{children}</em>
  ),
  ul: ({ children }: any) => (
    <ul className="space-y-1 mb-3 ml-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="space-y-1 mb-3 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="text-sm text-ink-secondary flex items-start gap-2">
      <span className="text-accent-green mt-1 flex-shrink-0 text-xs">▸</span>
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-accent-amber pl-3 my-2 text-ink-muted text-sm italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }: any) =>
    inline ? (
      <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-terminal-muted text-accent-cyan border border-terminal-border">
        {children}
      </code>
    ) : (
      <pre className="bg-terminal-muted border border-terminal-border rounded-lg p-3 my-2 overflow-x-auto">
        <code className="text-xs font-mono text-ink-secondary">{children}</code>
      </pre>
    ),
  hr: () => <hr className="border-terminal-border my-3" />,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-accent-blue hover:underline text-sm">
      {children}
    </a>
  ),
}
