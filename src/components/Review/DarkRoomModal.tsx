
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, MessageSquare } from 'lucide-react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { AiAudit } from '../../types/review';

interface DarkRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData: AiAudit | null;
  onImprovementSubmit: (plan: string) => void;
}

const DarkRoomModal: React.FC<DarkRoomModalProps> = ({ isOpen, onClose, auditData, onImprovementSubmit }) => {
  const [typedComment, setTypedComment] = useState('');
  const [improvementPlan, setImprovementPlan] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && auditData) {
      setTypedComment('');
      setImprovementPlan('');
      setIsTyping(true);
      let i = 0;
      const text = auditData.comment;
      const speed = 30; // ms per char

      const timer = setInterval(() => {
        if (i < text.length) {
          setTypedComment((prev) => prev + text.charAt(i));
          i++;
          if (commentRef.current) {
            commentRef.current.scrollTop = commentRef.current.scrollHeight;
          }
        } else {
          setIsTyping(false);
          clearInterval(timer);
        }
      }, speed);

      return () => clearInterval(timer);
    }
  }, [isOpen, auditData]);

  if (!isOpen || !auditData) return null;

  const handleSubmit = () => {
    if (improvementPlan.trim().length > 0) {
      onImprovementSubmit(improvementPlan);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
        
        {/* Left: Chart Visualization */}
        <div className="w-full md:w-1/2 p-6 border-r border-gray-800 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-purple-500">⚡</span> 交易现场重现
          </h3>
          <div className="flex-1 bg-black/20 rounded-xl p-2 border border-gray-800">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={auditData.kline_data}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
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
          </div>
          <div className="mt-4 text-xs text-gray-500 text-center">
            包含买入、卖出及后续5日走势
          </div>
        </div>

        {/* Right: AI Comment & Input */}
        <div className="w-full md:w-1/2 p-6 flex flex-col bg-gray-900">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <MessageSquare size={18} /> AI 毒舌点评
            </h3>
            {/* Close button is hidden until input is provided? Or just disabled? Requirement says "Forced Interaction... required to close" */}
            <button 
              onClick={onClose} 
              disabled={improvementPlan.trim().length === 0}
              className={`p-1 rounded-full transition-colors ${improvementPlan.trim().length > 0 ? 'hover:bg-gray-800 text-gray-400' : 'opacity-0 cursor-not-allowed'}`}
            >
              <X size={20} />
            </button>
          </div>

          {/* Typewriter Comment */}
          <div 
            ref={commentRef}
            className="flex-1 bg-black/40 rounded-xl p-4 mb-6 overflow-y-auto border border-red-900/30 font-mono text-sm leading-relaxed text-gray-300 shadow-inner"
          >
            <span className="text-red-500 font-bold mr-2">{'>'}</span>
            {typedComment}
            {isTyping && <span className="inline-block w-2 h-4 bg-red-500 ml-1 animate-pulse"/>}
          </div>

          {/* Forced Input */}
          <div className="mt-auto">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              写给下次的自己 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={improvementPlan}
              onChange={(e) => setImprovementPlan(e.target.value)}
              placeholder="输入改进计划以解锁关闭..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-24 text-sm transition-all"
            />
            <button
              onClick={handleSubmit}
              disabled={improvementPlan.trim().length === 0}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all
                ${improvementPlan.trim().length > 0 
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
              `}
            >
              <Save size={18} />
              提交计划并关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarkRoomModal;
