import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ShieldCheck, ShieldX, Calculator } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { useQuery } from '@/hooks/useQuery'
import { ErrorBanner, formatAmount } from '@/components/shared'
import { fetchDailyRiskState, fetchEventCalendar, fetchPortfolioExposure, fetchPositionSizeSuggestion, fetchTodayRiskTodo, fetchWeeklyReview, updateTodayRiskTodoStatus } from '@/api/risk'

export default function RiskCenterPage() {
  const navigate = useNavigate()
  const [buyPrice, setBuyPrice] = useState('')
  const [stopLossPrice, setStopLossPrice] = useState('')
  const [sizeError, setSizeError] = useState('')
  const [eventLevel, setEventLevel] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')
  const [holdOnly, setHoldOnly] = useState(true)
  const [savingTodoIds, setSavingTodoIds] = useState<string[]>([])
  const [todoActionError, setTodoActionError] = useState('')
  const [batchSaving, setBatchSaving] = useState(false)

  const { data: dailyState, loading: dailyLoading, error: dailyError, refetch: refetchDaily } = useQuery(
    useCallback(() => fetchDailyRiskState(), []),
    { refetchInterval: 30_000 },
  )

  const { data: exposure, loading: exposureLoading, error: exposureError, refetch: refetchExposure } = useQuery(
    useCallback(() => fetchPortfolioExposure(), []),
    { refetchInterval: 60_000 },
  )
  const { data: calendar, loading: calendarLoading, error: calendarError, refetch: refetchCalendar } = useQuery(
    useCallback(() => fetchEventCalendar(7), []),
    { refetchInterval: 120_000 },
  )
  const { data: todo, loading: todoLoading, error: todoError, refetch: refetchTodo } = useQuery(
    useCallback(() => fetchTodayRiskTodo(), []),
    { refetchInterval: 60_000 },
  )
  const { data: weeklyReview, loading: weeklyLoading, error: weeklyError, refetch: refetchWeekly } = useQuery(
    useCallback(() => fetchWeeklyReview(7), []),
    { refetchInterval: 300_000 },
  )

  const {
    data: sizeSuggestion,
    loading: sizeLoading,
    error: sizeFetchError,
    refetch: refetchSize,
  } = useQuery(
    useCallback(() => {
      const b = parseFloat(buyPrice)
      const s = parseFloat(stopLossPrice)
      return fetchPositionSizeSuggestion(b, s)
    }, [buyPrice, stopLossPrice]),
    {
      enabled: false,
      onError: () => {},
    },
  )

  const refreshAll = () => {
    refetchDaily()
    refetchExposure()
    refetchCalendar()
    refetchTodo()
    refetchWeekly()
  }

  const runSizeCalc = () => {
    setSizeError('')
    const b = parseFloat(buyPrice)
    const s = parseFloat(stopLossPrice)
    if (isNaN(b) || isNaN(s)) {
      setSizeError('请先输入买入价和止损价')
      return
    }
    if (s >= b) {
      setSizeError('止损价必须小于买入价')
      return
    }
    refetchSize()
  }

  const dailyTone = dailyState?.status === 'BLOCK'
    ? 'border-accent-red bg-accent-red/10 text-accent-red'
    : dailyState?.status === 'WARN'
      ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
      : 'border-accent-green bg-accent-green/10 text-accent-green'

  const holdCodes = new Set((exposure?.items ?? []).flatMap((it) => it.stock_codes ?? []))
  const filteredEvents = (calendar?.items ?? []).filter((ev) => {
    if (eventLevel !== 'ALL' && ev.risk_level !== eventLevel) return false
    if (holdOnly && !holdCodes.has(ev.stock_code)) return false
    return true
  })

  const gotoTodoAction = (
    eventType: string,
    stockCode: string,
    title: string,
    actionHint: string,
    priority: string,
    todoID?: string,
    todoDate?: string,
  ) => {
    if (eventType === 'DAILY_RISK_STATE') {
      navigate('/guardian')
      return
    }
    if (eventType === 'PLAN_EXPIRY') {
      navigate('/buy-plans')
      return
    }
    if (eventType === 'LOW_HEALTH') {
      navigate('/guardian')
      return
    }
    if (/^\d{6}$/.test(stockCode)) {
      const reason = `${title}；${actionHint}`.slice(0, 120)
      const sellTemplate = priority === 'HIGH' ? 'ALL_OUT' : priority === 'MEDIUM' ? 'ONE_THIRD' : 'OBSERVE'
      const params = new URLSearchParams({
        draft: '1',
        code: stockCode,
        action: 'SELL',
        reason,
        priority,
        event_type: eventType,
        sell_template: sellTemplate,
        ...(todoID ? { todo_id: todoID } : {}),
        ...(todoDate ? { todo_date: todoDate } : {}),
      })
      navigate(`/trades?${params.toString()}`)
      return
    }
    navigate('/guardian')
  }

  const todoActionLabel = (eventType: string) => {
    if (eventType === 'DAILY_RISK_STATE') return '去处理仓位'
    if (eventType === 'PLAN_EXPIRY') return '去复盘计划'
    if (eventType === 'LOW_HEALTH') return '去优化持仓'
    return '生成交易草稿'
  }

  const updateOneTodoStatus = async (todoDate: string, todoID: string, done: boolean, shouldRefetch = true) => {
    setTodoActionError('')
    try {
      setSavingTodoIds((prev) => [...prev, todoID])
      await updateTodayRiskTodoStatus({
        todo_date: todoDate,
        todo_id: todoID,
        done,
      })
      if (shouldRefetch) await refetchTodo()
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : '待办状态保存失败'
      setTodoActionError(msg)
      return false
    } finally {
      setSavingTodoIds((prev) => prev.filter((id) => id !== todoID))
    }
  }

  const handleProcessAndDone = async (it: {
    id: string
    date: string
    event_type: string
    stock_code: string
    title: string
    action_hint: string
    priority: string
  }) => {
    const ok = await updateOneTodoStatus(it.date, it.id, true, false)
    if (!ok) return
    gotoTodoAction(it.event_type, it.stock_code, it.title, it.action_hint, it.priority, it.id, it.date)
  }

  const batchUpdateTodo = async (done: boolean) => {
    if (!todo || todo.items.length === 0) return
    setTodoActionError('')
    try {
      setBatchSaving(true)
      const targets = todo.items.filter((it) => it.done !== done)
      await Promise.all(targets.map((it) => updateTodayRiskTodoStatus({
        todo_date: todo.date,
        todo_id: it.id,
        done,
      })))
      await refetchTodo()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '批量更新待办失败'
      setTodoActionError(msg)
    } finally {
      setBatchSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="风险中心"
        subtitle="当日熔断 · 行业集中度 · 仓位建议"
        onRefresh={refreshAll}
        loading={dailyLoading || exposureLoading}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {(dailyError || exposureError || calendarError || todoError || weeklyError || todoActionError) && <ErrorBanner message={dailyError || exposureError || calendarError || todoError || weeklyError || todoActionError || '加载失败'} />}

        <div className="rounded-lg border border-terminal-border bg-terminal-muted/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono text-ink-muted uppercase tracking-wider">今日风险待办清单</div>
            <div className="flex items-center gap-2">
              {todo && (
                <div className="text-[11px] font-mono text-ink-muted">
                  总计 {todo.total} · 已完成 {todo.done_count} · 待处理 {todo.pending}
                </div>
              )}
              {todo && todo.total > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => batchUpdateTodo(true)}
                    disabled={batchSaving}
                    className="px-2 py-1 rounded border border-terminal-border text-[10px] font-mono text-ink-muted hover:text-ink-primary disabled:opacity-50"
                  >
                    全部完成
                  </button>
                  <button
                    type="button"
                    onClick={() => batchUpdateTodo(false)}
                    disabled={batchSaving}
                    className="px-2 py-1 rounded border border-terminal-border text-[10px] font-mono text-ink-muted hover:text-ink-primary disabled:opacity-50"
                  >
                    清空完成
                  </button>
                </>
              )}
              {batchSaving && (
                <div className="text-[10px] font-mono text-ink-muted">保存中…</div>
              )}
            </div>
          </div>
          {todoLoading ? (
            <div className="text-xs text-ink-muted">加载中…</div>
          ) : !todo || todo.items.length === 0 ? (
            <div className="text-xs text-ink-muted">今日暂无高优先级风险待办</div>
          ) : (
            <div className="space-y-2">
              {todo.items.map((it) => {
                const done = it.done
                const saving = savingTodoIds.includes(it.id)
                return (
                  <label key={it.id} className={`flex items-start gap-2 rounded border px-2 py-2 text-xs cursor-pointer ${done ? 'border-terminal-border bg-terminal-bg/30 text-ink-muted line-through' : 'border-terminal-border bg-terminal-bg/60'}`}>
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={saving}
                      onChange={async (e) => {
                        const nextDone = e.target.checked
                        await updateOneTodoStatus(todo.date, it.id, nextDone, true)
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={it.priority === 'HIGH' ? 'text-accent-red font-semibold' : 'text-accent-amber'}>{it.priority}</span>
                        <span>{it.date} · {it.stock_name}（{it.stock_code}）{saving ? ' · 保存中…' : ''}</span>
                      </div>
                      <div className="mt-1 text-ink-secondary line-clamp-1">{it.title}</div>
                      <div className="mt-1 text-ink-muted">建议：{it.action_hint}</div>
                      {!done && !saving && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              gotoTodoAction(it.event_type, it.stock_code, it.title, it.action_hint, it.priority, it.id, it.date)
                            }}
                            className="px-2 py-1 rounded border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan text-[10px] font-mono hover:bg-accent-cyan/15 transition-colors"
                          >
                            {todoActionLabel(it.event_type)}
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              await handleProcessAndDone(it)
                            }}
                            className="px-2 py-1 rounded border border-accent-green/30 bg-accent-green/10 text-accent-green text-[10px] font-mono hover:bg-accent-green/15 transition-colors"
                          >
                            处理并完成
                          </button>
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-terminal-border bg-terminal-muted/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono text-ink-muted uppercase tracking-wider">每周复盘报告（近7天）</div>
            {weeklyReview && (
              <div className="text-[11px] font-mono text-ink-muted">
                {weeklyReview.from_date} ~ {weeklyReview.to_date}
              </div>
            )}
          </div>
          {weeklyLoading ? (
            <div className="text-xs text-ink-muted">生成中…</div>
          ) : !weeklyReview ? (
            <div className="text-xs text-ink-muted">暂无复盘数据</div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded border border-terminal-border p-2">成交笔数<br /><span className="font-mono text-ink-primary">{weeklyReview.total_trades}</span></div>
                <div className="rounded border border-terminal-border p-2">卖出胜率<br /><span className="font-mono text-ink-primary">{weeklyReview.win_rate.toFixed(1)}%</span></div>
                <div className="rounded border border-terminal-border p-2">已实现盈亏<br /><span className={weeklyReview.realized_pnl >= 0 ? 'font-mono text-accent-green' : 'font-mono text-accent-red'}>{formatAmount(weeklyReview.realized_pnl)}</span></div>
                <div className="rounded border border-terminal-border p-2">最大回撤<br /><span className="font-mono text-accent-amber">{weeklyReview.max_drawdown_pct.toFixed(2)}%</span></div>
              </div>
              <div className="text-ink-secondary">{weeklyReview.summary}</div>
              {weeklyReview.top_issues.length > 0 && (
                <div>
                  <div className="text-ink-muted mb-1">高频问题：</div>
                  <div className="flex flex-wrap gap-2">
                    {weeklyReview.top_issues.map((it) => (
                      <span key={it.key} className="px-2 py-1 rounded border border-accent-red/30 bg-accent-red/10 text-accent-red text-[11px] font-mono">
                        {it.label} × {it.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {weeklyReview.suggestions.length > 0 && (
                <div>
                  <div className="text-ink-muted mb-1">下周建议：</div>
                  <div className="space-y-1">
                    {weeklyReview.suggestions.map((s, i) => (
                      <div key={i} className="text-ink-secondary">- {s}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`rounded-lg border p-4 ${dailyTone}`}>
            <div className="flex items-center gap-2 mb-2">
              {dailyState?.status === 'BLOCK' ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
              <span className="text-xs font-mono uppercase tracking-wider">当日风控状态</span>
            </div>
            <div className="text-lg font-mono font-bold">{dailyState?.status ?? '—'}</div>
            <div className="text-xs mt-2">
              当日亏损 {formatAmount(dailyState?.daily_loss_amount ?? 0)} / 阈值 {formatAmount(dailyState?.loss_limit_amount ?? 0)}
            </div>
            <div className="text-xs mt-1">
              今日新开仓 {dailyState?.today_buy_open_count ?? 0}/{dailyState?.max_buy_open_per_day ?? 2} · 连亏 {dailyState?.consecutive_loss_days ?? 0}/{dailyState?.consecutive_loss_limit ?? 2}
            </div>
            <div className="text-xs mt-1 opacity-90">{dailyState?.message ?? '—'}</div>
            {!!(dailyState?.guardrails_triggered?.length) && (
              <div className="mt-2 space-y-1">
                {dailyState?.guardrails_triggered.map((g, i) => (
                  <div key={i} className="text-[11px] opacity-90">- {g}</div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-muted/40 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-ink-muted uppercase tracking-wider">
              <AlertTriangle size={13} />
              行业集中度（上限 {exposure?.sector_limit_pct ?? 30}%）
            </div>
            {!exposure || exposure.items.length === 0 ? (
              <div className="text-xs text-ink-muted">暂无持仓行业暴露数据</div>
            ) : (
              <div className="space-y-2">
                {exposure.items.slice(0, 8).map((it) => (
                  <div key={it.sector} className="flex items-center justify-between text-xs">
                    <div className="text-ink-secondary">{it.sector}（{it.position_count}只）</div>
                    <div className={it.over_limit ? 'text-accent-red font-semibold' : 'text-ink-primary'}>
                      {it.exposure_pct.toFixed(1)}% · {formatAmount(it.exposure_amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-terminal-border bg-terminal-muted/40 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-mono text-ink-muted uppercase tracking-wider">
            <Calculator size={13} />
            仓位建议计算器
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="买入价（如 10.50）"
              className="w-full bg-terminal-surface border border-terminal-border rounded-md px-3 py-2 text-sm font-mono"
            />
            <input
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              placeholder="止损价（如 9.80）"
              className="w-full bg-terminal-surface border border-terminal-border rounded-md px-3 py-2 text-sm font-mono"
            />
            <button onClick={runSizeCalc} className="btn-primary justify-center" disabled={sizeLoading}>
              {sizeLoading ? '计算中…' : '计算建议仓位'}
            </button>
          </div>

          {(sizeError || sizeFetchError) && (
            <div className="mt-2"><ErrorBanner message={sizeError || sizeFetchError || '计算失败'} /></div>
          )}

          {sizeSuggestion && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded border border-terminal-border p-2">建议股数<br /><span className="font-mono text-ink-primary">{sizeSuggestion.suggested_volume} 股</span></div>
              <div className="rounded border border-terminal-border p-2">建议金额<br /><span className="font-mono text-ink-primary">{formatAmount(sizeSuggestion.suggested_amount)}</span></div>
              <div className="rounded border border-terminal-border p-2">建议仓位<br /><span className="font-mono text-ink-primary">{sizeSuggestion.suggested_position_pct.toFixed(2)}%</span></div>
              <div className="rounded border border-terminal-border p-2">每股风险<br /><span className="font-mono text-ink-primary">¥{sizeSuggestion.risk_per_share.toFixed(2)}</span></div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-terminal-border bg-terminal-muted/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono text-ink-muted uppercase tracking-wider">未来7天风险事件</div>
            {calendar && (
              <div className="text-[11px] font-mono text-ink-muted">
                高风险 <span className="text-accent-red">{calendar.high_count}</span> · 中风险 <span className="text-accent-amber">{calendar.medium_count}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setEventLevel(lv)}
                className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                  eventLevel === lv
                    ? 'border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10'
                    : 'border-terminal-border text-ink-muted hover:text-ink-primary'
                }`}
              >
                {lv === 'ALL' ? '全部' : lv}
              </button>
            ))}
            <button
              onClick={() => setHoldOnly((v) => !v)}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                holdOnly
                  ? 'border-accent-green/40 text-accent-green bg-accent-green/10'
                  : 'border-terminal-border text-ink-muted hover:text-ink-primary'
              }`}
            >
              仅看持仓股
            </button>
            <span className="text-[10px] font-mono text-ink-muted">当前 {filteredEvents.length} 条</span>
          </div>
          {calendarLoading ? (
            <div className="text-xs text-ink-muted">加载中…</div>
          ) : !calendar || filteredEvents.length === 0 ? (
            <div className="text-xs text-ink-muted">未来7天暂无事件风险</div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.slice(0, 12).map((ev, idx) => (
                <div key={`${ev.stock_code}-${ev.date}-${idx}`} className="rounded border border-terminal-border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-ink-primary font-medium">{ev.date} · {ev.stock_name}（{ev.stock_code}）</div>
                    <span className={ev.risk_level === 'HIGH' ? 'text-accent-red font-semibold' : ev.risk_level === 'MEDIUM' ? 'text-accent-amber' : 'text-ink-muted'}>
                      {ev.risk_level}
                    </span>
                  </div>
                  <div className="text-ink-secondary mt-1">{ev.title}</div>
                  <div className="text-ink-muted mt-1">建议：{ev.action_hint}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
