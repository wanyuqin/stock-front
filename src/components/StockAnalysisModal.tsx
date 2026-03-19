import { useCallback, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Brain, Star, StarOff, RefreshCw,
  PlusCircle, TrendingUp, TrendingDown,
  CheckCircle, AlertCircle,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery } from '@/hooks/useQuery'
import {
  fetchAnalysis, fetchQuote,
  addToWatchlist, removeFromWatchlist, fetchWatchlist,
  addTrade,
} from '@/api/stock'
import { fetchDailyRiskState } from '@/api/risk'
import { getPriceColor, formatPrice, formatRate } from '@/components/shared'
import type { ScoredStock } from '@/types'

// ── 工具 ──────────────────────────────────────────────────────────

function formatYuan(v: number) {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  return `${sign}${(abs / 1e4).toFixed(0)}万`
}

// ── 快速记录交易弹窗 ──────────────────────────────────────────────

interface QuickTradeFormProps {
  code: string
  name: string
  price: number
  onClose: () => void
  onSuccess: () => void
}

function QuickTradeForm({ code, name, price, onClose, onSuccess }: QuickTradeFormProps) {
  const [action, setAction]   = useState<'BUY' | 'SELL'>('BUY')
  const [volume, setVolume]   = useState('100')
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const { data: dailyRiskState } = useQuery(
    useCallback(() => fetchDailyRiskState(), []),
    { refetchInterval: 30_000 },
  )

  const handleSubmit = async () => {
    if (action === 'BUY' && dailyRiskState?.status === 'BLOCK') {
      setErr(dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）')
      return
    }
    const vol = parseInt(volume, 10)
    if (!vol || vol <= 0) { setErr('手数必须大于 0'); return }
    setLoading(true)
    setErr('')
    try {
      await addTrade({ stock_code: code, action, price, volume: vol, reason })
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '记录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-ink-primary">快速记录交易 · {name}（{code}）</p>
        <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
          <X size={14} />
        </button>
      </div>

      {/* 买卖切换 */}
      <div className="flex rounded-lg overflow-hidden border border-terminal-border text-xs font-mono">
        {(['BUY', 'SELL'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`flex-1 py-2 transition-colors ${
              action === a
                ? a === 'BUY'
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'bg-accent-red/20 text-accent-red'
                : 'text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {a === 'BUY' ? '买入' : '卖出'}
          </button>
        ))}
      </div>

      {/* 价格（只读，取当前价） */}
      <div className="flex gap-2 items-center text-xs">
        <span className="text-ink-muted w-12">价格</span>
        <span className="font-mono text-ink-primary">{formatPrice(price)}</span>
      </div>

      {/* 手数 */}
      <div className="flex gap-2 items-center">
        <span className="text-ink-muted text-xs w-12">手数</span>
        <input
          type="number"
          value={volume}
          min="1"
          onChange={e => setVolume(e.target.value)}
          className="flex-1 bg-terminal-muted border border-terminal-border rounded px-2 py-1.5 text-xs font-mono text-ink-primary outline-none focus:border-accent-cyan/50"
        />
        <span className="text-ink-muted text-xs">手（100股/手）</span>
      </div>

      {/* 备注 */}
      <div className="flex gap-2 items-start">
        <span className="text-ink-muted text-xs w-12 mt-1.5">备注</span>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="操作原因（选填）"
          rows={2}
          className="flex-1 bg-terminal-muted border border-terminal-border rounded px-2 py-1.5 text-xs font-mono text-ink-primary outline-none focus:border-accent-cyan/50 resize-none"
        />
      </div>

      {err && <p className="text-accent-red text-xs font-mono">{err}</p>}
      {!err && action === 'BUY' && dailyRiskState?.status === 'BLOCK' && (
        <p className="text-accent-red text-xs font-mono">{dailyRiskState.message || '当日亏损触发熔断，仅限制买入开仓（卖出/减仓不受影响）'}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || (action === 'BUY' && dailyRiskState?.status === 'BLOCK')}
        title={action === 'BUY' && dailyRiskState?.status === 'BLOCK' ? (dailyRiskState.message || '当日风控熔断，仅限制买入开仓（卖出/减仓不受影响）') : undefined}
        className="w-full py-2 rounded-lg text-xs font-mono font-semibold bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 transition-colors disabled:opacity-40"
      >
        {loading ? <RefreshCw size={12} className="inline animate-spin mr-1" /> : null}
        确认记录
      </button>
    </div>
  )
}

// ── AI 分析动画 ───────────────────────────────────────────────────

function AILoadingAnimation() {
  const dots = ['·', '··', '···']
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % dots.length), 500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-ink-muted">
      <div className="relative w-16 h-16">
        {/* 外圈旋转 */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
        {/* 内圈反转 */}
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-accent-green" style={{ animation: 'spin 1.5s linear infinite reverse' }} />
        {/* 中心图标 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain size={18} className="text-accent-cyan" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink-secondary">AI 深度分析中{dots[idx]}</p>
        <p className="text-xs text-ink-muted mt-1 font-mono">正在解析技术形态 · 资金结构 · 市场情绪</p>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

interface Props {
  stock: ScoredStock
  onClose: () => void
}

export default function StockAnalysisModal({ stock, onClose }: Props) {
  const navigate = useNavigate()
  const [inWatchlist, setInWatchlist]     = useState<boolean | null>(null)
  const [wlLoading, setWlLoading]         = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)
  const [tradeSuccess, setTradeSuccess]   = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // 获取 AI 分析
  const {
    data: analysis, loading: analysisLoading, error: analysisError, refetch: refetchAnalysis,
  } = useQuery(useCallback(() => fetchAnalysis(stock.code), [stock.code]))

  // 获取实时行情（弹窗内用最新价）
  const { data: quote } = useQuery(
    useCallback(() => fetchQuote(stock.code), [stock.code]),
    { refetchInterval: 15_000 },
  )

  // 检查自选股状态
  useQuery(
    useCallback(() => fetchWatchlist(), []),
    {
      onSuccess: (wl) => {
        setInWatchlist(wl.items.some((i) => i.stock_code === stock.code))
      },
    },
  )

  // 点击遮罩关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleWatchlist = async () => {
    setWlLoading(true)
    try {
      if (inWatchlist) {
        await removeFromWatchlist(stock.code)
        setInWatchlist(false)
      } else {
        await addToWatchlist(stock.code, `来自机会雷达 score=${stock.score}`)
        setInWatchlist(true)
      }
    } catch {
      // 静默失败
    } finally {
      setWlLoading(false)
    }
  }

  const currentPrice = quote?.price ?? stock.price
  const currentRate  = quote?.change_rate ?? stock.pct_chg
  const priceColor   = getPriceColor(currentRate)

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-terminal-panel border border-terminal-border rounded-xl shadow-2xl overflow-hidden animate-slide-in">

        {/* ── 头部 ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-3">
            <Brain size={16} className="text-accent-cyan" />
            <div>
              <p className="text-sm font-semibold text-ink-primary">
                {stock.name}
                <span className="ml-2 text-xs font-mono text-ink-muted">({stock.code})</span>
              </p>
              <p className="text-xs font-mono text-ink-muted">AI 深度分析报告</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 实时价格 */}
            <div className={`text-right mr-2 ${priceColor}`}>
              <p className="text-lg font-mono font-bold">{formatPrice(currentPrice)}</p>
              <p className="text-xs font-mono">{formatRate(currentRate)}</p>
            </div>

            {/* 加入自选 */}
            <button
              onClick={toggleWatchlist}
              disabled={wlLoading || inWatchlist === null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all disabled:opacity-40 ${
                inWatchlist
                  ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red'
                  : 'border-terminal-border text-ink-muted hover:border-accent-amber/50 hover:text-accent-amber'
              }`}
            >
              {wlLoading
                ? <RefreshCw size={11} className="animate-spin" />
                : inWatchlist ? <StarOff size={11} /> : <Star size={11} />
              }
              {inWatchlist ? '已自选' : '加自选'}
            </button>

            {/* 关闭 */}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink-primary hover:bg-terminal-muted transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── 主内容区 ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* 左栏：指标 + 操作 */}
          <div className="w-52 flex-shrink-0 flex flex-col border-r border-terminal-border overflow-y-auto">

            {/* 评分 */}
            <div className="p-4 border-b border-terminal-border">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">综合评分</p>
              <div className="flex items-center gap-3">
                <ScoreRingSmall score={stock.score} />
                <div>
                  <p className="text-2xl font-mono font-bold text-ink-primary">{stock.score}</p>
                  <p className="text-[10px] text-ink-muted">满分 100</p>
                </div>
              </div>
            </div>

            {/* 信号标签 */}
            <div className="p-4 border-b border-terminal-border">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">信号标签</p>
              <div className="flex flex-wrap gap-1">
                {(stock.tags ?? []).length > 0
                  ? stock.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan">
                        {tag}
                      </span>
                    ))
                  : <span className="text-xs text-ink-muted">—</span>
                }
              </div>
            </div>

            {/* 关键指标 */}
            <div className="p-4 border-b border-terminal-border space-y-2">
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-2">关键指标</p>
              {[
                { label: '主力占比', value: `${stock.main_inflow_pct.toFixed(2)}%`, color: stock.main_inflow_pct > 0 ? 'text-accent-green' : 'text-accent-red' },
                { label: '主力净入', value: formatYuan(stock.main_inflow), color: stock.main_inflow > 0 ? 'text-accent-green' : 'text-accent-red' },
                { label: '量比',     value: stock.vol_ratio.toFixed(2),  color: stock.vol_ratio > 1.5 ? 'text-accent-amber' : 'text-ink-secondary' },
                { label: '多头排列', value: stock.is_multi_aligned ? '是' : '否', color: stock.is_multi_aligned ? 'text-accent-green' : 'text-ink-muted' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-ink-muted">{label}</span>
                  <span className={`text-[11px] font-mono font-medium ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="p-4 space-y-2">
              {/* 查看详情页 */}
              <button
                onClick={() => { onClose(); navigate(`/stocks/${stock.code}`) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono border border-terminal-border text-ink-secondary hover:text-ink-primary hover:border-accent-cyan/30 transition-colors"
              >
                <TrendingUp size={12} />
                查看完整详情
              </button>

              {/* 记录交易 */}
              <button
                onClick={() => { setShowTradeForm(true); setTradeSuccess(false) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
              >
                <PlusCircle size={12} />
                记录交易
              </button>

              {tradeSuccess && (
                <div className="flex items-center gap-1 text-accent-green text-xs font-mono">
                  <CheckCircle size={11} />
                  已记录到交易日志
                </div>
              )}
            </div>
          </div>

          {/* 右栏：AI 报告 / 交易表单 */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {showTradeForm ? (
              <QuickTradeForm
                code={stock.code}
                name={stock.name}
                price={currentPrice}
                onClose={() => setShowTradeForm(false)}
                onSuccess={() => { setShowTradeForm(false); setTradeSuccess(true) }}
              />
            ) : (
              <>
                {/* AI 报告标题栏 */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-terminal-border">
                  <div className="flex items-center gap-2">
                    <Brain size={12} className="text-accent-cyan" />
                    <span className="text-xs font-mono text-ink-muted">
                      AI 研报
                      {analysis && (
                        <span className="ml-2 text-[10px] text-ink-muted/60">
                          {analysis.from_cache ? '（缓存）' : '（实时生成）'} · {analysis.model}
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={refetchAnalysis}
                    disabled={analysisLoading}
                    className="flex items-center gap-1 text-[11px] font-mono text-ink-muted hover:text-accent-cyan transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={11} className={analysisLoading ? 'animate-spin' : ''} />
                    刷新
                  </button>
                </div>

                {/* 报告内容 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {analysisLoading && !analysis && <AILoadingAnimation />}

                  {analysisError && !analysisLoading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-muted">
                      <AlertCircle size={28} strokeWidth={1.2} className="text-accent-red/60" />
                      <p className="text-xs font-mono text-accent-red">{analysisError}</p>
                      <button
                        onClick={refetchAnalysis}
                        className="text-xs font-mono text-accent-cyan hover:underline"
                      >
                        重试
                      </button>
                    </div>
                  )}

                  {analysis && (
                    <div className="prose-report">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {analysis.report}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 小型评分圆环（弹窗内用）────────────────────────────────────────

function ScoreRingSmall({ score }: { score: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 90 ? '#ef4444' : score >= 70 ? '#f59e0b' : score >= 50 ? '#06b6d4' : '#6b7280'

  return (
    <svg width="42" height="42" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r={r} fill="none" stroke="#2d2d3a" strokeWidth="4" />
      <circle
        cx="21" cy="21" r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}
