
import http from './http';
import { ReviewStats, TradeReview, AiAudit, ScatterPoint, ReviewStatus } from '../types/review';
import { KLineResponse, ApiResponse } from '../types';

// ── Types for Backend Response ──────────────────────────────────────

interface DashboardResponse {
  total_reviews: number;
  win_count: number;
  win_rate: number;
  logic_consistent_count: number;
  logic_consistency_rate: number;
  lucky_win_count: number;
  lucky_win_rate: number;
  avg_regret_index: number;
  max_regret_index: number;
  regret_count: number;
  regret_rate: number;
  avg_execution_score: number;
  last_review_at: string;
  mental_state_stats: {
    mental_state: string;
    count: number;
    avg_pnl_pct: number;
    win_rate: number;
  }[];
}

interface TradeReviewWithTrade {
  id: number;
  trade_log_id: number;
  stock_code: string;
  stock_name: string;
  mental_state: string;
  user_note: string;
  tags: string[];
  buy_reason: string;
  sell_reason: string;
  ai_audit_comment: string;
  execution_score: number | null;
  regret_index: number | null;
  consistency_flag: string;
  pnl_pct: number | null;
  price_at_sell: number | null;
  price_5d_after: number | null;
  traded_at: string; // Sell Time
  created_at: string;
}

// ── API Functions ───────────────────────────────────────────────────

export const fetchReviewStats = async (): Promise<ReviewStats> => {
  const { data: response } = await http.get<ApiResponse<DashboardResponse>>('/review/dashboard');
  const data = response.data;
  return {
    consistency_rate: data.logic_consistency_rate,
    avg_regret_percent: data.avg_regret_index,
    avg_execution_score: data.avg_execution_score,
  };
};

export const fetchTradeReviews = async (): Promise<TradeReview[]> => {
  // Fetch recent 100 reviews
  const { data: response } = await http.get<ApiResponse<{ items: TradeReviewWithTrade[] }>>('/review/list', {
    params: { limit: 100, offset: 0 },
  });

  return response.data.items.map(mapToTradeReview);
};

export const fetchScatterData = async (): Promise<ScatterPoint[]> => {
  // Reuse fetchTradeReviews logic but map to ScatterPoint
  const { data: response } = await http.get<ApiResponse<{ items: TradeReviewWithTrade[] }>>('/review/list', {
    params: { limit: 100, offset: 0 },
  });

  return response.data.items.map((item) => {
    // Map mental state to score (0-100)
    let sentiment = 50;
    const m = (item.mental_state || '').toLowerCase();
    if (m.includes('恐慌') || m.includes('panic') || m.includes('fear')) sentiment = 90;
    else if (m.includes('贪婪') || m.includes('greed')) sentiment = 80;
    else if (m.includes('冷静') || m.includes('calm')) sentiment = 20;
    else if (m.includes('自信') || m.includes('confident')) sentiment = 30;
    else if (m.includes('犹豫') || m.includes('hesitant')) sentiment = 60;

    return {
      id: String(item.id),
      sentiment_score: sentiment + (Math.random() * 10 - 5), // Add noise
      pnl_percent: (item.pnl_pct || 0) * 100,
      is_consistent: item.consistency_flag === 'NORMAL',
    };
  });
};

export const fetchAiAudit = async (tradeId: string): Promise<AiAudit> => {
  // 1. Trigger AI Audit (or get existing)
  const { data: reviewResp } = await http.post<ApiResponse<TradeReviewWithTrade>>(`/review/ai/${tradeId}`);
  const review = reviewResp.data;

  // 2. Fetch K-Line data for context
  let klineData: AiAudit['kline_data'] = [];
  try {
    const { data: klineRespWrapper } = await http.get<ApiResponse<KLineResponse>>(`/stocks/${review.stock_code}/kline`, {
      params: { limit: 30, period: 'daily' },
    });
    const klineResp = klineRespWrapper.data;
    
    if (klineResp && klineResp.klines) {
        // Map KLineResponse to mini kline format
        klineData = klineResp.klines.map((k) => ({
            date: k.date,
            open: k.open,
            close: k.close,
            high: k.high,
            low: k.low,
        }));
    }
  } catch (e) {
    console.warn('Failed to fetch kline for audit', e);
  }

  return {
    trade_id: String(review.id),
    comment: review.ai_audit_comment || "AI 正在思考中...",
    kline_data: klineData,
  };
};

export const submitImprovementPlan = async (tradeLogId: string, content: string): Promise<void> => {
  // Using trade_log_id to submit
  await http.post<ApiResponse<unknown>>('/review/submit', {
    trade_log_id: parseInt(tradeLogId, 10),
    user_note: content,
  });
};

// ── Helper ──────────────────────────────────────────────────────────

function mapToTradeReview(item: TradeReviewWithTrade): TradeReview {
  const pnlPct = (item.pnl_pct || 0) * 100;
  const sellPrice = item.price_at_sell || 0;
  // Infer buy price (approx)
  const buyPrice = sellPrice / (1 + (item.pnl_pct || 0));

  let status: ReviewStatus = 'LOGICAL_CONSISTENCY';
  if (item.consistency_flag !== 'NORMAL') {
      status = 'EMOTIONAL_OPERATION'; // Default to emotional if conflict
      // Refine if needed: lucky profit check
      if (pnlPct > 0) status = 'LUCKY_PROFIT';
  } else {
      // Normal logic
      status = 'LOGICAL_CONSISTENCY';
  }

  return {
    id: String(item.id),
    trade_log_id: String(item.trade_log_id),
    stock_name: item.stock_name || item.stock_code,
    stock_code: item.stock_code,
    buy_date: '未知', // Backend doesn't provide buy date in this view yet
    buy_price: parseFloat(buyPrice.toFixed(2)),
    sell_date: item.traded_at ? item.traded_at.split('T')[0] : '',
    sell_price: sellPrice,
    sell_reason: item.sell_reason,
    price_5d_after: item.price_5d_after || sellPrice,
    pnl_percent: parseFloat(pnlPct.toFixed(2)),
    pnl_amount: 0, // Backend doesn't provide absolute amount yet
    regret_index: parseFloat(((item.regret_index || 0) * 100).toFixed(2)),
    execution_score: item.execution_score || 0,
    status: status,
    is_disciplined: item.consistency_flag === 'NORMAL',
  };
}
