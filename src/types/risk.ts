export interface RiskProfile {
  id: number
  user_id: number
  risk_per_trade_pct: number
  max_position_pct: number
  account_size: number
  created_at: string
  updated_at: string
}

export interface UpdateRiskProfileRequest {
  risk_per_trade_pct: number
  max_position_pct: number
  account_size: number
}

export interface TradePrecheckRequest {
  stock_code: string
  buy_price: number
  stop_loss_price: number
  target_price?: number
  planned_amount: number
  reason: string
}

export interface TradePrecheckChecklist {
  has_stop_loss: boolean
  has_target_price: boolean
  has_risk_budget: boolean
  has_reason: boolean
  position_in_bounds: boolean
  can_open_new_position: boolean
  failure: string
}

export interface DailyRiskState {
  status: 'SAFE' | 'WARN' | 'BLOCK'
  today_realized_pnl: number
  daily_loss_amount: number
  daily_loss_pct: number
  loss_limit_pct: number
  loss_limit_amount: number
  remaining_loss_amount: number
  can_open_new_position: boolean
  message: string
}

export interface TradePrecheckResult {
  pass: boolean
  checklist: TradePrecheckChecklist
  estimated_volume: number
  estimated_position_pct: number
  worst_loss_amount: number
  worst_loss_pct: number
  allowed_loss_amount: number
  max_position_amount: number
  max_position_volume: number
  suggested_adjust_volume: number
  suggested_adjust_amount: number
  daily_risk_state: DailyRiskState
  advice: string
}

export interface PositionSizeSuggestion {
  buy_price: number
  stop_loss_price: number
  risk_per_share: number
  allowed_loss_amount: number
  raw_suggested_volume: number
  suggested_volume: number
  suggested_amount: number
  suggested_position_pct: number
  max_position_amount: number
  max_position_volume: number
  advice: string
}

export interface SectorExposureItem {
  sector: string
  exposure_amount: number
  exposure_pct: number
  position_count: number
  stock_codes: string[]
  over_limit: boolean
}

export interface PortfolioExposureResult {
  total_exposure_amount: number
  sector_limit_pct: number
  has_over_limit: boolean
  items: SectorExposureItem[]
}

export interface RiskEventItem {
  date: string
  stock_code: string
  stock_name: string
  event_type: 'DIVIDEND_EX_DATE' | 'RESEARCH_REPORT' | string
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | string
  title: string
  action_hint: string
  source: string
}

export interface EventCalendarResult {
  from_date: string
  to_date: string
  days: number
  high_count: number
  medium_count: number
  low_count: number
  items: RiskEventItem[]
}

export interface TodayRiskTodoItem {
  id: string
  date: string
  stock_code: string
  stock_name: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string
  title: string
  action_hint: string
  event_type: string
  done: boolean
}

export interface TodayRiskTodoResult {
  date: string
  total: number
  high_count: number
  medium_count: number
  done_count: number
  pending: number
  items: TodayRiskTodoItem[]
}

export interface UpdateTodayRiskTodoStatusRequest {
  todo_date?: string
  todo_id: string
  done: boolean
}
