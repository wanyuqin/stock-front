// ── 统一数据类型定义，与后端 model 保持一致 ──────────────────────

export interface Stock {
  id: number
  code: string
  name: string
  market: 'SH' | 'SZ'
  sector: string
  created_at: string
  updated_at: string
}

export interface Quote {
  code: string
  name: string
  market: 'SH' | 'SZ'
  price: number
  open: number
  close: number       // 昨收
  high: number
  low: number
  volume: number      // 成交量（手）
  amount: number      // 成交额（元）
  change: number
  change_rate: number // 涨跌幅（%）
  turnover: number    // 换手率（%）
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

// ── 交易日志（对应后端 TradeLogVO）────────────────────────────────

export interface TradeLog {
  id: number
  user_id?: number
  stock_code: string
  action: 'BUY' | 'SELL'
  price: number
  volume: number
  amount: number      // price × volume，由后端计算
  traded_at: string
  reason: string
  created_at: string
}

export interface AddTradeRequest {
  stock_code: string
  action: 'BUY' | 'SELL'
  price: number
  volume: number
  traded_at?: string  // YYYY-MM-DD，可选
  reason?: string
}

export interface TradeListResponse {
  stock_code: string
  items: TradeLog[]
  count: number
}

// ── 盈亏报告（对应后端 PerformanceReport）────────────────────────

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
