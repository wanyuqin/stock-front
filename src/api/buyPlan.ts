import http from './http'
import type { ApiResponse, ListResponse } from '@/types'
import type { BuyPlan, CreateBuyPlanRequest, UpdateBuyPlanRequest, BuyPlanStatus } from '@/types/buy_plan'

export interface SmartPlanBacktestRequest {
  stock_code: string
  buy_price: number
  buy_price_high: number
  stop_loss: number
  target_price: number
  lookahead_days?: number
  sample_days?: number
}

export interface SmartPlanBacktestResult {
  stock_code: string
  sample_days: number
  lookahead_days: number
  total_samples: number
  triggered_samples: number
  win_samples: number
  loss_samples: number
  timeout_samples: number
  trigger_rate_pct: number
  win_rate_pct: number
  avg_return_pct: number
  median_return_pct: number
  avg_hold_days: number
  profit_factor: number
}

export const fetchBuyPlans = (status = 'active') =>
  http.get<ApiResponse<ListResponse<BuyPlan>>>('/buy-plans', { params: { status } })

export const fetchBuyPlansByCode = (code: string) =>
  http.get<ApiResponse<ListResponse<BuyPlan>>>(`/stocks/${code}/buy-plans`)

export const createBuyPlan = (req: CreateBuyPlanRequest) =>
  http.post<ApiResponse<BuyPlan>>('/buy-plans', req)

export const updateBuyPlan = (id: number, req: UpdateBuyPlanRequest) =>
  http.put<ApiResponse<BuyPlan>>(`/buy-plans/${id}`, req)

/**
 * updateBuyPlanStatus — 更新计划状态
 * @param tradeLogId 可选，标记为 EXECUTED 时传入，自动关联交易记录形成闭环
 */
export const updateBuyPlanStatus = (id: number, status: BuyPlanStatus, tradeLogId?: number) =>
  http.patch<ApiResponse<{ updated: number; status: string }>>(
    `/buy-plans/${id}/status`,
    { status, ...(tradeLogId ? { trade_log_id: tradeLogId } : {}) },
  )

export const deleteBuyPlan = (id: number) =>
  http.delete<ApiResponse<{ deleted: number }>>(`/buy-plans/${id}`)

export const checkBuyPlanTriggers = () =>
  http.post<ApiResponse<{ triggered: number; items: BuyPlan[] }>>('/buy-plans/check-triggers', {})

export const backtestSmartPlan = (req: SmartPlanBacktestRequest) =>
  http.post<ApiResponse<SmartPlanBacktestResult>>('/buy-plans/backtest', req)
