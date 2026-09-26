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
  signalTweets = [],
  noiseTweets = [],
  signalTotal = 0,
  noiseTotal = 0,
  categories = [],
  stats = null,
  useFallback = false,
  onFlyTo = () => {},
  filterCategory = '',
  setFilterCategory = () => {},
  filterSearch = '',
  setFilterSearch = () => {},
  filterLocation = '',
  setFilterLocation = () => {},
  filterHasLocation = null,
  setFilterHasLocation = () => {},
  filterDisasterType = '',
  setFilterDisasterType = () => {},
  filterSort = '',
  setFilterSort = () => {},
  offset = 0,
  setOffset = () => {},
  limit = 200,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) {
  const [localActiveTab, setLocalActiveTab] = useState('signal');
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;

  // Active set
  const baseTweets = activeTab === 'signal' ? signalTweets : noiseTweets;

  // Client-side filtering in fallback mode
  const displayTweets = useMemo(() => {
    if (!useFallback) {
      // In backend mode, filtering and slicing are handled on the server
      return baseTweets;
    }

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
  }, [baseTweets, filterSearch, filterCategory, filterLocation, filterHasLocation, activeTab, useFallback]);

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

  // Non-flood disaster types from stats.by_disaster_type
  const otherDisasterTypes = useMemo(() => {
    if (!stats?.by_disaster_type) return [];
    return Object.entries(stats.by_disaster_type)
      .filter(([type]) => type.toLowerCase() !== 'flood')
      .sort((a, b) => b[1] - a[1]);
  }, [stats?.by_disaster_type]);

  const currentTotal = activeTab === 'signal' ? (signalTotal ?? signalTweets.length) : (noiseTotal ?? noiseTweets.length);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setOffset(0);
    if (newTab === 'signal') {
      setFilterDisasterType('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded border border-zinc-200 overflow-hidden">
      {/* Clean Utilitarian Tabs */}
      <div className="flex border-b border-zinc-200 bg-zinc-50 shrink-0">
        <button
          id="tab-signal"
          type="button"
          onClick={() => handleTabChange('signal')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'signal'
              ? 'bg-white text-zinc-900 border-b-2 border-zinc-900 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Flood Reports (Signal)</span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
            {(signalTotal != null ? signalTotal : signalTweets.length).toLocaleString()}
          </span>
        </button>
        <button
          id="tab-noise"
          type="button"
          onClick={() => handleTabChange('noise')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'noise'
              ? 'bg-white text-zinc-900 border-b-2 border-zinc-900 font-bold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Other Disasters / Filtered Out</span>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
            {(noiseTotal != null ? noiseTotal : noiseTweets.length).toLocaleString()}
          </span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-2.5 border-b border-zinc-200 space-y-2 bg-zinc-50/50 shrink-0">
        {/* Search & Sort Toggle Row */}
        <div className="flex items-center gap-2">
          <input
            id="input-search"
            type="text"
            placeholder="Search keyword or text..."
            value={filterSearch}
            onChange={(e) => {
              setFilterSearch(e.target.value);
              setOffset(0);
            }}
            className="flex-1 px-2.5 py-1 rounded border border-zinc-300 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
          />

          {/* Severity Sort Toggle */}
          <button
            id="btn-toggle-sort"
            type="button"
            onClick={() => {
              setFilterSort((prev) => (prev === 'severity' ? '' : 'severity'));
              setOffset(0);
            }}
            className={`px-2 py-1 rounded border text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
              filterSort === 'severity'
                ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
            }`}
            title="Sort critical and high severity events to top"
          >
            {filterSort === 'severity' ? 'Sort: Severity ⚡' : 'Sort: Default'}
          </button>
        </div>

        {/* Tab 1: Category Filter Pills */}
        {activeTab === 'signal' && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setFilterCategory('');
                setOffset(0);
              }}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors cursor-pointer ${
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
                  type="button"
                  onClick={() => {
                    setFilterCategory(isSelected ? '' : cat.key);
                    setOffset(0);
                  }}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 border transition-colors cursor-pointer ${
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

        {/* Tab 2: Non-Flood Other Disaster Type Chips */}
        {activeTab === 'noise' && otherDisasterTypes.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-0.5 scrollbar-thin">
            <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider shrink-0">
              Disasters:
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterDisasterType('');
                setOffset(0);
              }}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
                filterDisasterType === ''
                  ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              All Non-Flood
            </button>
            {otherDisasterTypes.map(([type, count]) => {
              const isSelected = filterDisasterType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setFilterDisasterType(isSelected ? '' : type);
                    setOffset(0);
                  }}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  <span>{type}</span>
                  <span className="opacity-70 tabular-nums">({count.toLocaleString()})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Location Datalist Input & Mapped Only Checkbox */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="input-location-datalist"
              type="text"
              list="top-locations-list"
              placeholder="Filter place, city, or country..."
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setOffset(0);
              }}
              className="w-full px-2 py-1 rounded border border-zinc-300 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500"
            />
            <datalist id="top-locations-list">
              {(stats?.top_locations || []).map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name} ({loc.count} mentions)
                </option>
              ))}
            </datalist>
          </div>

          {filterLocation && (
            <button
              type="button"
              onClick={() => {
                setFilterLocation('');
                setOffset(0);
              }}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
            >
              Clear
            </button>
          )}

          <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer select-none whitespace-nowrap bg-white px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50">
            <input
              type="checkbox"
              checked={filterHasLocation === true}
              onChange={() => {
                setFilterHasLocation(filterHasLocation ? null : true);
                setOffset(0);
              }}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 cursor-pointer"
            />
            <span>Mapped only</span>
          </label>
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

      {/* Pagination Bar */}
      <div className="p-2 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs font-mono tabular-nums shrink-0">
        <span className="text-zinc-600">
          Showing{' '}
          <strong className="text-zinc-900">
            {currentTotal === 0 ? 0 : offset + 1}
          </strong>
          –
          <strong className="text-zinc-900">
            {Math.min(offset + limit, currentTotal).toLocaleString()}
          </strong>{' '}
          of{' '}
          <strong className="text-zinc-900">
            {currentTotal.toLocaleString()}
          </strong>{' '}
          tweets
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 font-medium cursor-pointer"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= currentTotal}
            className="px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 font-medium cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function TweetRow({ tweet, onFlyTo }) {
  const loc = getFirstLocation(tweet);
  const coordsAvailable = loc?.lat != null && loc?.lng != null;
  const text = tweet.text || tweet.tweet_text || '';
  const rawCategory = tweet.category || tweet.impact_category || null;
  const severity = tweet.severity?.toLowerCase();
  const confidence = tweet.confidence ?? null;
  const timestamp = tweet.created_at || tweet.timestamp || null;
  const markerColors = getMarkerColor(rawCategory);

  // Severity color badge
  let sevClass = 'bg-zinc-100 text-zinc-600 border-zinc-200';
  if (severity === 'critical') sevClass = 'bg-red-950 text-red-200 border-red-800';
  else if (severity === 'high') sevClass = 'bg-red-100 text-red-800 border-red-300';
  else if (severity === 'medium') sevClass = 'bg-amber-100 text-amber-800 border-amber-300';
  else if (severity === 'low') sevClass = 'bg-zinc-100 text-zinc-600 border-zinc-200';

  return (
    <div className="p-2.5 bg-white hover:bg-zinc-50/80 transition-colors">
      {/* Category line & Severity Badge */}
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

          {severity && (
            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold ${sevClass}`}>
              {severity}
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
