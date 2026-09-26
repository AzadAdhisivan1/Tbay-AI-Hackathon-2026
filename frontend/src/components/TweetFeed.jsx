import React, { useState, useMemo } from 'react';
import {
  SYNCED_CATEGORIES,
  getMarkerColor,
  getCategoryDisplay,
  matchesCategory,
} from '../utils/categories';

/**
 * Extract the first location with coords from a tweet.
 * Backend shape: tweet.locations = [{name, lat, lon}]
 * Fallback shape: tweet.lat, tweet.lng, tweet.location_name
 */
function getFirstLocation(tweet) {
  if (tweet.locations?.length > 0) {
    const loc = tweet.locations[0];
    if (loc.lat != null && loc.lon != null) {
      return { name: loc.name, lat: loc.lat, lng: loc.lon };
    }
    return { name: loc.name, lat: null, lng: null };
  }
  // Fallback shape
  if (tweet.location_name) {
    return { name: tweet.location_name, lat: tweet.lat ?? null, lng: tweet.lng ?? null };
  }
  return null;
}

function getLocationName(tweet) {
  const loc = getFirstLocation(tweet);
  return loc?.name || null;
}

function hasCoords(tweet) {
  const loc = getFirstLocation(tweet);
  return loc?.lat != null && loc?.lng != null;
}

