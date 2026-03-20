import http from './http'
import type { ApiResponse } from '@/types'
import type {
  RiskProfile,
  UpdateRiskProfileRequest,
  TradePrecheckRequest,
  TradePrecheckResult,
  PositionSizeSuggestion,
  PortfolioExposureResult,
  DailyRiskState,
  EventCalendarResult,
  TodayRiskTodoResult,
  UpdateTodayRiskTodoStatusRequest,
  GenerateLowHealthTodoRequest,
  GenerateLowHealthTodoResult,
  HealthTrendResult,
  WeeklyReviewResult,
} from '@/types/risk'

export const fetchRiskProfile = () =>
  http.get<ApiResponse<RiskProfile>>('/risk/profile')

export const updateRiskProfile = (req: UpdateRiskProfileRequest) =>
  http.put<ApiResponse<RiskProfile>>('/risk/profile', req)

export const precheckTrade = (req: TradePrecheckRequest) =>
  http.post<ApiResponse<TradePrecheckResult>>('/trade/precheck', req)

export const fetchPositionSizeSuggestion = (buyPrice: number, stopLossPrice: number) =>
  http.get<ApiResponse<PositionSizeSuggestion>>('/risk/position-size', {
    params: { buy_price: buyPrice, stop_loss_price: stopLossPrice },
  })

export const fetchPortfolioExposure = () =>
  http.get<ApiResponse<PortfolioExposureResult>>('/risk/portfolio-exposure')

export const fetchDailyRiskState = () =>
  http.get<ApiResponse<DailyRiskState>>('/risk/daily-state')

export const fetchEventCalendar = (days = 7) =>
  http.get<ApiResponse<EventCalendarResult>>('/risk/event-calendar', { params: { days } })

export const fetchTodayRiskTodo = () =>
  http.get<ApiResponse<TodayRiskTodoResult>>('/risk/today-todo')

export const updateTodayRiskTodoStatus = (req: UpdateTodayRiskTodoStatusRequest) =>
  http.put<ApiResponse<{ success: boolean }>>('/risk/today-todo/status', req)

export const generateLowHealthTodo = (req: GenerateLowHealthTodoRequest = {}) =>
  http.post<ApiResponse<GenerateLowHealthTodoResult>>('/risk/today-todo/generate-low-health', req)

export const fetchWeeklyReview = (days = 7) =>
  http.get<ApiResponse<WeeklyReviewResult>>('/risk/weekly-review', { params: { days } })

export const fetchHealthTrend = (days = 7) =>
  http.get<ApiResponse<HealthTrendResult>>('/risk/health-trend', { params: { days } })
