import http, { AI_TIMEOUT } from './http'
import type {
  ApiResponse, ListResponse,
  Quote, Stock, WatchlistItem,
  KLineResponse, AnalysisResult,
  Alert, MoneyFlowLog,
  ScreenerResult, ScreenerStatus,
  DiagnoseResponse, PositionDetail, SyncPositionRequest,
  PositionAIResult,
  StockValuation, ValuationSummary,
} from '@/types'

// ── 股票 ──────────────────────────────────────────────────────────

export const fetchStocks = (limit = 50, offset = 0) =>
  http.get<ApiResponse<ListResponse<Stock>>>('/stocks', { params: { limit, offset } })

export const fetchStockByCode = (code: string) =>
  http.get<ApiResponse<Stock>>(`/stocks/${code}`)

export const fetchQuote = (code: string) =>
  http.get<ApiResponse<Quote>>(`/stocks/${code}/quote`)

export const fetchKLine = (code: string, limit = 120, source: 'em' | 'qq' = 'em') =>
  http.get<ApiResponse<KLineResponse>>(`/stocks/${code}/kline`, { params: { limit, source } })

export const fetchMinute = (code: string, days = 1) =>
  http.get<ApiResponse<import('@/types').MinuteResponse>>(`/stocks/${code}/minute`, { params: { days } })

export const fetchAnalysis = (code: string) =>
  http.get<ApiResponse<AnalysisResult>>(`/stocks/${code}/analysis`, {
    timeout: AI_TIMEOUT,
  })

// ── 自选股 ────────────────────────────────────────────────────────

export const fetchWatchlist = () =>
  http.get<ApiResponse<ListResponse<WatchlistItem>>>('/watchlist')

export const addToWatchlist = (stockCode: string, note = '') =>
  http.post<ApiResponse<WatchlistItem>>('/watchlist', { stock_code: stockCode, note })

export const removeFromWatchlist = (code: string) =>
  http.delete<ApiResponse<{ removed: string }>>(`/watchlist/${code}`)

// ── 交易日志 ──────────────────────────────────────────────────────

export const addTrade = (body: import('@/types').AddTradeRequest) =>
  http.post<ApiResponse<import('@/types').TradeLog>>('/trades', body)

// ── 每日复盘简报 ──────────────────────────────────────────────────

export interface DailyScanItem {
  id:           number
  scan_date:    string
  stock_code:   string
  stock_name:   string
  signals:      string[]
  price:        number
  pct_chg:      number
  volume_ratio: number
  ma_status:    string
  created_at:   string
}

export interface DailyReportDTO {
  date:         string
  content:      string
  market_mood:  string
  scan_count:   number
  scans:        DailyScanItem[]
  from_cache:   boolean
  generated_at: string
}

export const fetchDailyReport = (date?: string, force = false) => {
  const params: Record<string, string> = {}
  if (date)  params.date  = date
  if (force) params.force = '1'
  return http.get<ApiResponse<DailyReportDTO>>('/reports/daily', { params })
}

export const generateDailyReport = () =>
  http.post<ApiResponse<DailyReportDTO>>('/reports/daily/generate', {}, {
    timeout: AI_TIMEOUT,
  })

// ── 异动告警 ──────────────────────────────────────────────────────

export const fetchAlerts = (limit = 50, unreadOnly = false) =>
  http.get<ApiResponse<{ count: number; items: Alert[] }>>('/alerts', {
    params: { limit, unread_only: unreadOnly ? 'true' : 'false' },
  })

export const markAlertsRead = (ids: number[]) =>
  http.post<ApiResponse<{ marked: number }>>('/alerts/read', { ids })

// ── 资金流向 ──────────────────────────────────────────────────────

export const fetchMoneyFlow = (code: string, limit = 20) =>
  http.get<ApiResponse<{ code: string; count: number; items: MoneyFlowLog[] }>>(
    `/stocks/${code}/money-flow`,
    { params: { limit } },
  )

export const refreshMoneyFlow = (code: string) =>
  http.post<ApiResponse<Record<string, string | number>>>(
    `/stocks/${code}/money-flow/refresh`,
    {},
  )

// ── 量化筛选器 ────────────────────────────────────────────────────

export interface ScreenerExecuteRequest {
  min_score?: number
  limit?:     number
  date?:      string
}

export interface SyncResult {
  synced:      number
  non_trading: boolean
  notice:      string
}

export const executeScreener = (req: ScreenerExecuteRequest = {}) =>
  http.post<ApiResponse<ScreenerResult>>('/screener/execute', req)

export const syncMarketData = () =>
  http.post<ApiResponse<SyncResult>>('/screener/sync', {}, {
    timeout: AI_TIMEOUT,
  })

export const fetchScreenerStatus = () =>
  http.get<ApiResponse<ScreenerStatus>>('/screener/status')

// ── 持仓守护 ─────────────────────────────────────────────────────

export const fetchPositionDiagnosis = () =>
  http.get<ApiResponse<DiagnoseResponse>>('/positions/diagnose')

export const analyzePosition = (code: string) =>
  http.post<ApiResponse<PositionAIResult>>(`/positions/analyze/${code}`, {}, {
    timeout: AI_TIMEOUT,
  })

export const syncPosition = (req: SyncPositionRequest) =>
  http.post<ApiResponse<PositionDetail>>('/positions/sync', req)

// ── 全市场宏观监控 ────────────────────────────────────────────────

export interface MarketSummary {
  sentiment_score: number
  total_amount: number
  alert_status: 'SAFE' | 'WARNING' | 'DANGER'
  daily_summary: string
  up_count: number
  down_count: number
}

export const fetchMarketSummary = () =>
  http.get<ApiResponse<MarketSummary>>('/market/summary')

// ── 估值分位 ──────────────────────────────────────────────────────

export const fetchValuation = (code: string) =>
  http.get<ApiResponse<StockValuation>>(`/stocks/${code}/valuation`)

export const fetchValuationSummary = () =>
  http.get<ApiResponse<ValuationSummary>>('/market/valuation-summary')

export const triggerValuationSync = () =>
  http.post<ApiResponse<{ total: number; success: number; failed: number; message: string }>>(
    '/market/valuation-sync',
    {},
  )

// ── 大单分析 ────────────────────────────────────────────────

// 按需拉取，失警频率不要超过 1次/30s
export const fetchBigDeal = (code: string, changeRate?: number) =>
  http.get<ApiResponse<import('@/types').BigDealSummary>>(
    `/stocks/${code}/big-deal`,
    changeRate !== undefined ? { params: { change_rate: changeRate } } : {},
  )

export const backfillValuationHistory = (days = 90) =>
  http.post<ApiResponse<{ days: number; total: number; success: number; failed: number; message: string }>>(
    `/market/valuation-backfill?days=${days}`,
    {},
  )
