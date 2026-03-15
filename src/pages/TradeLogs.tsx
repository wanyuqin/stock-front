import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScrollText, TrendingUp, TrendingDown, Plus, X,
  RefreshCw, Activity, DollarSign, BarChart2, Trophy,
  Search, Filter,
} from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { formatAmount, EmptyState, SkeletonRow, ErrorBanner } from '@/components/shared'
import http from '@/api/http'
import type { ApiResponse } from '@/types'

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

interface TradeLogVO {
  id:         number
  stock_code: string
  action:     'BUY' | 'SELL'
  price:      number
  volume:     number
  amount:     number
  traded_at:  string
  reason:     string
}

interface TradeListResponse {
  items:  TradeLogVO[]
  count:  number
  limit?: number
  offset?: number
}

interface PositionSummary {
  stock_code:      string
  hold_volume:     number
  avg_cost_price:  number
  total_cost:      number
  realized_pnl:    number
  realized_trades: number
  current_price:   number
  unrealized_pnl:  number
  unrealized_pct:  number
  total_pnl:       number
}

interface PerformanceReport {
  total_realized_pnl:   number
  total_unrealized_pnl: number
  total_pnl:            number
  positions:            PositionSummary[]
  total_trades:         number
  win_positions:        number
  lose_positions:       number
  note:                 string
}

// ── API ──────────────────────────────────────────────────────────
const fetchAllTrades = (limit = 200) =>
  http.get<ApiResponse<TradeListResponse>>('/trades', { params: { limit } })

const fetchPerformance = () =>
  http.get<ApiResponse<PerformanceReport>>('/stats/performance')

const postTrade = (body: object) =>
  http.post<ApiResponse<TradeLogVO>>('/trades', body)

// ── 工具 ──────────────────────────────────────────────────────────
const pnlColor = (v: number) =>
  v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-ink-secondary'
const pnlSign = (v: number) => v > 0 ? '+' : ''

const LabelXs = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
    {children}
  </label>
)

