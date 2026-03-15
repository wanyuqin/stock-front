
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { ReviewStats, ScatterPoint } from '../../types/review';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

interface ExecutionHeaderProps {
  stats: ReviewStats;
  scatterData: ScatterPoint[];
}

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ReactNode; 
  alert?: boolean 
}> = ({ title, value, subtext, icon, alert }) => (
  <div className={`p-4 rounded-xl border transition-all ${alert ? 'bg-red-900/10 border-red-500/50' : 'bg-gray-900/50 border-gray-800'}`}>
    <div className="flex justify-between items-start mb-2">
      <span className="text-gray-400 text-sm font-medium">{title}</span>
      <span className={`${alert ? 'text-red-400' : 'text-blue-400'}`}>{icon}</span>
    </div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
  </div>
);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow-lg text-xs">
        <p className="font-bold text-white mb-1">{data.id}</p>
        <p className="text-gray-300">Sentiment: {data.sentiment_score.toFixed(0)}</p>
        <p className={`${data.pnl_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          PnL: {data.pnl_percent.toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
};

const ExecutionHeader: React.FC<ExecutionHeaderProps> = ({ stats, scatterData }) => {
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="逻辑一致率"
          value={`${stats.consistency_rate}%`}
          subtext="符合最初买入逻辑的交易占比"
          icon={<Activity size={18} />}
        />
        <StatCard
          title="平均卖飞空间"
          value={`${stats.avg_regret_percent.toFixed(1)}%`}
          subtext="基于卖出后5日最高价计算"
          icon={<AlertTriangle size={18} />}
          alert={stats.avg_regret_percent > 10}
        />
        <StatCard
          title="执行力评分"
          value={stats.avg_execution_score}
          subtext="系统综合打分"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Scatter Plot */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
          <Activity size={16} />
          情绪与盈亏相关性分析
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                dataKey="sentiment_score" 
                name="Sentiment" 
                domain={[0, 100]} 
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                label={{ value: '情绪指数 (0=冷静, 100=失控)', position: 'bottom', offset: 0, fill: '#6B7280', fontSize: 10 }}
              />
              <YAxis 
                type="number" 
                dataKey="pnl_percent" 
                name="PnL" 
                unit="%" 
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                label={{ value: '盈亏 %', angle: -90, position: 'left', fill: '#6B7280', fontSize: 10 }}
              />
              <ZAxis range={[60, 60]} /> {/* Fixed dot size */}
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Consistent" data={scatterData.filter(d => d.is_consistent)} fill="#3B82F6" />
              <Scatter name="Inconsistent" data={scatterData.filter(d => !d.is_consistent)} fill="#EF4444" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>逻辑一致</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span>情绪化操作</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionHeader;
