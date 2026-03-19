// ── 统一数据类型定义，与后端 model 保持一致 ──────────────────────

export interface Stock {
  id: number
  code: string
  name: string
  market: 'SH' | 'SZ'
  sector: string
  latest_money_flow: number | null
  created_at: string
  updated_at: string
}

export interface Quote {
  code: string
  name: string
  market: 'SH' | 'SZ'
  price: number
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
  change: number
  change_rate: number
  turnover: number
  volume_ratio: number
  updated_at: string
  from_cache: boolean
}

export interface WatchlistItem {
  id: number
  stock_code: string
  note: string
  created_at: string
  quote: Quote | null
}

// ── 交易日志 ──────────────────────────────────────────────────────

export interface TradeLog {
  id: number
  user_id?: number
  stock_code: string
  action: 'BUY' | 'SELL'
  price: number
  volume: number
  amount: number
  traded_at: string
  reason: string
  created_at: string
}

export interface AddTradeRequest {
  stock_code: string
  action: 'BUY' | 'SELL'
  price: number
  volume: number
  traded_at?: string
  reason?: string
}

export interface TradeListResponse {
  stock_code: string
  items: TradeLog[]
  count: number
}

// ── 盈亏报告 ──────────────────────────────────────────────────────

export interface PositionItem {
  stock_code: string
  volume: number
  avg_cost: number
  current_price: number
  market_value: number
  float_pnl: number
  float_pnl_pct: number
}

export interface ClosedPnLItem {
  stock_code: string
  realized_pnl: number
  total_buy: number
  total_sell: number
}

export interface PerformanceReport {
  realized_pnl: number
  float_pnl: number
  total_pnl: number
  total_cost: number
  total_pnl_pct: number
  positions: PositionItem[]
  closed_items: ClosedPnLItem[]
}

// ── K 线数据 ──────────────────────────────────────────────────────

export interface KLine {
  date: string
  open: number
  close: number
  low: number
  high: number
  volume: number
  amount: number
}

export interface KLineResponse {
  code: string
  name: string
  period: string
  klines: KLine[]
  dates: string[]
  ohlc_data: [number, number, number, number][]
  volume_data: [number, number, number][]
}

// ── AI 分析 ───────────────────────────────────────────────────────

export interface AnalysisResult {
  code: string
  name: string
  report: string
  model: string
  from_cache: boolean
  created_at: string
}

// ── 资金流向 ──────────────────────────────────────────────────────

export interface MoneyFlowLog {
  id: number
  stock_code: string
  date: string
  main_net_inflow: number
  super_large_inflow: number
  large_inflow: number
  medium_inflow: number
  small_inflow: number
  main_inflow_pct: number
  pct_chg: number
  volume: number
  created_at: string
}

// ── 异动告警 ──────────────────────────────────────────────────────

export interface Alert {
  id: number
  stock_code: string
  stock_name: string
  alert_type: string
  main_net_inflow: number
  delta: number
  pct_chg: number
  message: string
  is_read: boolean
  triggered_at: string
  created_at: string
}

// ── 量化筛选器 ────────────────────────────────────────────────────

export interface ScoredStock {
  code: string
  name: string
  score: number
  tags: string[]
  price: number
  pct_chg: number
  vol_ratio: number
  main_inflow_pct: number
  main_inflow: number
  is_multi_aligned: boolean
}

export interface ScreenerResult {
  date: string
  total: number
  matched: number
  items: ScoredStock[]
  elapsed_ms: number
}

export interface ScreenerStatus {
  date: string
  total: number
  ready: boolean
}

// ── 持仓守护 ─────────────────────────────────────────────────────

export type SignalType = 'HOLD' | 'SELL' | 'BUY_T' | 'SELL_T' | 'STOP_LOSS'

export interface DiagnosticSnapshot {
  // ── 基础行情 ────────────────────────────────────────────────────
  price:         number
  avg_cost:      number
  pnl_pct:       number
  atr:           number
  ma20:          number
  ma20_slope:    number
  support:       number
  resistance:    number
  hard_stop_loss: number   // ATR 计算的系统止损位
  amplitude:     number
  can_do_t:      boolean
  reasons:       string[]

  // ── 买入计划继承字段 ─────────────────────────────────────────────
  plan_stop_loss:     number | null  // 你在买入计划中设定的止损价（优先使用）
  plan_target_price:  number | null  // 你在买入计划中设定的目标价
  plan_buy_reason:    string         // 计划里的买入理由

  // ── 持仓上下文 ────────────────────────────────────────────────
  hold_days:   number   // 持仓天数，-1=未知
  buy_reason:  string   // 手填买入理由

  // ── 一句话行动指令（面向小白）────────────────────────────────────
  action_summary:     string          // 如：继续持有，今天不操作
  stop_dist_pct:      number          // 距止损还有多少%（正数）
  target_dist_pct:    number | null   // 距目标还有多少%，null=无目标
  near_stop_warning:  boolean         // 距止损 < 2%
  near_target_notice: boolean         // 距目标 < 3%
  suggest_qty:        number          // 建议操作股数

