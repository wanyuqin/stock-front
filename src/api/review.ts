import http from './http'
import { resolveMarketSource } from './marketSource'
import { ReviewStats, TradeReview, AiAudit, ScatterPoint, BehaviorStat, BuyContext } from '../types/review'
import { KLineResponse, ApiResponse } from '../types'

// ── 后端响应类型 ──────────────────────────────────────────────────

interface DashboardResponse {
  total_reviews:          number
  win_count:              number
  win_rate:               number
  logic_consistent_count: number
  logic_consistency_rate: number
  lucky_win_count:        number
  lucky_win_rate:         number
  avg_regret_index:       number
  max_regret_index:       number
  regret_count:           number
  regret_rate:            number
  avg_execution_score:    number
  last_review_at:         string
  mental_state_stats: {
    mental_state: string
    count:        number
    avg_pnl_pct:  number
    win_rate:     number
  }[]
}

interface TradeReviewWithTrade {
  id:               number
  trade_log_id:     number
  stock_code:       string
  stock_name:       string
  mental_state:     string
  user_note:        string
  tags:             string[]
  buy_reason:       string
  sell_reason:      string
  ai_audit_comment: string
  execution_score:  number | null
  regret_index:     number | null
  consistency_flag: string
  consistency_note: string
  pnl_pct:          number | null
  price_at_sell:    number | null
  price_5d_after:   number | null
  traded_at:        string
  created_at:       string
  trade_price:      number
  trade_volume:     number
  buy_context:      BuyContext | null
}

// ── API 函数 ──────────────────────────────────────────────────────

export const fetchReviewStats = async (): Promise<ReviewStats> => {
  const { data: response } = await http.get<ApiResponse<DashboardResponse>>('/review/dashboard')
  const data = response.data
  return {
    consistency_rate:    data.logic_consistency_rate,
    avg_regret_percent:  data.avg_regret_index,
    avg_execution_score: data.avg_execution_score,
  }
}

export const fetchTradeReviews = async (): Promise<TradeReview[]> => {
  const { data: response } = await http.get<ApiResponse<{ items: TradeReviewWithTrade[] }>>('/review/list', {
    params: { limit: 100, offset: 0 },
  })
  const items = response.data.items ?? []
  return items.map(mapToTradeReview)
}

export const fetchScatterData = async (): Promise<ScatterPoint[]> => {
  const { data: response } = await http.get<ApiResponse<{ items: TradeReviewWithTrade[] }>>('/review/list', {
    params: { limit: 100, offset: 0 },
  })
  const items = response.data.items ?? []
  return items.map(item => {
    let sentiment = 50
    const m = item.mental_state || ''
    if      (m === '恐惧' || m === '恐慌') sentiment = 90
    else if (m === '贪婪')                 sentiment = 80
    else if (m === '急躁')                 sentiment = 70
    else if (m === '犹豫')                 sentiment = 60
    else if (m === '迷茫')                 sentiment = 55
    else if (m === '自信')                 sentiment = 30
    else if (m === '冷静')                 sentiment = 15
    return {
      id:              String(item.id),
      sentiment_score: sentiment + (Math.random() * 6 - 3),
      pnl_percent:     (item.pnl_pct ?? 0) * 100,
      is_consistent:   item.consistency_flag === 'NORMAL',
    }
  })
}

export const fetchAiAudit = async (tradeId: string, existingComment?: string): Promise<AiAudit> => {
  if (existingComment && existingComment.trim()) {
    const review = await getReviewById(tradeId)
    const klineData = await fetchKlineForReview(review?.stock_code ?? '')
    return { trade_id: tradeId, comment: existingComment, kline_data: klineData, is_generating: false }
  }
  triggerAiAuditAsync(tradeId)
  const review = await getReviewById(tradeId)
  const klineData = await fetchKlineForReview(review?.stock_code ?? '')
  return {
    trade_id:      tradeId,
    comment:       'AI 正在深度分析中，通常需要 30-60 秒，请稍后刷新页面查看结果…',
    kline_data:    klineData,
    is_generating: true,
  }
}

