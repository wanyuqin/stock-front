import http from './http'
import type { ApiResponse, StockReport, StockReportListResponse, ReportSyncResult } from '@/types'

// ── 分页查询研报 ──────────────────────────────────────────────────
export interface FetchReportsParams {
  page?: number
  limit?: number
  stock_code?: string
}

export function fetchReports(params: FetchReportsParams = {}) {
  return http.get<ApiResponse<StockReportListResponse>>('/reports/intel', {
    params: {
      page:       params.page       ?? 1,
      limit:      params.limit      ?? 20,
      stock_code: params.stock_code ?? undefined,
    },
  })
}

// ── 手动触发同步 ──────────────────────────────────────────────────
export function syncReports(days = 3) {
  return http.post<ApiResponse<ReportSyncResult>>('/reports/intel/sync', null, {
    params: { days },
  })
}

// ── 手动触发 AI 摘要批处理 ────────────────────────────────────────
export function processAISummaries() {
  return http.post<ApiResponse<{ processed: number; message: string }>>('/reports/intel/ai')
}

// ── 获取单页（用于轮询新数量） ─────────────────────────────────────
export function fetchReportCount(stockCode?: string) {
  return http.get<ApiResponse<StockReportListResponse>>('/reports/intel', {
    params: { page: 1, limit: 1, stock_code: stockCode },
  })
}

export type { StockReport }
