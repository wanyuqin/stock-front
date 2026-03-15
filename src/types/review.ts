
export interface ReviewStats {
  consistency_rate: number; // 0-100
  avg_regret_percent: number; // Percentage
  avg_execution_score: number; // 0-100
}

export interface ScatterPoint {
  sentiment_score: number; // 0-100 (e.g., 0 = Calm, 100 = Panic/Greed)
  pnl_percent: number; // Profit/Loss percentage
  id: string; // Trade ID
  is_consistent: boolean; // Color coding
}

export type ReviewStatus = 'LOGICAL_CONSISTENCY' | 'EMOTIONAL_OPERATION' | 'LUCKY_PROFIT';

export interface TradeReview {
  id: string;
  trade_log_id: string; // Add trade_log_id for submission
  stock_name: string;
  stock_code: string;
  buy_date: string;
  buy_price: number;
  sell_date: string;
  sell_price: number;
  sell_reason: string;
  price_5d_after: number; // Ghost Price
  pnl_percent: number;
  pnl_amount: number;
  regret_index: number; // Percentage difference between sell price and 5d high
  execution_score: number;
  status: ReviewStatus;
  is_disciplined: boolean; // "Discipline Reward" badge
  ai_audit?: AiAudit;
}

export interface AiAudit {
  trade_id: string;
  kline_data: { date: string; open: number; close: number; high: number; low: number }[]; // Mini K-line data
  comment: string; // "Toxic" comment
}

export interface ImprovementPlan {
  trade_id: string;
  content: string;
  created_at: string;
}
