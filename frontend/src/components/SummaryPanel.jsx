import React from 'react';
import { Loader2 } from 'lucide-react';
import { getCategoryBadge, getCategoryDisplay } from '../utils/categories';

export default function SummaryPanel({
  summary,
  filteredRelevantCount,
  totalRelevantCount,
  topLocations,
  byCategory,
  onRequestSummary,
  isLoadingSummary,
  filterLocation,
  setFilterLocation,
  filterCategory,
  setFilterCategory,
}) {
  const locationList = topLocations || [];
  const categoryEntries = Object.entries(byCategory || {}).sort((a, b) => b[1] - a[1]);
  const isPlaceholder =
    !summary ||
    summary.toLowerCase().includes('[placeholder') ||
    summary.toLowerCase().includes('placeholder summary');

  return (
    <div className="p-2 sm:px-3 sm:py-2 flex flex-col justify-between h-full gap-1.5">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono font-semibold">
            Situation Summary
          </span>

          {!isPlaceholder ? (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
              Gemini Live
            </span>
          ) : (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
              Placeholder Summary
            </span>
          )}

          <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">
            ({filteredRelevantCount}/{totalRelevantCount} reports)
          </span>
        </div>

        <button
          id="btn-regenerate-summary"
          type="button"
          onClick={onRequestSummary}
          disabled={isLoadingSummary}
          className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
          title="Re-generate situational overview"
        >
          {isLoadingSummary && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          <span>{isLoadingSummary ? 'Updating...' : 'Re-generate'}</span>
        </button>
      </div>

      {/* Un-truncated Summary Text with Scrollable Area */}
      <div className="max-h-24 overflow-y-auto pr-1">
        <p className="text-xs text-zinc-800 leading-snug font-normal">
          {summary || 'Generating real-time emergency intelligence summary from active flood signals...'}
        </p>
      </div>

      {/* Interactive Location & Category Pills */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 overflow-x-auto whitespace-nowrap pt-0.5">
        <span className="font-semibold text-zinc-600 shrink-0">Hotspots:</span>
        <div className="flex items-center gap-1 shrink-0">
          {locationList.slice(0, 4).map((loc) => {
            const isSelected = filterLocation === loc.name;
            return (
              <button
                key={loc.name}
                type="button"
                onClick={() => setFilterLocation?.(isSelected ? '' : loc.name)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer text-[10px] border ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                    : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 hover:border-zinc-300'
                }`}
                title={isSelected ? `Clear filter: ${loc.name}` : `Filter feed to ${loc.name}`}
              >
                {loc.name} <strong className="font-mono">({loc.count})</strong>
              </button>
            );
          })}
          {locationList.length === 0 && <span className="text-zinc-400">None detected</span>}
        </div>

        {categoryEntries.length > 0 && (
          <>
            <span className="text-zinc-300">|</span>
            <div className="flex items-center gap-1 shrink-0">
              {categoryEntries.slice(0, 4).map(([cat, count]) => {
                const label = getCategoryDisplay(cat);
                const isSelected = filterCategory === cat || filterCategory === label;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory?.(isSelected ? '' : (label || cat))}
                    className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer text-[10px] border ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                        : `${getCategoryBadge(cat)} hover:opacity-80`
                    }`}
                    title={isSelected ? `Clear category filter: ${label}` : `Filter feed to ${label}`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