  // ── 板块相关性 ────────────────────────────────────────────────
  sector_name:       string
  sector_sec_id:     string
  sector_5d_change:  number
  rel_strength_diff: number
  sector_warning:    string

  // ── MA20 压力位 ───────────────────────────────────────────────
  ma20_dist_pct:     number
  ma20_pressure_tip: string
}

// SectorInfo 板块实时强度对比
export interface SectorInfo {
  sector_code:           string
  sector_name:           string
  sector_change_percent: number
  relative_strength:     number
  rs_label:              string
  rs_level:              string
}

export interface PositionDetail {
  id:            number
  stock_code:    string
  avg_cost:      number
  quantity:      number
  available_qty: number
  hard_stop_loss: number | null
  // 买入上下文
  bought_at:   string | null   // ISO 时间
  buy_reason:  string
  // 关联买入计划
  linked_plan_id:    number | null
  plan_stop_loss:    number | null
  plan_target_price: number | null
  plan_buy_reason:   string
  updated_at:  string
}

export interface PositionDiagnosisResult {
  stock_code:       string
  stock_name:       string
  signal:           SignalType
  action_directive: string
  snapshot:         DiagnosticSnapshot
  sector_info:      SectorInfo | null
  position:         PositionDetail
  updated_at:       string
}

export interface DiagnoseResponse {
  count: number
  items: PositionDiagnosisResult[]
}

export interface PositionAIResult {
  stock_code:       string
  stock_name:       string
  action_directive: string
  generated_at:     string
}

export interface SyncPositionRequest {
  stock_code:    string
  avg_cost:      number
  quantity:      number
  available_qty?: number
  bought_at?:    string   // YYYY-MM-DD，留空=今天
  buy_reason?:   string   // 买入理由
}

// ── 研报情报站 ────────────────────────────────────────────────────

export interface StockReport {
  id: number
  info_code: string
  stock_code: string
  stock_name: string
  title: string
  org_name: string
  org_sname: string
  rating_name: string
  publish_date: string
  detail_url: string
  ai_summary: string
  is_processed: boolean
  created_at: string
}

export interface StockReportListResponse {
  total: number
  page: number
  limit: number
  items: StockReport[]
}

export interface ReportSyncResult {
  fetched: number
  filtered: number
  saved: number
  message: string
}

// ── 估值分位 ──────────────────────────────────────────────────────

export type ValuationStatus =
  | 'undervalued'
  | 'normal'
  | 'overvalued'
  | 'unknown'
  | 'loss'

export interface StockValuation {
  code: string
  name: string
  pe_ttm: number | null
  pb: number | null
  pe_percentile: number | null
  pb_percentile: number | null
  history_days: number
  status: ValuationStatus
  updated_at: string
}

export interface ValuationSummaryItem {
  code: string
  name: string
  pe_ttm: number | null
  pb: number | null
  pe_percentile: number | null
  pb_percentile: number | null
  history_days: number
  status: ValuationStatus
  updated_at: string
}

export interface ValuationSummary {
  total: number
  undervalued: number
  normal: number
  overvalued: number
  unknown: number
  items: ValuationSummaryItem[]
}

// ── 通用响应 ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface ListResponse<T> {
  items: T[]
  count: number
  limit?: number
  offset?: number
}

// ── 大单分析 ──────────────────────────────────────────────────────

export type TickSize = 'small' | 'medium' | 'large' | 'super'

export interface TickData {
  time:      string
  price:     number
  volume:    number
  amount:    number
  direction: 'B' | 'S'
  size:      TickSize
}

export interface TickSizeStat {
  count:       number
  buy_count:   number
  sell_count:  number
  buy_amount:  number
  sell_amount: number
  net_flow:    number
}

export interface BigDealSummary {
  date:                string
  time:                string
  desc:                string
  total_volume:        number
  ticks:               TickData[]
  main_buy_amount:     number
  main_sell_amount:    number
  main_net_flow:       number
  stats:               Record<TickSize, TickSizeStat>
  main_flow_pct:       number
  retail_flow_pct:     number
  main_avg_cost:       number
  main_avg_cost_desc:  string
  surge_signal:        boolean
  surge_multiplier:    number
  surge_desc:          string
  insight_desc:        string
  washing_signal:      boolean
  washing_signal_desc: string
}

// ── 分时数据（腾讯接口）────────────────────────────────────────────

export interface MinuteBar {
  time:       string
  price:      number
  volume:     number
  amount:     number
  avg_price:  number
  cum_volume: number
  cum_amount: number
}

export interface MinuteResponse {
  code:      string
  name:      string
  date:      string
  pre_close: number
  bars:      MinuteBar[]
  times:     string[]
  prices:    number[]
  volumes:   [number, number, number][]
  amounts:   number[]
}
