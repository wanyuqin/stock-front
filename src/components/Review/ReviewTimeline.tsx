
import React from 'react';
import { TradeReview } from '../../types/review';
import { ArrowRight, Eye, ShieldCheck, AlertCircle } from 'lucide-react';

interface ReviewTimelineProps {
  reviews: TradeReview[];
  onAuditClick: (trade: TradeReview) => void;
}

const ReviewRow: React.FC<{ review: TradeReview; onAudit: () => void }> = ({ review, onAudit }) => {
  const isRegret = review.regret_index > 10;
  const isGoodSell = review.regret_index < -5; // Example threshold for "Perfect Sell"

  return (
    <div 
      className={`relative group rounded-xl border p-4 transition-all hover:shadow-lg
        ${isRegret ? 'bg-red-900/10 border-red-500/30' : 'bg-gray-900/40 border-gray-800 hover:border-blue-500/30'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
        {/* Header: Stock & Date */}
        <div>
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            {review.stock_name} 
            <span className="text-xs font-mono text-gray-500">({review.stock_code})</span>
            {review.is_disciplined && (
              <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
                <ShieldCheck size={12} /> 守纪模范
              </span>
            )}
          </h4>
          <div className="text-xs text-gray-500 mt-1 flex gap-2">
            <span>{review.buy_date}</span>
            <ArrowRight size={12} className="text-gray-600" />
            <span>{review.sell_date}</span>
          </div>
        </div>

        {/* PnL Badge */}
        <div className={`text-right ${review.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          <div className="font-mono font-bold text-lg">
            {review.pnl_percent > 0 ? '+' : ''}{review.pnl_percent}%
          </div>
          <div className="text-xs opacity-70">
            {review.pnl_amount > 0 ? '+' : ''}{review.pnl_amount}
          </div>
        </div>
      </div>

      {/* Comparison View */}
      <div className="grid grid-cols-2 gap-4 my-4 bg-black/20 rounded-lg p-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">卖出价格</div>
          <div className="font-mono text-white text-lg">{review.sell_price}</div>
          <div className="text-xs text-gray-400 mt-1 truncate" title={review.sell_reason}>
            理由: {review.sell_reason}
          </div>
        </div>
        
        <div className="relative border-l border-gray-700 pl-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
            5日残影 (Ghost Price)
            {isRegret && <span className="text-red-500 text-[10px] animate-pulse">后悔提醒</span>}
            {isGoodSell && <span className="text-green-500 text-[10px]">完美逃顶</span>}
          </div>
          <div className={`font-mono text-lg ${isRegret ? 'text-red-400' : isGoodSell ? 'text-green-400' : 'text-gray-400'}`}>
            {review.price_5d_after}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {isRegret ? `错失 ${(review.price_5d_after - review.sell_price).toFixed(2)}` : '未踏空'}
          </div>
        </div>
      </div>

      {/* Footer: Tags & Action */}
      <div className="flex justify-between items-center mt-2">
        <div className="flex gap-2">
          <span className={`px-2 py-0.5 rounded text-xs border
            ${review.status === 'LOGICAL_CONSISTENCY' ? 'bg-green-900/20 border-green-800 text-green-400' : 
              review.status === 'EMOTIONAL_OPERATION' ? 'bg-red-900/20 border-red-800 text-red-400' : 
              'bg-yellow-900/20 border-yellow-800 text-yellow-400'}
          `}>
            {review.status === 'LOGICAL_CONSISTENCY' ? '逻辑自洽' : 
             review.status === 'EMOTIONAL_OPERATION' ? '情绪化操作' : '运气型盈利'}
          </span>
        </div>
        
        <button 
          onClick={onAudit}
          className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors bg-purple-900/10 hover:bg-purple-900/20 px-3 py-1.5 rounded-full border border-purple-500/30"
        >
          <Eye size={14} />
          查看 AI 审计
        </button>
      </div>

      {/* Regret Warning Overlay */}
      {isRegret && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-red-400 flex items-center gap-1 z-10">
          <AlertCircle size={10} /> 止盈过早
        </div>
      )}
    </div>
  );
};

const ReviewTimeline: React.FC<ReviewTimelineProps> = ({ reviews, onAuditClick }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
        复盘时光机
      </h3>
      <div className="grid gap-4">
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} onAudit={() => onAuditClick(review)} />
        ))}
      </div>
    </div>
  );
};

export default ReviewTimeline;
