
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
import { Loader2 } from 'lucide-react';

const TradeReviewHub: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([]);
  const [reviews, setReviews] = useState<TradeReview[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<AiAudit | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, scatter, reviewsData] = await Promise.all([
          fetchReviewStats(),
          fetchScatterData(),
          fetchTradeReviews()
        ]);
        setStats(statsData);
        setScatterData(scatter);
        setReviews(reviewsData);
      } catch (error) {
        console.error("Failed to load review data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAuditClick = async (trade: TradeReview) => {
    setSelectedTradeId(trade.id);
    // Fetch audit data
    // In a real app, you might want to show a loading state for the modal content
    const audit = await fetchAiAudit(trade.id);
    setCurrentAudit(audit);
    setIsModalOpen(true);
  };

  const handleImprovementSubmit = async (plan: string) => {
    if (selectedTradeId) {
      // Find the trade review to get trade_log_id
      const review = reviews.find(r => r.id === selectedTradeId);
      if (review && review.trade_log_id) {
        await submitImprovementPlan(review.trade_log_id, plan);
        // Ideally, refresh data or show success message
        console.log("Plan submitted successfully");
      }
    }
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <Loader2 className="animate-spin text-purple-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">深度复盘 <span className="text-purple-500">Hub</span></h1>
        <p className="text-gray-500">数据追踪 · 心理锚定 · AI 毒舌审计</p>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {stats && (
          <section>
            <ExecutionHeader stats={stats} scatterData={scatterData} />
          </section>
        )}

        <section>
          <ReviewTimeline reviews={reviews} onAuditClick={handleAuditClick} />
        </section>
      </main>

      {/* AI Audit Modal */}
      {isModalOpen && (
        <DarkRoomModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          auditData={currentAudit}
          onImprovementSubmit={handleImprovementSubmit}
        />
      )}
    </div>
  );
};

export default TradeReviewHub;
