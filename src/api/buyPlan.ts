import http from './http'
import type { ApiResponse, ListResponse } from '@/types'
import type { BuyPlan, CreateBuyPlanRequest, UpdateBuyPlanRequest, BuyPlanStatus } from '@/types/buy_plan'

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
