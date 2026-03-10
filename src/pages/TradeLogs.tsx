import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScrollText, TrendingUp, TrendingDown, Plus, X,
  RefreshCw, Activity, DollarSign, BarChart2, Trophy,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import {
  formatAmount, EmptyState, SkeletonRow, ErrorBanner,
} from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

// ═══════════════════════════════════════════════════════════════
// 类型定义（对齐后端 service.go 的 JSON 字段）
// ═══════════════════════════════════════════════════════════════

interface TradeLogVO {
  id:         number
  user_id:    number
  stock_code: string
  action:     'BUY' | 'SELL'
  price:      number
  volume:     number
  amount:     number   // price × volume，后端已计算
  traded_at:  string
  reason:     string
  created_at: string
}

interface TradeListResponse {
  code:  string
  items: TradeLogVO[]
  count: number
}

// PositionSummary 对应后端 service.PositionSummary（JSON 字段）
interface PositionSummary {
  stock_code:       string
  hold_volume:      number
  avg_cost_price:   number
  total_cost:       number
  realized_pnl:     number
  realized_trades:  number
  current_price:    number
  unrealized_pnl:   number
  unrealized_pct:   number
  total_pnl:        number
}

// PerformanceReport 对应后端 service.PerformanceReport（JSON 字段）
interface PerformanceReport {
  total_realized_pnl:   number
  total_unrealized_pnl: number
  total_pnl:            number
  positions:            PositionSummary[]
  total_trades:         number
  win_positions:        number
  lose_positions:       number
  calculated_at:        string
  note:                 string
}

// ── API 函数 ──────────────────────────────────────────────────────
const fetchAllTrades = (code: string) =>
  http.get<ApiResponse<TradeListResponse>>(`/trades/${code}`)

const fetchPerformance = () =>
  http.get<ApiResponse<PerformanceReport>>('/stats/performance')

const postTrade = (body: object) =>
  http.post<ApiResponse<TradeLogVO>>('/trades', body)

// ── 颜色工具 ──────────────────────────────────────────────────────
const pnlColor = (v: number) =>
  v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const pnlSign  = (v: number) => v > 0 ? '+' : ''

// ── 辅助组件：标签 ────────────────────────────────────────────────
const LabelXs = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
    {children}
  </label>
)

