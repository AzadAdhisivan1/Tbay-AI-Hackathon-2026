import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Area,
  ComposedChart,
} from 'recharts';
import { BarChart3, TrendingUp, Layers } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-slate-950/95 border border-slate-700/80 p-3.5 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-semibold text-white mb-2 pb-1 border-b border-slate-800">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-mono font-medium text-white">
                {entry.value} {entry.name === 'Savings' ? 'hrs/k$' : 'hrs'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function ChartSection({ data }) {
  const [viewMode, setViewMode] = useState('composed'); // 'composed' | 'bar'

  const chartData = data && data.length ? data : [
    { period: 'Sprint 1', baseline: 120, aiOptimized: 45, savings: 75 },
    { period: 'Sprint 2', baseline: 140, aiOptimized: 50, savings: 90 },
    { period: 'Sprint 3', baseline: 165, aiOptimized: 55, savings: 110 },
    { period: 'Sprint 4', baseline: 190, aiOptimized: 60, savings: 130 },
    { period: 'Sprint 5', baseline: 210, aiOptimized: 68, savings: 142 },
    { period: 'Sprint 6', baseline: 245, aiOptimized: 72, savings: 173 },
  ];

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Performance & Resource Savings Projection
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Baseline vs. AI-Optimized engineering capacity over sprint cycles
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('composed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'composed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Combined</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'bar'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Bar View</span>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'composed' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="optimizedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="period" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Bar dataKey="baseline" name="Manual Baseline" fill="#475569" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aiOptimized" name="AI Optimized" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="savings"
                name="Net Capacity Gained"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#0f172a' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="period" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="baseline" name="Baseline (hrs)" fill="#334155" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aiOptimized" name="AI Optimized (hrs)" fill="#818cf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Net Savings (hrs)" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
