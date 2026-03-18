export interface ReviewStats {
  consistency_rate: number;   // 0-100
  avg_regret_percent: number; // 百分比
  avg_execution_score: number; // 0-100
}

export interface ScatterPoint {
  sentiment_score: number;  // 0-100 (0=冷静, 100=失控)
  pnl_percent: number;
  id: string;
  is_consistent: boolean;
}

export type ReviewStatus = 'LOGICAL_CONSISTENCY' | 'EMOTIONAL_OPERATION' | 'LUCKY_PROFIT';

export interface TradeReview {
  id: string;
  trade_log_id: string;
  stock_name: string;
  stock_code: string;
  buy_date: string;
  buy_price: number;
  buy_reason: string;
  sell_date: string;
  sell_price: number;
  sell_reason: string;
  price_5d_after: number;
  pnl_percent: number;
  pnl_amount: number;
  regret_index: number;
  execution_score: number;
  status: ReviewStatus;
  is_disciplined: boolean;
  // AI 审计字段
  ai_audit_comment: string; // 已生成时非空
  mental_state: string;
}

export interface AiAudit {
  trade_id: string;
  kline_data: { date: string; open: number; close: number; high: number; low: number }[];
  comment: string;
  is_generating?: boolean; // true = AI 正在后台生成
}

export interface ImprovementPlan {
  trade_id: string;
  content: string;
  created_at: string;
}
