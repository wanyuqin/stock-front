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
