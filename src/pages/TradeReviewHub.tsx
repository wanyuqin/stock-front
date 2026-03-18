
import React, { useState, useEffect } from 'react';
import ExecutionHeader from '../components/Review/ExecutionHeader';
import ReviewTimeline from '../components/Review/ReviewTimeline';
import DarkRoomModal from '../components/Review/DarkRoomModal';
import { 
  fetchReviewStats, 
  fetchScatterData, 
  fetchTradeReviews, 
  fetchAiAudit, 
  submitImprovementPlan 
} from '../api/review';
import { ReviewStats, TradeReview, ScatterPoint, AiAudit } from '../types/review';
import { Loader2, RefreshCw } from 'lucide-react';

const TradeReviewHub: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([]);
  const [reviews, setReviews] = useState<TradeReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<AiAudit | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeReview | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, scatter, reviewsData] = await Promise.all([
        fetchReviewStats(),
        fetchScatterData(),
        fetchTradeReviews(),
      ]);
      setStats(statsData);
      setScatterData(scatter);
      setReviews(reviewsData);
    } catch (err) {
      console.error('Failed to load review data', err);
      setError('加载复盘数据失败，请检查后端连接后刷新。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAuditClick = async (trade: TradeReview) => {
    setSelectedTrade(trade);
    setAuditLoading(true);
    setIsModalOpen(true);
    try {
      // FIX: 传入已有 ai_audit_comment，有内容时直接展示，不触发后端同步等待
      const audit = await fetchAiAudit(trade.id, trade.ai_audit_comment);
      setCurrentAudit(audit);
    } catch (e) {
      console.error('Failed to fetch audit', e);
      setCurrentAudit({
        trade_id: trade.id,
        comment: '获取 AI 审计失败，请稍后重试。',
        kline_data: [],
        is_generating: false,
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const handleImprovementSubmit = async (plan: string) => {
    if (selectedTrade && selectedTrade.trade_log_id) {
      try {
        // FIX: trade_log_id 是 string，转为 number 传给后端
        await submitImprovementPlan(parseInt(selectedTrade.trade_log_id, 10), plan);
      } catch (e) {
        console.error('Failed to submit improvement plan', e);
      }
    }
    setIsModalOpen(false);
    setCurrentAudit(null);
    setSelectedTrade(null);
    // 提交后刷新列表（更新 user_note）
    loadData();
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentAudit(null);
    setSelectedTrade(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white gap-3">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-gray-400 text-sm">加载复盘数据中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} /> 重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            深度复盘 <span className="text-purple-500">Hub</span>
          </h1>
          <p className="text-gray-500">数据追踪 · 心理锚定 · AI 毒舌审计</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">暂无复盘记录</p>
            <p className="text-sm">
              先在「交易日志」中记录卖出交易，然后点击「初始化复盘」按钮生成复盘草稿。
            </p>
          </div>
        ) : (
          <>
            {stats && (
              <section>
                <ExecutionHeader stats={stats} scatterData={scatterData} />
              </section>
            )}
            <section>
              <ReviewTimeline reviews={reviews} onAuditClick={handleAuditClick} />
            </section>
          </>
        )}
      </main>

      {isModalOpen && (
        <DarkRoomModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          auditData={currentAudit}
          isLoading={auditLoading}
          onImprovementSubmit={handleImprovementSubmit}
        />
      )}
    </div>
  );
};

export default TradeReviewHub;