// ═══════════════════════════════════════════════════════════════
// 添加交易弹框
// ═══════════════════════════════════════════════════════════════
function AddTradeDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    stock_code: '', action: 'BUY', price: '', volume: '', traded_at: '', reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setErr('')
    const price  = parseFloat(form.price)
    const volume = parseInt(form.volume, 10)
    if (!form.stock_code.trim()) { setErr('请输入股票代码'); return }
    if (isNaN(price) || price <= 0)   { setErr('请输入有效的价格（大于 0）'); return }
    if (isNaN(volume) || volume <= 0) { setErr('请输入有效的数量（大于 0）'); return }

    setLoading(true)
    try {
      await postTrade({
        stock_code: form.stock_code.trim(),
        action:     form.action,
        price,
        volume,
        traded_at:  form.traded_at || undefined,
        reason:     form.reason.trim(),
      })
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = `w-full bg-terminal-muted border border-terminal-border rounded-md
    px-3 py-2 text-sm text-ink-primary placeholder-ink-muted
    focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-[420px] shadow-panel animate-fade-in">
        {/* 标题 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <ScrollText size={14} className="text-accent-cyan" />
            <span className="font-medium text-sm">记录交易</span>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 股票代码 + 方向 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>股票代码 *</LabelXs>
              <input
                autoFocus type="text" maxLength={6} placeholder="如 600519"
                value={form.stock_code}
                onChange={e => set('stock_code', e.target.value.replace(/\D/g, ''))}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div>
              <LabelXs>方向 *</LabelXs>
              <div className="flex gap-2 mt-1.5">
                {(['BUY', 'SELL'] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set('action', a)}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-all ${
                      form.action === a
                        ? a === 'BUY'
                          ? 'bg-accent-green/15 border-accent-green/40 text-accent-green'
                          : 'bg-accent-red/15 border-accent-red/40 text-accent-red'
                        : 'border-terminal-border text-ink-muted hover:border-terminal-muted'
                    }`}
                  >
                    {a === 'BUY' ? '买入' : '卖出'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 价格 + 数量 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>价格（元）*</LabelXs>
              <input
                type="number" step="0.01" min="0.01" placeholder="如 1800.00"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                className={inputCls + ' font-mono'}
              />
            </div>
            <div>
              <LabelXs>数量（手）*</LabelXs>
              <input
                type="number" step="1" min="1" placeholder="如 100"
                value={form.volume}
                onChange={e => set('volume', e.target.value)}
                className={inputCls + ' font-mono'}
              />
            </div>
          </div>

          {/* 金额预览 */}
          {form.price && form.volume && parseFloat(form.price) > 0 && parseInt(form.volume) > 0 && (
            <div className="px-3 py-2 rounded-md bg-terminal-muted border border-terminal-border text-xs font-mono text-ink-secondary">
              交易金额预估：
              <span className="text-ink-primary font-semibold ml-1">
                {formatAmount(parseFloat(form.price) * parseInt(form.volume, 10))}
              </span>
            </div>
          )}

          {/* 交易日期 */}
          <div>
            <LabelXs>交易日期（不填则为今日，补录历史可填）</LabelXs>
            <input
              type="date"
              value={form.traded_at}
              onChange={e => set('traded_at', e.target.value)}
              className={inputCls + ' font-mono'}
            />
          </div>

          {/* 理由 */}
          <div>
            <LabelXs>交易理由（可选）</LabelXs>
            <input
              type="text" maxLength={200} placeholder="如：回调至支撑位买入，均线金叉…"
              value={form.reason}
              onChange={e => set('reason', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={inputCls}
            />
          </div>

          {err && <ErrorBanner message={err} />}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">取消</button>
          <button
            type="button" onClick={handleSubmit} disabled={loading}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            {loading ? '提交中…' : '记录'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 盈亏报告面板
// ═══════════════════════════════════════════════════════════════
function PerformancePanel({ onRefresh }: { onRefresh?: () => void }) {
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchPerformance(), []),
  )

  const refresh = () => { refetch(); onRefresh?.() }

  if (loading && !data) {
    return (
      <div className="card p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-terminal-muted rounded w-40 mb-4" />
        {[70, 85, 55, 65].map((w, i) => (
          <div key={i} className="h-3 bg-terminal-muted rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }
  if (error) return <ErrorBanner message={error} />
  if (!data)  return null

  const r = data

  // 过滤出有持仓的
  const holding = r.positions.filter(p => p.hold_volume > 0)
  // 有已实现盈亏的
  const withRealized = r.positions.filter(p => p.realized_pnl !== 0)

  return (
    <div className="space-y-4">
      {/* ── 顶部汇总卡 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '总盈亏',    value: r.total_pnl,             icon: Activity,   neutral: false },
          { label: '已实现盈亏', value: r.total_realized_pnl,   icon: DollarSign, neutral: false },
          { label: '浮动盈亏',  value: r.total_unrealized_pnl,  icon: TrendingUp, neutral: false },
          { label: '交易笔数',  value: r.total_trades,          icon: ScrollText, neutral: true,  raw: true },
        ].map(({ label, value, icon: Icon, neutral, raw }) => (
          <div key={label} className="card p-4 flex items-start justify-between animate-fade-in">
            <div>
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xl font-mono font-bold ${neutral ? 'text-ink-primary' : pnlColor(value as number)}`}>
                {raw
                  ? String(value)
                  : `${neutral ? '' : pnlSign(value as number)}${formatAmount(Math.abs(value as number))}`
                }
              </p>
            </div>
            <div className={`w-8 h-8 rounded-lg bg-terminal-muted border border-terminal-border flex items-center justify-center ${neutral ? 'text-ink-muted' : pnlColor(value as number)}`}>
              <Icon size={14} strokeWidth={1.8} />
            </div>
          </div>
        ))}
      </div>

      {/* 胜率 / 股票数 */}
      {r.positions.length > 0 && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5 text-xs font-mono text-ink-muted">
            <Trophy size={11} className="text-accent-amber" />
            盈利 <span className="text-accent-green font-medium">{r.win_positions}</span> 只 ·
            亏损 <span className="text-accent-red font-medium">{r.lose_positions}</span> 只 ·
            共 {r.positions.length} 只
          </div>
          <span className="text-ink-muted text-[10px] font-mono ml-auto">{r.note}</span>
          <button
            onClick={refresh}
            className="text-xs font-mono text-ink-muted hover:text-accent-cyan transition-colors flex items-center gap-1"
          >
            <RefreshCw size={10} />
            刷新
          </button>
        </div>
      )}

      {/* ── 持仓明细表 ── */}
      {holding.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <TrendingUp size={13} className="text-accent-green" />
            <span className="text-sm font-medium">当前持仓</span>
            <span className="tag">{holding.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '持仓(手)', '成本均价', '现价', '总成本', '浮动盈亏', '浮动比例'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holding.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono">{pos.hold_volume.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">{pos.avg_cost_price.toFixed(4)}</td>
                    <td className="px-4 py-3 font-mono">
                      {pos.current_price > 0 ? pos.current_price.toFixed(2) : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">{formatAmount(pos.total_cost)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(pos.unrealized_pnl)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pnl)}${formatAmount(Math.abs(pos.unrealized_pnl))}`
                        : <span className="text-ink-muted">—</span>
                      }
                    </td>
                    <td className={`px-4 py-3 font-mono text-sm ${pnlColor(pos.unrealized_pct)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pct)}${pos.unrealized_pct.toFixed(2)}%`
                        : <span className="text-ink-muted">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 已实现盈亏明细 ── */}
      {withRealized.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <DollarSign size={13} className="text-accent-amber" />
            <span className="text-sm font-medium">已实现盈亏明细</span>
            <span className="tag">{withRealized.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '当前持仓', '持仓均价', '总成本', '已实现盈亏', '平仓次数'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withRealized.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.hold_volume.toLocaleString() : <span className="text-ink-muted">已清仓</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.avg_cost_price.toFixed(4) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? formatAmount(pos.total_cost) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(pos.realized_pnl)}`}>
                      {pnlSign(pos.realized_pnl)}{formatAmount(Math.abs(pos.realized_pnl))}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{pos.realized_trades} 次</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.positions.length === 0 && (
        <EmptyState message="暂无交易数据，点击右上角「记录交易」开始" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 交易历史查询（按股票代码）
// ═══════════════════════════════════════════════════════════════
function TradeDetailTable() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [query, setQuery] = useState('')

  const { data, loading, error } = useQuery(
    useCallback(() => (query ? fetchAllTrades(query) : Promise.resolve(null as any)), [query]),
    { enabled: !!query },
  )

  const items: TradeLogVO[] = data?.items ?? []

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-terminal-border">
        <BarChart2 size={13} className="text-ink-secondary" />
        <span className="text-sm font-medium">按股票查交易历史</span>
      </div>

      <div className="p-4 flex gap-2">
        <input
          type="text" maxLength={6} placeholder="输入 6 位股票代码，按 Enter 查询"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && code.length === 6 && setQuery(code)}
          className="flex-1 bg-terminal-muted border border-terminal-border rounded-md px-3 py-2 text-sm font-mono text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent-blue transition-colors"
        />
        <button
          onClick={() => setQuery(code)}
          disabled={code.length !== 6 || loading}
          className="btn-ghost disabled:opacity-40"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : '查询'}
        </button>
        {query && (
          <button
            onClick={() => navigate(`/stocks/${query}`)}
            className="btn-ghost text-accent-cyan"
          >
            K线图
          </button>
        )}
      </div>

      {error && <div className="px-4 pb-3"><ErrorBanner message={error} /></div>}

      {query && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-terminal-border">
                {['日期', '方向', '价格', '数量(手)', '交易金额', '交易理由'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : items.length === 0
                  ? <tr><td colSpan={6}><EmptyState message={`${query} 暂无交易记录`} /></td></tr>
                  : items.map(item => (
                      <tr key={item.id} className="data-row">
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {new Date(item.traded_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                            item.action === 'BUY'
                              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                          }`}>
                            {item.action === 'BUY' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {item.action === 'BUY' ? '买入' : '卖出'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">{item.volume.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-ink-secondary">{formatAmount(item.amount)}</td>
                        <td className="px-4 py-3 text-ink-muted text-xs max-w-[200px] truncate">
                          {item.reason || <span className="opacity-30">—</span>}
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════════════════════
export default function TradeLogs() {
  const [showAdd, setShowAdd] = useState(false)
  const [perfKey, setPerfKey] = useState(0)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="交易日志"
        subtitle="FIFO 成本法 · 实时浮动盈亏"
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-primary">盈亏总览</h2>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={13} />
            记录交易
          </button>
        </div>

        {/* key 变化会触发重新 fetch */}
        <div key={perfKey}>
          <PerformancePanel onRefresh={() => setPerfKey(k => k + 1)} />
        </div>

        <TradeDetailTable />
      </div>

      {showAdd && (
        <AddTradeDialog
          onClose={() => setShowAdd(false)}
          onSuccess={() => setPerfKey(k => k + 1)}
        />
      )}
    </div>
  )
}
