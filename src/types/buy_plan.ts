// ── 买入计划 ──────────────────────────────────────────────────────

export type BuyPlanStatus = 'WATCHING' | 'READY' | 'EXECUTED' | 'ABANDONED' | 'EXPIRED'

export interface TriggerConditions {
  price_below?: number       // 价格跌至 X 以下触发
  price_above?: number       // 价格涨至 X 以上触发（突破）
  break_ma20?: boolean       // 放量突破 MA20
  hold_ma20?: boolean        // 回踩 MA20 不破
  near_support?: boolean     // 靠近支撑位
  main_inflow_pct?: number   // 主力净流入占比 >= X%
  custom_note?: string       // 自定义条件描述
}

export interface BuyPlan {
  id: number
  user_id: number
  stock_code: string
  stock_name: string

  // 价格计划
  buy_price: number | null
  buy_price_high: number | null
  target_price: number | null
  stop_loss_price: number | null

  // 仓位计划
  planned_volume: number
  planned_amount: number | null
  position_ratio: number | null
  buy_batches: number

  // 策略
  reason: string
  catalyst: string
  trigger_conditions: TriggerConditions

  // 测算
  expected_return_pct: number | null
  risk_reward_ratio: number | null

  // 有效期 & 状态
  valid_until: string | null
  status: BuyPlanStatus
  executed_at: string | null
  trade_log_id: number | null

  created_at: string
  updated_at: string

  // 运行时扩展（后端实时填充）
  current_price?: number
  dist_to_buy_pct?: number
  dist_to_target_pct?: number
  trigger_hit: boolean
  rr_calc?: number
}

export interface CreateBuyPlanRequest {
  stock_code: string
  buy_price?: number
  buy_price_high?: number
  target_price?: number
  stop_loss_price?: number
  planned_volume?: number
  planned_amount?: number
  position_ratio?: number
  buy_batches?: number
  reason?: string
  catalyst?: string
  trigger_conditions?: TriggerConditions
  valid_until?: string   // YYYY-MM-DD
}

export interface UpdateBuyPlanRequest {
  buy_price?: number
  buy_price_high?: number
  target_price?: number
  stop_loss_price?: number
  planned_volume?: number
  planned_amount?: number
  position_ratio?: number
  buy_batches?: number
  reason?: string
  catalyst?: string
  trigger_conditions?: TriggerConditions
  status?: BuyPlanStatus
  valid_until?: string
}
