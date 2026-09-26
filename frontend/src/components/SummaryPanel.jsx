import React from 'react';
import { Brain, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { getCategoryBadge, getCategoryDisplay } from '../utils/categories';

export default function SummaryPanel({
  summary,
  filteredRelevantCount,
  totalRelevantCount,
  topLocations,
  byCategory,
  onRequestSummary,
  isLoadingSummary,
}) {
  const locationList = topLocations || [];
  const categoryEntries = Object.entries(byCategory || {}).sort((a, b) => b[1] - a[1]);
  const isPlaceholder =
    !summary ||
    summary.toLowerCase().includes('[placeholder') ||
    summary.toLowerCase().includes('placeholder summary');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 w-full">
      {/* AI Disaster Summary Card */}
      <div className="glass-card rounded-xl p-4 border border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-slate-900/80 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shadow-md">
                <Brain className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-wide uppercase font-[Outfit]">
                    AI Situation Overview
                  </h3>
                  {!isPlaceholder ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Gemini Live
                    </span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300/90 border border-amber-500/30 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                      Placeholder Summary
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Real-time disaster synthesis across verified signal tweets
                </p>
              </div>
            </div>

            {/* Always visible Re-generate Summary button */}
            <button
              id="btn-regenerate-summary"
              type="button"
              onClick={onRequestSummary}
              disabled={isLoadingSummary}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/50 hover:text-white transition-all border border-indigo-500/40 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Re-generate situational overview using Gemini AI"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin text-indigo-300' : 'text-indigo-400'}`} />
              <span>{isLoadingSummary ? 'Generating...' : 'Re-generate Summary'}</span>
            </button>
          </div>

          <div className="rounded-lg bg-slate-950/40 border border-indigo-500/15 p-3">
            <p className="text-xs sm:text-[13px] text-slate-100 leading-relaxed font-normal">
              {summary ||
                'Generating real-time emergency intelligence summary from active flood signals...'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-indigo-500/15 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 text-indigo-300">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Priority for Emergency Operations & EMO Field Commanders
          </span>
          <span className="text-slate-500">Auto-updates on dataset ingestion</span>
        </div>
      </div>

      {/* Dynamic Filter Overview Card */}
      <div className="glass-card rounded-xl p-4 border border-cyan-500/25 bg-gradient-to-br from-cyan-950/20 via-slate-900/60 to-slate-900/80 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center shadow-md">
              <Filter className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-wide uppercase font-[Outfit]">
                Current Intelligence Breakdown
              </h3>
              <p className="text-[10px] text-slate-400">
                Displaying <strong className="text-cyan-300">{filteredRelevantCount}</strong> of{' '}
                <strong className="text-slate-200">{totalRelevantCount}</strong> verified signal reports
              </p>
            </div>
          </div>

          {/* Top Affected Locations */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Priority Hotspots
            </p>
            <div className="flex flex-wrap gap-1.5">
              {locationList.slice(0, 5).map((loc) => (
                <span
                  key={loc.name}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-200 border border-blue-700/50 shadow-sm"
                >
                  📍 {loc.name} <strong className="text-blue-300">({loc.count})</strong>
                </span>
              ))}
              {locationList.length === 0 && (
                <span className="text-[10px] text-slate-500 italic">No locations extracted</span>
              )}
            </div>
          </div>

          {/* Impact Categories Breakdown */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Impact Categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categoryEntries.map(([cat, count]) => {
                const badge = getCategoryBadge(cat);
                const label = getCategoryDisplay(cat);
                return (
                  <span
                    key={cat}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge}`}
                  >
                    {label} <strong className="ml-1 opacity-90">({count})</strong>
                  </span>
                );
              })}
              {categoryEntries.length === 0 && (
                <span className="text-[10px] text-slate-500 italic">No category data</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-cyan-500/15 text-[10px] text-slate-400">
          <span className="text-cyan-400/90 font-medium">MapAki GeoJSON Ready</span>
          <span className="text-slate-500">Live coordinates validated</span>
        </div>
      </div>
    </div>
  );
}