export const submitImprovementPlan = async (tradeLogId: number, content: string): Promise<void> => {
  await http.post<ApiResponse<unknown>>('/review/submit', {
    trade_log_id: tradeLogId,
    user_note:    content,
  })
}

export const fetchBehaviorStats = async (): Promise<{ items: BehaviorStat[]; total_trades: number }> => {
  const { data: response } = await http.get<ApiResponse<{ items: BehaviorStat[]; total_trades: number }>>('/review/behavior-stats')
  return response.data ?? { items: [], total_trades: 0 }
}

// ── 内部工具函数 ──────────────────────────────────────────────────

function triggerAiAuditAsync(reviewId: string): void {
  http.post<ApiResponse<unknown>>(`/review/ai/${reviewId}`)
    .catch(err => console.warn('AI audit trigger failed (background):', err))
}

async function getReviewById(reviewId: string): Promise<TradeReviewWithTrade | null> {
  try {
    const { data: response } = await http.get<ApiResponse<{ items: TradeReviewWithTrade[] }>>('/review/list', {
      params: { limit: 200, offset: 0 },
    })
    return (response.data.items ?? []).find(i => String(i.id) === reviewId) ?? null
  } catch {
    return null
  }
}

async function fetchKlineForReview(stockCode: string): Promise<AiAudit['kline_data']> {
  if (!stockCode) return []
  try {
    const { data: wrapper } = await http.get<ApiResponse<KLineResponse>>(`/stocks/${stockCode}/kline`, {
      params: { limit: 30, source: resolveMarketSource() },
    })
    return (wrapper.data?.klines ?? []).map(k => ({
      date: k.date, open: k.open, close: k.close, high: k.high, low: k.low,
    }))
  } catch {
    return []
  }
}

function mapToTradeReview(item: TradeReviewWithTrade): TradeReview {
  const pnlPct    = (item.pnl_pct ?? 0) * 100
  const sellPrice = item.price_at_sell ?? item.trade_price ?? 0
  const buyPrice  = item.pnl_pct != null && item.pnl_pct !== 0
    ? sellPrice / (1 + item.pnl_pct)
    : (item.buy_context?.buy_price ?? sellPrice)

  let status: TradeReview['status'] = 'LOGICAL_CONSISTENCY'
  if (item.consistency_flag !== 'NORMAL') {
    status = pnlPct > 0 ? 'LUCKY_PROFIT' : 'EMOTIONAL_OPERATION'
  }

  const sellDate = item.traded_at ? item.traded_at.split('T')[0] : ''
  const buyDate  = item.buy_context?.buy_date ?? '—'

  return {
    id:               String(item.id),
    trade_log_id:     String(item.trade_log_id),
    stock_name:       item.stock_name || item.stock_code,
    stock_code:       item.stock_code,
    buy_date:         buyDate,
    buy_price:        parseFloat(buyPrice.toFixed(2)),
    sell_date:        sellDate,
    sell_price:       sellPrice,
    sell_reason:      item.sell_reason || '',
    buy_reason:       item.buy_reason || '',
    price_5d_after:   item.price_5d_after ?? sellPrice,
    pnl_percent:      parseFloat(pnlPct.toFixed(2)),
    pnl_amount:       0,
    regret_index:     parseFloat(((item.regret_index ?? 0) * 100).toFixed(2)),
    execution_score:  item.execution_score ?? 0,
    status,
    is_disciplined:   item.consistency_flag === 'NORMAL',
    ai_audit_comment: item.ai_audit_comment || '',
    mental_state:     item.mental_state || '',
    buy_context:      item.buy_context,
    consistency_flag: item.consistency_flag,
    consistency_note: item.consistency_note,
  }
}
