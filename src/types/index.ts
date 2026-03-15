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

/** 信号类型 */
export type SignalType = 'HOLD' | 'SELL' | 'BUY_T' | 'SELL_T' | 'STOP_LOSS'

/** JSONB 诊断快照 */
export interface DiagnosticSnapshot {
  price: number
  avg_cost: number
  pnl_pct: number          // 含手续费盈亏（小数，如 -0.05 = -5%）
  atr: number
  ma20: number
  ma20_slope: number       // 正=上行，负=下行
  support: number
  resistance: number
  hard_stop_loss: number   // cost - 2×ATR
  amplitude: number        // 今日振幅（小数）
  can_do_t: boolean
  reasons: string[]
}

/** 持仓明细（对应 position_details 表） */
export interface PositionDetail {
  id: number
  stock_code: string
  avg_cost: number
  quantity: number
  available_qty: number
  hard_stop_loss: number | null
  updated_at: string
}

/** 单只持仓诊断结果 */
export interface PositionDiagnosisResult {
  stock_code: string
  stock_name: string
  signal: SignalType
  /** 定时刷新时为空字符串；手动触发 AI 分析后才有值 */
  action_directive: string
  snapshot: DiagnosticSnapshot
  position: PositionDetail
  updated_at: string
}

/** GET /api/v1/positions/diagnose 返回体 */
export interface DiagnoseResponse {
  count: number
  items: PositionDiagnosisResult[]
}

/** POST /api/v1/positions/analyze/:code 返回体（手动触发AI分析） */
export interface PositionAIResult {
  stock_code: string
  stock_name: string
  /** Markdown 格式的 AI 深度分析报告 */
  action_directive: string
  generated_at: string
}

/** POST /api/v1/positions/sync 请求体 */
export interface SyncPositionRequest {
  stock_code: string
  avg_cost: number
  quantity: number
  available_qty?: number
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
