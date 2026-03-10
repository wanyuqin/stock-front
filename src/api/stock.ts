import http from './http'
import type {
  ApiResponse, ListResponse,
  Quote, Stock, WatchlistItem,
  KLineResponse, AnalysisResult,
} from '@/types'

// ── 股票 ──────────────────────────────────────────────────────────

export const fetchStocks = (limit = 50, offset = 0) =>
  http.get<ApiResponse<ListResponse<Stock>>>('/stocks', { params: { limit, offset } })

export const fetchStockByCode = (code: string) =>
  http.get<ApiResponse<Stock>>(`/stocks/${code}`)

export const fetchQuote = (code: string) =>
  http.get<ApiResponse<Quote>>(`/stocks/${code}/quote`)

/** 获取日 K 线数据（前复权）*/
export const fetchKLine = (code: string, limit = 120) =>
  http.get<ApiResponse<KLineResponse>>(`/stocks/${code}/kline`, { params: { limit } })

/** 获取 AI 分析报告（30 分钟缓存）*/
export const fetchAnalysis = (code: string) =>
  http.get<ApiResponse<AnalysisResult>>(`/stocks/${code}/analysis`)

// ── 自选股 ────────────────────────────────────────────────────────

export const fetchWatchlist = () =>
  http.get<ApiResponse<ListResponse<WatchlistItem>>>('/watchlist')

export const addToWatchlist = (stockCode: string, note = '') =>
  http.post<ApiResponse<WatchlistItem>>('/watchlist', { stock_code: stockCode, note })

export const removeFromWatchlist = (code: string) =>
  http.delete<ApiResponse<{ removed: string }>>(`/watchlist/${code}`)

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
  content:      string      // Markdown 全文
  market_mood:  string      // 贪婪 / 中性 / 恐惧
  scan_count:   number
  scans:        DailyScanItem[]
  from_cache:   boolean
  generated_at: string
}

/**
 * 获取每日复盘简报。
 * @param date       日期 YYYY-MM-DD，不传默认今日
 * @param force      true = 忽略缓存强制重新生成（仅今日有效）
 */
export const fetchDailyReport = (date?: string, force = false) => {
  const params: Record<string, string> = {}
  if (date)  params.date  = date
  if (force) params.force = '1'
  return http.get<ApiResponse<DailyReportDTO>>('/reports/daily', { params })
}

/** 手动触发生成今日复盘简报（POST）*/
export const generateDailyReport = () =>
  http.post<ApiResponse<DailyReportDTO>>('/reports/daily/generate', {})
