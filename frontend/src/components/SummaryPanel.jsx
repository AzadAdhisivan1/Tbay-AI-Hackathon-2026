import React from 'react';
import { Brain, Filter, TrendingUp } from 'lucide-react';

export default function SummaryPanel({
  summary,
  filteredRelevantCount,
  totalRelevantCount,
  locationBreakdown,
  impactBreakdown,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* AI Disaster Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-900/40 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">AI Situation Overview</h3>
            <p className="text-[10px] text-slate-500">Gemini-powered disaster intelligence</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
      </div>

      {/* Dynamic Filter Overview */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-900/40 flex items-center justify-center">
            <Filter className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">Current Filter Overview</h3>
            <p className="text-[10px] text-slate-500">
              {filteredRelevantCount} of {totalRelevantCount} relevant tweets match filters
            </p>
          </div>
        </div>

        {/* Location breakdown */}
        <div className="mb-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Top Locations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {locationBreakdown.slice(0, 5).map(([name, count]) => (
              <span
                key={name}
                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 ring-1 ring-blue-800/40"
              >
                {name} ({count})
              </span>
            ))}
            {locationBreakdown.length === 0 && (
              <span className="text-[10px] text-slate-500">No locations</span>
            )}
          </div>
        </div>

        {/* Impact breakdown */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Impact Types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {impactBreakdown.map(([category, count]) => {
              const colors = getCategoryColors(category);
              return (
                <span
                  key={category}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}
                >
                  {category} ({count})
                </span>
              );
            })}
            {impactBreakdown.length === 0 && (
              <span className="text-[10px] text-slate-500">No impact data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryColors(category) {
  if (!category) return { bg: 'bg-slate-800/40', text: 'text-slate-400', ring: 'ring-slate-700/40' };
  const cat = category.toLowerCase();
  if (cat.includes('elder') || cat.includes('home'))
    return { bg: 'bg-rose-900/30', text: 'text-rose-300', ring: 'ring-rose-800/40' };
  if (cat.includes('road') || cat.includes('bridge') || cat.includes('infrastructure'))
    return { bg: 'bg-orange-900/30', text: 'text-orange-300', ring: 'ring-orange-800/40' };
  return { bg: 'bg-blue-900/30', text: 'text-blue-300', ring: 'ring-blue-800/40' };
}
