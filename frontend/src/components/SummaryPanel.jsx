import React from 'react';
import { Brain, Filter, RefreshCw } from 'lucide-react';

/** Nice display labels for backend category keys */
const CATEGORY_LABELS = {
  infrastructure_damage: 'Infrastructure',
  evacuation: 'Evacuation',
  rescue_help: 'Rescue / Help',
  donations_volunteering: 'Donations',
  weather_water_levels: 'Weather / Water',
  sympathy_support: 'Sympathy',
  other_related: 'Other Related',
};

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key;
}

function getCategoryColors(category) {
  if (!category) return { bg: 'bg-slate-800/40', text: 'text-slate-400', ring: 'ring-slate-700/40' };
  const cat = category.toLowerCase();
  if (cat.includes('rescue') || cat.includes('elder') || cat.includes('home'))
    return { bg: 'bg-rose-900/30', text: 'text-rose-300', ring: 'ring-rose-800/40' };
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge'))
    return { bg: 'bg-orange-900/30', text: 'text-orange-300', ring: 'ring-orange-800/40' };
  if (cat.includes('evacuation'))
    return { bg: 'bg-amber-900/30', text: 'text-amber-300', ring: 'ring-amber-800/40' };
  if (cat.includes('weather') || cat.includes('water'))
    return { bg: 'bg-blue-900/30', text: 'text-blue-300', ring: 'ring-blue-800/40' };
  if (cat.includes('donation') || cat.includes('volunteer'))
    return { bg: 'bg-emerald-900/30', text: 'text-emerald-300', ring: 'ring-emerald-800/40' };
  return { bg: 'bg-slate-800/40', text: 'text-slate-400', ring: 'ring-slate-700/40' };
}

export default function SummaryPanel({
  summary,
  filteredRelevantCount,
  totalRelevantCount,
  topLocations,
  byCategory,
  onRequestSummary,
  canRequestSummary,
}) {
  const locationList = topLocations || [];
  const categoryEntries = Object.entries(byCategory || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* AI Disaster Summary */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-900/40 flex items-center justify-center">
              <Brain className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">AI Situation Overview</h3>
              <p className="text-[10px] text-slate-500">Gemini-powered disaster intelligence</p>
            </div>
          </div>
          {canRequestSummary && (
            <button
              onClick={onRequestSummary}
              className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-indigo-900/30 text-indigo-300 hover:bg-indigo-800/40 transition-all ring-1 ring-indigo-800/40"
            >
              <RefreshCw className="w-3 h-3" />
              Re-generate
            </button>
          )}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {summary || 'No summary available. Click "Re-generate" or load a dataset to see the AI overview.'}
        </p>
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
              {filteredRelevantCount} of {totalRelevantCount} relevant tweets shown
            </p>
          </div>
        </div>

        {/* Location breakdown */}
        <div className="mb-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Top Locations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {locationList.slice(0, 6).map((loc) => (
              <span
                key={loc.name}
                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 ring-1 ring-blue-800/40"
              >
                {loc.name} ({loc.count})
              </span>
            ))}
            {locationList.length === 0 && (
              <span className="text-[10px] text-slate-500">No locations extracted</span>
            )}
          </div>
        </div>

        {/* Impact breakdown */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Impact Categories
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categoryEntries.map(([cat, count]) => {
              const colors = getCategoryColors(cat);
              return (
                <span
                  key={cat}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}
                >
                  {categoryLabel(cat)} ({count})
                </span>
              );
            })}
            {categoryEntries.length === 0 && (
              <span className="text-[10px] text-slate-500">No category data</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
