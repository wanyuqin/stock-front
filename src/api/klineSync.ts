import http from './http'
import type { ApiResponse } from '@/types'

// ── 类型定义 ─────────────────────────────────────────────────────

export type KlineSyncState = 'idle' | 'running' | 'done' | 'error'

export interface KlineSyncStatus {
  code:           string
  stock_name:     string
  earliest_date:  string | null   // "2001-08-27"
  latest_date:    string | null
  total_bars:     number
  sync_state:     KlineSyncState
  last_error?:    string
  last_synced_at: string | null
}

export interface KlineBar {
  code:        string
  trade_date:  string   // "2026-03-20"
  open:        number
  close:       number
  high:        number
  low:         number
  volume:      number
  amount:      number
}

export interface KlineLocalResult {
  code:  string
  count: number
  bars:  KlineBar[]
}

export interface SyncedStocksResult {
  total: number
  items: KlineSyncStatus[]
}

// ── API 函数 ──────────────────────────────────────────────────────

/** 触发全量历史同步（202 Accepted，异步执行） */
export const startKlineSync = (code: string) =>
  http.post<ApiResponse<{ code: string; state: KlineSyncState }>>
    (`/stocks/${code}/kline/sync`)

/** 查询同步进度（轮询用） */
export const getKlineSyncStatus = (code: string) =>
  http.get<ApiResponse<KlineSyncStatus>>(`/stocks/${code}/kline/sync-status`)

/**
 * 读本地 K 线数据
 * 优先数据库，本地无数据时回退到接口实时拉取
 */
export const getLocalKline = (
  code: string,
  params: { limit?: number; from?: string; to?: string } = {}
) =>
  http.get<ApiResponse<KlineLocalResult>>(`/stocks/${code}/kline/local`, { params })

/** 删除本地数据并重置状态（用于重新全量同步） */
export const deleteKlineSync = (code: string) =>
  http.delete<ApiResponse<{ message: string }>>(`/stocks/${code}/kline/sync`)

/** 列出所有已同步股票及状态 */
export const listSyncedStocks = () =>
  http.get<ApiResponse<SyncedStocksResult>>('/kline/synced-stocks')
