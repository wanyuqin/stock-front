export interface ReviewStats {
  consistency_rate:    number  // 0-100
  avg_regret_percent:  number  // 百分比
  avg_execution_score: number  // 0-100
}

export interface ScatterPoint {
  sentiment_score: number   // 0-100 (0=冷静, 100=失控)
  pnl_percent:     number
  id:              string
  is_consistent:   boolean
}

export type ReviewStatus = 'LOGICAL_CONSISTENCY' | 'EMOTIONAL_OPERATION' | 'LUCKY_PROFIT'

export interface TradeReview {
  id:               string
  trade_log_id:     string
  stock_name:       string
  stock_code:       string
  buy_date:         string
  buy_price:        number
  buy_reason:       string
  sell_date:        string
  sell_price:       number
  sell_reason:      string
  price_5d_after:   number
  pnl_percent:      number
  pnl_amount:       number
  regret_index:     number
  execution_score:  number
  status:           ReviewStatus
  is_disciplined:   boolean
  ai_audit_comment: string
  mental_state:     string
}

export interface AiAudit {
  trade_id:  string
  kline_data: { date: string; open: number; close: number; high: number; low: number }[]
  comment:   string
  is_generating?: boolean
}

export interface ImprovementPlan {
  trade_id:   string
  content:    string
  created_at: string
}

// ── 行为归因统计类型 ──────────────────────────────────────────────

export interface BehaviorStat {
  flag:      string   // NORMAL | PANIC_SELL | CHASING_HIGH | LOGIC_CONFLICT | PREMATURE_EXIT
  count:     number
  avg_pnl:   number   // 百分比，已乘100
  win_rate:  number   // 0-100
  total_pnl: number   // 百分比累计
}
