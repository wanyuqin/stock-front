
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, MessageSquare, Loader2 } from 'lucide-react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { AiAudit } from '../../types/review';

interface DarkRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData: AiAudit | null;
  isLoading?: boolean; // 新增：外部 loading 状态（触发 AI 阶段）
  onImprovementSubmit: (plan: string) => void;
}

const DarkRoomModal: React.FC<DarkRoomModalProps> = ({
  isOpen,
  onClose,
  auditData,
  isLoading = false,
  onImprovementSubmit,
}) => {
  const [typedComment, setTypedComment] = useState('');
  const [improvementPlan, setImprovementPlan] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen || !auditData) return;

    // 重置状态
    setTypedComment('');
    setImprovementPlan('');

    // 清理上一个 timer
    if (timerRef.current) clearInterval(timerRef.current);

    const text = auditData.comment;
    if (!text) return;

    setIsTyping(true);
    let i = 0;
    const speed = 20; // ms/char，稍微加快

    timerRef.current = setInterval(() => {
      if (i < text.length) {
        setTypedComment(text.slice(0, i + 1));
        i++;
        if (commentRef.current) {
          commentRef.current.scrollTop = commentRef.current.scrollHeight;
        }
      } else {
        setIsTyping(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, auditData]);

  if (!isOpen) return null;

  const canClose = improvementPlan.trim().length > 0;
  const isGenerating = auditData?.is_generating ?? false;

  const handleSubmit = () => {
    if (canClose) {
      onImprovementSubmit(improvementPlan.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">

        {/* 左侧：K 线图 */}
        <div className="w-full md:w-1/2 p-6 border-r border-gray-800 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-purple-500">⚡</span> 交易现场重现
          </h3>
          <div className="flex-1 bg-black/20 rounded-xl p-2 border border-gray-800">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-purple-400" size={32} />
              </div>
            ) : auditData && auditData.kline_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={auditData.kline_data}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Area type="monotone" dataKey="close" stroke="#8884d8" fillOpacity={1} fill="url(#colorPrice)" />
                  <Line type="monotone" dataKey="high" stroke="#ff7300" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="low" stroke="#ff7300" dot={false} strokeWidth={1} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                暂无 K 线数据
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            最近 30 日 K 线走势
          </div>
        </div>

        {/* 右侧：AI 点评 + 输入 */}
        <div className="w-full md:w-1/2 p-6 flex flex-col bg-gray-900">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <MessageSquare size={18} /> AI 毒舌点评
            </h3>
            {/* FIX: 关闭按钮始终可见，填写改进计划前禁用（有明确视觉提示） */}
            <button
              onClick={onClose}
              disabled={!canClose}
              title={canClose ? '关闭' : '请先填写改进计划'}
              className={`p-1.5 rounded-full transition-all ${
                canClose
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer'
                  : 'text-gray-700 cursor-not-allowed'
              }`}
            >
              <X size={20} />
            </button>
          </div>

          {/* 打字机效果 */}
          <div
            ref={commentRef}
            className="flex-1 bg-black/40 rounded-xl p-4 mb-4 overflow-y-auto border border-red-900/30 font-mono text-sm leading-relaxed text-gray-300 shadow-inner"
          >
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={16} />
                <span>正在获取 AI 审计数据…</span>
              </div>
            ) : (
              <>
                {isGenerating ? (
                  <div className="text-yellow-500/80 text-xs mb-3 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    AI 正在后台分析中，结果生成后请刷新页面查看
                  </div>
                ) : null}
                <span className="text-red-500 font-bold mr-2">{'>'}</span>
                {typedComment}
                {isTyping && (
                  <span className="inline-block w-2 h-4 bg-red-500 ml-1 animate-pulse" />
                )}
              </>
            )}
          </div>

          {/* 强制输入改进计划 */}
          <div className="mt-auto">
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              写给下次的自己{' '}
              <span className="text-red-500">*</span>
              {!canClose && (
                <span className="ml-2 text-xs text-gray-600">（填写后方可关闭）</span>
              )}
            </label>
            <textarea
              value={improvementPlan}
              onChange={(e) => setImprovementPlan(e.target.value)}
              placeholder="输入你的改进计划，例如：下次止盈要分批卖出，不一次清仓…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                resize-none h-24 text-sm transition-all"
            />
            <button
              onClick={handleSubmit}
              disabled={!canClose}
              className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all
                ${canClose
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 cursor-pointer'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
            >
              <Save size={16} />
              提交计划并关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarkRoomModal;