export default function TweetFeed({
  signalTweets,
  noiseTweets,
  signalTotal,
  noiseTotal,
  categories,
  useFallback,
  onFlyTo,
  filterCategory,
  setFilterCategory,
  filterSearch,
  setFilterSearch,
  filterLocation,
  setFilterLocation,
  filterHasLocation,
  setFilterHasLocation,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) {
  const [localActiveTab, setLocalActiveTab] = useState('signal');
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;

  // Unique locations for dropdown (from signal tweets)
  const locations = useMemo(() => {
    const locs = new Set();
    signalTweets.forEach((t) => {
      const name = getLocationName(t);
      if (name) locs.add(name);
    });
    return ['', ...Array.from(locs).sort()];
  }, [signalTweets]);

  // Active set
  const baseTweets = activeTab === 'signal' ? signalTweets : noiseTweets;

  // Filtering for fallback mode or noise tab (and active signal filtering)
  const displayTweets = useMemo(() => {
    let result = baseTweets;

    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      result = result.filter((t) => {
        const text = (t.text || t.tweet_text || '').toLowerCase();
        const loc = getLocationName(t)?.toLowerCase() || '';
        return text.includes(q) || loc.includes(q);
      });
    }

    if (filterCategory && activeTab === 'signal') {
      result = result.filter((t) => {
        const cat = t.category || t.impact_category || '';
        return matchesCategory(cat, filterCategory);
      });
    }

    if (filterLocation) {
      result = result.filter((t) => {
        const name = getLocationName(t) || '';
        return name.toLowerCase().includes(filterLocation.toLowerCase());
      });
    }

    if (filterHasLocation) {
      result = result.filter(hasCoords);
    }

    return result;
  }, [baseTweets, filterSearch, filterCategory, filterLocation, filterHasLocation, activeTab]);

  // Category filter pills: standard 4 synced categories, plus any extra backend categories
  const categoryPills = useMemo(() => {
    const pills = [...SYNCED_CATEGORIES];

    if (categories && categories.length > 0) {
      categories.forEach((catKey) => {
        const alreadyCovered = pills.some((p) => matchesCategory(catKey, p.key));
        if (!alreadyCovered) {
          pills.push({
            key: catKey,
            label: getCategoryDisplay(catKey),
            altLabel: catKey,
            colorHex: '#71717a',
            strokeHex: '#52525b',
            dotBg: 'bg-zinc-500',
          });
        }
      });
    }

    return pills;
  }, [categories]);

  const currentTotal = activeTab === 'signal' ? (signalTotal ?? signalTweets.length) : (noiseTotal ?? noiseTweets.length);

  return (
    <div className="flex flex-col h-full bg-white rounded border border-zinc-200 overflow-hidden">
      {/* Clean Utilitarian Tabs - No decorative icons */}
      <div className="flex border-b border-zinc-200 bg-zinc-50">
        <button
          id="tab-signal"
          onClick={() => setActiveTab('signal')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'signal'
              ? 'bg-white text-zinc-900 border-b-2 border-zinc-900 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Relevant Signal</span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
            {(signalTotal != null ? signalTotal : signalTweets.length).toLocaleString()}
          </span>
        </button>
        <button
          id="tab-noise"
          onClick={() => setActiveTab('noise')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'noise'
              ? 'bg-white text-zinc-900 border-b-2 border-zinc-900 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Filtered Noise</span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
            {(noiseTotal != null ? noiseTotal : noiseTweets.length).toLocaleString()}
          </span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-2.5 border-b border-zinc-200 space-y-2 bg-zinc-50/50">
        {/* Search */}
        <input
          id="input-search"
          type="text"
          placeholder="Filter by keyword or location..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded border border-zinc-300 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
        />

        {/* Category Pills - Sharp rounded utilitarian buttons with 6px dot */}
        {activeTab === 'signal' && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setFilterCategory('')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                filterCategory === ''
                  ? 'bg-zinc-900 text-white font-medium'
                  : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              All
            </button>
            {categoryPills.map((cat) => {
              const isSelected = filterCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setFilterCategory(isSelected ? '' : cat.key)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 border transition-colors ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dotBg}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Location Dropdown & Mapped Filter */}
        <div className="flex items-center gap-2">
          <select
            id="select-location"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="flex-1 px-2 py-1 rounded border border-zinc-300 bg-white text-xs text-zinc-800 focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc === '' ? 'All Locations' : loc}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer select-none whitespace-nowrap bg-white px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50">
            <input
              type="checkbox"
              checked={filterHasLocation === true}
              onChange={() => setFilterHasLocation(filterHasLocation ? null : true)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
            />
            <span>Mapped only</span>
          </label>
        </div>

        {/* Count Subheader - Monospace Tabular Nums */}
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500 pt-0.5">
          <span>
            {displayTweets.length < currentTotal ? (
              <>
                Showing <strong className="text-zinc-800 font-semibold">{displayTweets.length.toLocaleString()}</strong> of{' '}
                <strong className="text-zinc-800 font-semibold">{currentTotal.toLocaleString()}</strong> tweets
              </>
            ) : (
              <>
                Showing <strong className="text-zinc-800 font-semibold">{displayTweets.length.toLocaleString()}</strong> tweets
              </>
            )}
          </span>
          {filterCategory && (
            <span className="text-zinc-700">
              [{filterCategory}]
              <button
                onClick={() => setFilterCategory('')}
                className="ml-1 text-zinc-400 hover:text-zinc-700 underline text-[10px]"
              >
                clear
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Flush Divide-y List Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-200">
        {displayTweets.length === 0 && (
          <div className="p-8 text-center text-zinc-400 text-xs font-mono">
            No reports match the active filter criteria.
          </div>
        )}

        {displayTweets.map((tweet) => (
          <TweetRow key={tweet.id} tweet={tweet} onFlyTo={onFlyTo} />
        ))}
      </div>
    </div>
  );
}

function TweetRow({ tweet, onFlyTo }) {
  const loc = getFirstLocation(tweet);
  const coordsAvailable = loc?.lat != null && loc?.lng != null;
  const text = tweet.text || tweet.tweet_text || '';
  const rawCategory = tweet.category || tweet.impact_category || null;
  const confidence = tweet.confidence ?? null;
  const timestamp = tweet.created_at || tweet.timestamp || null;
  const markerColors = getMarkerColor(rawCategory);

  return (
    <div className="p-2.5 bg-white hover:bg-zinc-50/80 transition-colors">
      {/* Category line with tiny 6px colored dot (No redundant "RELEVANT" badge) */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {rawCategory ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: markerColors.fill }}
              />
              <span>{getCategoryDisplay(rawCategory)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
              <span>Report</span>
            </span>
          )}

          {confidence != null && (
            <span className="text-[10px] font-mono tabular-nums text-zinc-400">
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {timestamp && (
          <span className="text-[10px] font-mono tabular-nums text-zinc-400 shrink-0">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Tweet Body */}
      <p className="text-xs text-zinc-800 leading-normal mt-1 font-normal select-text">
        {text}
      </p>

      {/* Location Link or No-Location Label */}
      {loc?.name ? (
        <div className="mt-1.5 pt-1 flex items-center justify-between text-[11px]">
          {coordsAvailable ? (
            <button
              type="button"
              onClick={() => onFlyTo({ lat: loc.lat, lng: loc.lng })}
              className="text-zinc-700 hover:text-zinc-900 font-medium underline inline-flex items-center gap-1 transition-colors cursor-pointer"
              title="Click to frame coordinates on map"
            >
              <span>📍 {loc.name}</span>
            </button>
          ) : (
            <span className="text-zinc-400 inline-flex items-center gap-1">
              <span>📍 {loc.name}</span>
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1.5 pt-1 flex items-center text-[11px] text-zinc-400 italic">
          <span>No specific location mentioned · Feed only</span>
        </div>
      )}
    </div>
  );
}