const fDate = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

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
    if (!form.stock_code.trim())      { setErr('请输入股票代码'); return }
    if (isNaN(price)  || price  <= 0) { setErr('请输入有效的价格（大于 0）'); return }
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
    px-3 py-2 text-sm text-ink-primary placeholder-ink-muted/40
    focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/20 transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="card w-[440px] shadow-panel animate-fade-in">

        {/* 顶部色条 */}
        <div className="h-0.5 w-full bg-gradient-to-r from-accent-green/60 via-accent-cyan/40 to-transparent rounded-t-xl" />

        {/* 标题 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-green/10 border border-accent-green/30
              flex items-center justify-center">
              <ScrollText size={13} className="text-accent-green" />
            </div>
            <span className="font-semibold text-sm text-ink-primary">记录交易</span>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-ink-muted
              hover:text-ink-primary hover:bg-terminal-muted transition-colors">
            <X size={13} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 代码 + 方向 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>股票代码 *</LabelXs>
              <input autoFocus type="text" maxLength={6} placeholder="如 600519"
                value={form.stock_code}
                onChange={e => set('stock_code', e.target.value.replace(/\D/g, ''))}
                className={inputCls + ' font-mono tracking-widest'} />
            </div>
            <div>
              <LabelXs>交易方向 *</LabelXs>
              <div className="flex gap-2 mt-1">
                {(['BUY', 'SELL'] as const).map(a => (
                  <button key={a} type="button" onClick={() => set('action', a)}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold border transition-all ${
                      form.action === a
                        ? a === 'BUY'
                          ? 'bg-accent-green/15 border-accent-green/50 text-accent-green'
                          : 'bg-accent-red/15 border-accent-red/50 text-accent-red'
                        : 'border-terminal-border text-ink-muted hover:border-ink-muted/40'
                    }`}>
                    {a === 'BUY' ? '▲ 买入' : '▼ 卖出'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 价格 + 数量 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelXs>成交价格（元）*</LabelXs>
              <input type="number" step="0.01" min="0.01" placeholder="如 12.50"
                value={form.price} onChange={e => set('price', e.target.value)}
                className={inputCls + ' font-mono'} />
            </div>
            <div>
              <LabelXs>成交数量（股）*</LabelXs>
              <input type="number" step="100" min="1" placeholder="如 1000"
                value={form.volume} onChange={e => set('volume', e.target.value)}
                className={inputCls + ' font-mono'} />
            </div>
          </div>

          {/* 金额预览 */}
          {form.price && form.volume && parseFloat(form.price) > 0 && parseInt(form.volume) > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg
              bg-accent-green/5 border border-accent-green/20 text-xs font-mono">
              <span className="text-ink-muted">交易金额</span>
              <span className="text-accent-green font-semibold">
                {formatAmount(parseFloat(form.price) * parseInt(form.volume, 10))}
              </span>
            </div>
          )}

          {/* 日期 */}
          <div>
            <LabelXs>交易日期（留空 = 今日）</LabelXs>
            <input type="date" value={form.traded_at}
              onChange={e => set('traded_at', e.target.value)}
              className={inputCls + ' font-mono'} />
          </div>

          {/* 理由 */}
          <div>
            <LabelXs>交易理由（可选）</LabelXs>
            <input type="text" maxLength={200} placeholder="如：回调至支撑位，均线金叉…"
              value={form.reason} onChange={e => set('reason', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={inputCls} />
          </div>

          {err && <ErrorBanner message={err} />}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
            取消
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
              bg-accent-green/15 border border-accent-green/40 text-accent-green
              hover:bg-accent-green/25 hover:border-accent-green/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {loading
              ? <><RefreshCw size={12} className="animate-spin" /> 提交中…</>
              : <><Plus size={12} /> 确认记录</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 盈亏概览
// ═══════════════════════════════════════════════════════════════
function PerformancePanel({ refreshKey, onDataLoad }: {
  refreshKey: number
  onDataLoad?: () => void
}) {
  const { data, loading, error, refetch } = useQuery(
    useCallback(() => fetchPerformance(), [refreshKey]), // eslint-disable-line react-hooks/exhaustive-deps
  )

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
  if (!data) return null

  const r = data
  const holding      = r.positions.filter(p => p.hold_volume > 0)
  const withRealized = r.positions.filter(p => p.realized_pnl !== 0)
  onDataLoad?.()

  return (
    <div className="space-y-3">
      {/* 汇总卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '总盈亏',     value: r.total_pnl,             icon: Activity,   raw: false },
          { label: '已实现盈亏', value: r.total_realized_pnl,    icon: DollarSign, raw: false },
          { label: '浮动盈亏',   value: r.total_unrealized_pnl,  icon: TrendingUp, raw: false },
          { label: '交易笔数',   value: r.total_trades,          icon: ScrollText, raw: true  },
        ].map(({ label, value, icon: Icon, raw }) => (
          <div key={label} className="card p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xl font-mono font-bold ${raw ? 'text-ink-primary' : pnlColor(value as number)}`}>
                {raw ? String(value) : `${pnlSign(value as number)}${formatAmount(Math.abs(value as number))}`}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-lg bg-terminal-muted border border-terminal-border
              flex items-center justify-center ${raw ? 'text-ink-muted' : pnlColor(value as number)}`}>
              <Icon size={14} strokeWidth={1.8} />
            </div>
          </div>
        ))}
      </div>

      {/* 胜率 */}
      {r.positions.length > 0 && (
        <div className="flex items-center gap-3 px-1 text-xs font-mono text-ink-muted">
          <Trophy size={11} className="text-accent-amber flex-shrink-0" />
          盈利 <span className="text-accent-green font-medium">{r.win_positions}</span> 只 ·
          亏损 <span className="text-accent-red font-medium">{r.lose_positions}</span> 只 ·
          共 {r.positions.length} 只
          <span className="ml-auto text-[10px] opacity-60">{r.note}</span>
          <button onClick={refetch}
            className="flex items-center gap-1 text-ink-muted hover:text-accent-cyan transition-colors">
            <RefreshCw size={10} /> 刷新
          </button>
        </div>
      )}

      {/* 持仓表 */}
      {holding.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <TrendingUp size={13} className="text-accent-green" />
            <span className="text-sm font-medium text-ink-primary">当前持仓</span>
            <span className="tag text-ink-muted">{holding.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '持仓(股)', '成本均价', '现价', '总成本', '浮动盈亏', '浮动比例'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holding.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono">{pos.hold_volume.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{pos.hold_volume.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">
                      {pos.current_price > 0 ? pos.current_price.toFixed(2) : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">{formatAmount(pos.total_cost)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(pos.unrealized_pnl)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pnl)}${formatAmount(Math.abs(pos.unrealized_pnl))}`
                        : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className={`px-4 py-3 font-mono ${pnlColor(pos.unrealized_pct)}`}>
                      {pos.current_price > 0
                        ? `${pnlSign(pos.unrealized_pct)}${pos.unrealized_pct.toFixed(2)}%`
                        : <span className="text-ink-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 已实现盈亏 */}
      {withRealized.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-terminal-border">
            <DollarSign size={13} className="text-accent-amber" />
            <span className="text-sm font-medium text-ink-primary">已实现盈亏</span>
            <span className="tag text-ink-muted">{withRealized.length} 只</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terminal-border">
                  {['代码', '当前持仓', '持仓均价', '总成本', '已实现盈亏', '平仓次数'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withRealized.map(pos => (
                  <tr key={pos.stock_code} className="data-row">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-secondary">{pos.stock_code}</td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.hold_volume.toLocaleString() : <span className="text-ink-muted">已清仓</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-secondary">
                      {pos.hold_volume > 0 ? pos.avg_cost_price.toFixed(3) : '—'}
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
        <EmptyState message="暂无持仓数据，点击右上角「记录交易」开始" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 全量交易流水（默认展示，支持按代码筛选）
// ═══════════════════════════════════════════════════════════════
function TradeHistory({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')        // 输入框实时值
  const [actionFilter, setActionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')

  const { data, loading, error } = useQuery(
    useCallback(() => fetchAllTrades(500), [refreshKey]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  const allItems: TradeLogVO[] = data?.items ?? []

  // 前端过滤（不需要额外请求）
  const filtered = useMemo(() => {
    let list = allItems
    if (filter.trim()) {
      list = list.filter(i => i.stock_code.includes(filter.trim().toUpperCase()))
    }
    if (actionFilter !== 'ALL') {
      list = list.filter(i => i.action === actionFilter)
    }
    return list
  }, [allItems, filter, actionFilter])

  // 从全量记录提取去重的股票代码，供快速导航
  const codes = useMemo(() =>
    [...new Set(allItems.map(i => i.stock_code))].sort(),
    [allItems],
  )

  return (
    <div className="card overflow-hidden">
      {/* 标题 + 过滤栏 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-terminal-border flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <BarChart2 size={13} className="text-ink-secondary" />
          <span className="text-sm font-medium text-ink-primary">交易流水</span>
          {data && (
            <span className="tag text-ink-muted">{filtered.length} / {allItems.length} 条</span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* 买卖筛选 */}
          <div className="flex rounded-lg border border-terminal-border overflow-hidden text-[11px] font-mono">
            {(['ALL', 'BUY', 'SELL'] as const).map(a => (
              <button key={a} onClick={() => setActionFilter(a)}
                className={`px-2.5 py-1.5 transition-colors ${
                  actionFilter === a
                    ? a === 'BUY' ? 'bg-accent-green/15 text-accent-green'
                      : a === 'SELL' ? 'bg-accent-red/15 text-accent-red'
                      : 'bg-terminal-muted text-ink-primary'
                    : 'text-ink-muted hover:text-ink-secondary'
                }`}>
                {a === 'ALL' ? '全部' : a === 'BUY' ? '▲ 买入' : '▼ 卖出'}
              </button>
            ))}
          </div>

          {/* 代码搜索框 */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="text" maxLength={6} placeholder="代码筛选…"
              value={filter}
              onChange={e => setFilter(e.target.value.replace(/\D/g, ''))}
              className="pl-7 pr-3 py-1.5 w-28 bg-terminal-muted border border-terminal-border rounded-lg
                text-xs font-mono text-ink-primary placeholder-ink-muted/40
                focus:outline-none focus:border-accent-green/40 transition-colors"
            />
            {filter && (
              <button onClick={() => setFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary">
                <X size={10} />
              </button>
            )}
          </div>

          {/* 筛选出结果时显示跳转K线按钮 */}
          {filter.length === 6 && (
            <button onClick={() => navigate(`/stocks/${filter.toUpperCase()}`)}
              className="btn-ghost text-accent-cyan text-[11px]">
              K线图
            </button>
          )}
        </div>
      </div>

      {/* 快速标签（股票代码云） */}
      {codes.length > 0 && !filter && (
        <div className="px-5 py-2 border-b border-terminal-border flex items-center gap-1.5 flex-wrap">
          <Filter size={10} className="text-ink-muted flex-shrink-0" />
          {codes.map(code => (
            <button key={code} onClick={() => setFilter(code)}
              className="px-2 py-0.5 text-[10px] font-mono rounded border
                border-terminal-border text-ink-muted hover:text-ink-primary
                hover:border-accent-green/30 transition-colors">
              {code}
            </button>
          ))}
        </div>
      )}

      {error && <div className="px-5 py-3"><ErrorBanner message={error} /></div>}

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="border-b border-terminal-border">
              {['日期', '代码', '方向', '价格', '数量', '金额', '备注'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-mono text-ink-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState message={
                        allItems.length === 0
                          ? '暂无交易记录，点击右上角「记录交易」开始'
                          : `没有找到 ${filter} 的交易记录`
                      } />
                    </td>
                  </tr>
                )
                : filtered.map(item => (
                    <tr key={item.id} className="data-row group">
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                        {fDate(item.traded_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/stocks/${item.stock_code}`)}
                          className="font-mono text-xs font-semibold text-ink-secondary
                            hover:text-accent-cyan transition-colors underline-offset-2 hover:underline">
                          {item.stock_code}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]
                          font-mono font-semibold border ${
                          item.action === 'BUY'
                            ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                            : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                        }`}>
                          {item.action === 'BUY'
                            ? <><TrendingUp size={9} /> 买入</>
                            : <><TrendingDown size={9} /> 卖出</>
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-primary">{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-primary">{item.volume.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{formatAmount(item.amount)}</td>
                      <td className="px-4 py-3 text-ink-muted text-xs max-w-[180px] truncate">
                        {item.reason || <span className="opacity-30">—</span>}
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════════════════════
export default function TradeLogs() {
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey(k => k + 1)

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="交易日志"
        subtitle="FIFO 成本法 · 实时浮动盈亏"
        actions={
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={13} />
            记录交易
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <PerformancePanel refreshKey={refreshKey} />
        <TradeHistory refreshKey={refreshKey} />
      </div>

      {showAdd && (
        <AddTradeDialog
          onClose={() => setShowAdd(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}
