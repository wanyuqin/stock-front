export interface ReviewStats {
  consistency_rate:    number
  avg_regret_percent:  number
  avg_execution_score: number
}

export interface ScatterPoint {
  sentiment_score: number
  pnl_percent:     number
  id:              string
  is_consistent:   boolean
}

export type ReviewStatus = 'LOGICAL_CONSISTENCY' | 'EMOTIONAL_OPERATION' | 'LUCKY_PROFIT'

// ── 买入价格行为上下文（后端量化计算，不依赖理由文字）────────────

export interface BuyContext {
  // 核心量化指标
  buy_position_in_day_range: number  // 0=最低 1=最高，>0.75 = 追高区
  ma20_deviation_pct:        number  // 相对 MA20 的偏离度（%），>+8 = 追高
  volume_ratio_vs_5d:        number  // 当日量/5日均量，>1.5 = 放量
  ma20_uptrend:              boolean
  ma5_uptrend:               boolean

  // 买入前涨幅背景
  prior_3d_gain_pct:  number
  prior_5d_gain_pct:  number
  prior_10d_gain_pct: number

  // 当日特征
  day_amplitude_pct: number
  day_change_pct:    number

  // 行为判断标签（系统自动）
  is_chasing_high:    boolean
  is_bottom_fishing:  boolean
  is_volume_breakout: boolean
  is_trend_aligned:   boolean
  buy_label:          string

  // 参考数据点
  buy_date:   string
  buy_price:  number
  day_open:   number
  day_high:   number
  day_low:    number
  day_close:  number
  ma5:        number
  ma20:       number
  avg_vol_5d: number
  day_volume: number

  // 置信度
  data_sufficient: boolean
  analyzed_at:     string
}

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
  buy_context?:     BuyContext | null   // ← 新增
  consistency_flag?: string             // ← 新增，用于展示原始标志
  consistency_note?: string             // ← 新增
}

export interface AiAudit {
  trade_id:   string
  kline_data: { date: string; open: number; close: number; high: number; low: number }[]
  comment:    string
  is_generating?: boolean
}

export interface ImprovementPlan {
  trade_id:   string
  content:    string
  created_at: string
}

export interface BehaviorStat {
  flag:      string
  count:     number
  avg_pnl:   number
  win_rate:  number
  total_pnl: number
}
