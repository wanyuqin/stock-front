import React, { useState, useEffect, useCallback } from 'react'
import ExecutionHeader from '../components/Review/ExecutionHeader'
import ReviewTimeline from '../components/Review/ReviewTimeline'
import DarkRoomModal from '../components/Review/DarkRoomModal'
import {
  fetchReviewStats,
  fetchScatterData,
  fetchTradeReviews,
  fetchAiAudit,
  submitImprovementPlan,
  fetchBehaviorStats,
} from '../api/review'
import { ReviewStats, TradeReview, ScatterPoint, AiAudit, BehaviorStat } from '../types/review'
import { Loader2, RefreshCw, Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

// ── 行为归因面板 ──────────────────────────────────────────────────

const BEHAVIOR_CONFIG: Record<string, {
  label:    string
  desc:     string
  icon:     React.ElementType
  colorCls: string
  bgCls:    string
}> = {
  NORMAL: {
    label: '逻辑一致',
    desc: '买卖行为符合预设逻辑',
    icon: CheckCircle2,
    colorCls: 'text-green-400',
    bgCls: 'bg-green-500/10 border-green-500/25',
  },
  PANIC_SELL: {
    label: '恐慌卖出',
    desc: '盈利时因恐惧情绪卖出',
    icon: AlertTriangle,
    colorCls: 'text-red-400',
    bgCls: 'bg-red-500/10 border-red-500/25',
  },
  CHASING_HIGH: {
    label: '追高买入',
    desc: '买入价偏离 MA20 超 8%',
    icon: TrendingUp,
    colorCls: 'text-amber-400',
    bgCls: 'bg-amber-500/10 border-amber-500/25',
  },
  LOGIC_CONFLICT: {
    label: '策略冲突',
    desc: '长线理由却短期操作',
    icon: Brain,
    colorCls: 'text-purple-400',
    bgCls: 'bg-purple-500/10 border-purple-500/25',
  },
  PREMATURE_EXIT: {
    label: '过早止盈',
    desc: '盈利不足 3% 就卖出',
    icon: TrendingDown,
    colorCls: 'text-orange-400',
    bgCls: 'bg-orange-500/10 border-orange-500/25',
  },
}

function BehaviorStatsPanel() {
  const [data, setData]     = useState<{ items: BehaviorStat[]; total_trades: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBehaviorStats()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 animate-pulse h-28" />
        ))}
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <Brain size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">暂无行为数据，完成更多复盘后统计将自动更新</p>
      </div>
    )
  }

  // 找出"最贵的坏习惯"（非 NORMAL 中 total_pnl 最小的）
  const worstFlag = data.items
    .filter(i => i.flag !== 'NORMAL' && i.count > 0)
    .sort((a, b) => a.total_pnl - b.total_pnl)[0]?.flag

  return (
    <div className="space-y-4">
      {/* 汇总行 */}
      <div className="flex items-center gap-4 text-sm text-gray-400 font-mono">
        <span>共分析 <span className="text-white font-bold">{data.total_trades}</span> 笔交易</span>
        {worstFlag && worstFlag !== 'NORMAL' && (
          <span className="text-amber-400">
            最贵坏习惯：{BEHAVIOR_CONFIG[worstFlag]?.label ?? worstFlag}
          </span>
        )}
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map(item => {
          const cfg = BEHAVIOR_CONFIG[item.flag] ?? {
            label: item.flag,
            desc: '',
            icon: Brain,
            colorCls: 'text-gray-400',
            bgCls: 'bg-gray-500/10 border-gray-500/25',
          }
          const Icon = cfg.icon
          const isNormal = item.flag === 'NORMAL'
          const isWorst  = item.flag === worstFlag

          return (
            <div
              key={item.flag}
              className={`relative rounded-xl border p-4 ${cfg.bgCls} ${isWorst ? 'ring-1 ring-amber-500/40' : ''}`}
            >
              {isWorst && (
                <span className="absolute top-2 right-2 text-[9px] font-mono bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  最贵习惯
                </span>
              )}

              <div className="flex items-center gap-2 mb-3">
                <Icon size={14} className={cfg.colorCls} />
                <span className={`text-sm font-semibold ${cfg.colorCls}`}>{cfg.label}</span>
              </div>
              {cfg.desc && <p className="text-[11px] text-gray-500 mb-3">{cfg.desc}</p>}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-mono font-bold text-white">{item.count}</p>
                  <p className="text-[10px] text-gray-500">次数</p>
                </div>
                <div>
                  <p className={`text-lg font-mono font-bold ${item.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.win_rate.toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-gray-500">胜率</p>
                </div>
                <div>
                  <p className={`text-lg font-mono font-bold ${item.avg_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.avg_pnl >= 0 ? '+' : ''}{item.avg_pnl.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-gray-500">均盈亏</p>
                </div>
              </div>

              {/* 胜率进度条 */}
              <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isNormal ? 'bg-green-500' : item.win_rate >= 50 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                  style={{ width: `${item.win_rate}%` }}
                />
              </div>

              {/* 总损益 */}
              {!isNormal && (
                <p className={`mt-2 text-[10px] font-mono ${item.total_pnl >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                  累计 {item.total_pnl >= 0 ? '+' : ''}{item.total_pnl.toFixed(1)}% 盈亏贡献
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────

type TabKey = 'overview' | 'behavior' | 'timeline'

const TradeReviewHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats]         = useState<ReviewStats | null>(null)
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([])
  const [reviews, setReviews]     = useState<TradeReview[]>([])
  const [error, setError]         = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [currentAudit, setCurrentAudit]   = useState<AiAudit | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<TradeReview | null>(null)
  const [auditLoading, setAuditLoading]   = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [statsData, scatter, reviewsData] = await Promise.all([
        fetchReviewStats(),
        fetchScatterData(),
        fetchTradeReviews(),
      ])
      setStats(statsData)
      setScatterData(scatter)
      setReviews(reviewsData)
    } catch (err) {
      console.error('Failed to load review data', err)
      setError('加载复盘数据失败，请检查后端连接后刷新。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAuditClick = async (trade: TradeReview) => {
    setSelectedTrade(trade)
    setAuditLoading(true)
    setIsModalOpen(true)
    try {
      const audit = await fetchAiAudit(trade.id, trade.ai_audit_comment)
      setCurrentAudit(audit)
    } catch (e) {
      console.error('Failed to fetch audit', e)
      setCurrentAudit({ trade_id: trade.id, comment: '获取 AI 审计失败，请稍后重试。', kline_data: [], is_generating: false })
    } finally {
      setAuditLoading(false)
    }
  }

  const handleImprovementSubmit = async (plan: string) => {
    if (selectedTrade?.trade_log_id) {
      try {
        await submitImprovementPlan(parseInt(selectedTrade.trade_log_id, 10), plan)
      } catch (e) {
        console.error('Failed to submit improvement plan', e)
      }
    }
    setIsModalOpen(false)
    setCurrentAudit(null)
    setSelectedTrade(null)
    loadData()
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setCurrentAudit(null)
    setSelectedTrade(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white gap-3">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-gray-400 text-sm">加载复盘数据中…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors">
          <RefreshCw size={14} /> 重新加载
        </button>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview',  label: '执行概览' },
    { key: 'behavior',  label: '行为归因' },
    { key: 'timeline',  label: '复盘时间轴' },
  ]

  return (
    <div className="min-h-screen bg-black text-gray-200 p-6 font-sans">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            深度复盘 <span className="text-purple-500">Hub</span>
          </h1>
          <p className="text-gray-500">数据追踪 · 心理锚定 · AI 毒舌审计</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
          <RefreshCw size={14} /> 刷新
        </button>
      </header>

      {/* Tab 导航 */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === t.key
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.key === 'behavior' && (
              <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-mono">NEW</span>
            )}
          </button>
        ))}
      </div>

      <main className="max-w-7xl mx-auto">
        {reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">暂无复盘记录</p>
            <p className="text-sm">先在「交易日志」中记录卖出交易，然后点击「初始化复盘」按钮生成复盘草稿。</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <ExecutionHeader stats={stats} scatterData={scatterData} />
            )}

            {activeTab === 'behavior' && (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">交易行为归因</h2>
                  <p className="text-sm text-gray-500 mt-1">基于每笔复盘的一致性分析，统计各类行为的胜率与平均盈亏</p>
                </div>
                <BehaviorStatsPanel />
              </div>
            )}

            {activeTab === 'timeline' && (
              <ReviewTimeline reviews={reviews} onAuditClick={handleAuditClick} />
            )}
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
  )
}

export default TradeReviewHub
