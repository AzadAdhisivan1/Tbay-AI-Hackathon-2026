import React, { useState, useMemo } from 'react';
import {
  Search,
  MapPin,
  CheckSquare,
  Square,
  Signal,
  ShieldOff,
  Clock,
  Navigation,
  ChevronDown,
} from 'lucide-react';
import {
  SYNCED_CATEGORIES,
  getCategoryBadge,
  getCategoryDisplay,
  matchesCategory,
} from '../utils/categories';

function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
  if (confidence >= 0.5) return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
  return 'bg-slate-700/40 text-slate-400';
}

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
  // Lifted filter state (so App.jsx can refetch from backend)
  filterCategory,
  setFilterCategory,
  filterSearch,
  setFilterSearch,
  filterLocation,
  setFilterLocation,
  filterHasLocation,
  setFilterHasLocation,
}) {
  const [activeTab, setActiveTab] = useState('signal');

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

    // If backend provided additional categories, append them if not already represented
    if (categories && categories.length > 0) {
      categories.forEach((catKey) => {
        const alreadyCovered = pills.some((p) => matchesCategory(catKey, p.key));
        if (!alreadyCovered) {
          pills.push({
            key: catKey,
            label: getCategoryDisplay(catKey),
            altLabel: catKey,
            badgeClass: getCategoryBadge(catKey),
            pillActiveClass: 'bg-indigo-600 text-white ring-2 ring-indigo-400',
            pillInactiveClass: 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-indigo-500/50 hover:text-indigo-200',
            dotBg: 'bg-indigo-500',
          });
        }
      });
    }

    return pills;
  }, [categories]);

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden ring-1 ring-slate-800/80 shadow-2xl">
      {/* Tabs */}
      <div className="flex border-b border-slate-800/80">
        <button
          id="tab-signal"
          onClick={() => setActiveTab('signal')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all ${
            activeTab === 'signal'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-950/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Signal className="w-3.5 h-3.5" />
          <span>Relevant Flood Reports</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 font-bold">
            {(signalTotal != null ? signalTotal : signalTweets.length).toLocaleString()}
          </span>
        </button>
        <button
          id="tab-noise"
          onClick={() => setActiveTab('noise')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all ${
            activeTab === 'noise'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-950/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <ShieldOff className="w-3.5 h-3.5" />
          <span>Filtered Out (Noise)</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 font-bold">
            {(noiseTotal != null ? noiseTotal : noiseTweets.length).toLocaleString()}
          </span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5 bg-slate-950/30">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            id="input-search"
            type="text"
            placeholder="Search by tweet text or location..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
          />
        </div>

        {/* Synced Category Filter Pills (Signal Tab only) */}
        {activeTab === 'signal' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setFilterCategory('')}
              className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all ${
                filterCategory === ''
                  ? 'bg-slate-100 text-slate-900 shadow-sm'
                  : 'bg-slate-800/70 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-700/60'
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
                  className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? cat.pillActiveClass
                      : cat.pillInactiveClass
                  }`}
                  title={`${cat.label} (Matches ${cat.altLabel || cat.label})`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.dotBg} shrink-0`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Location Dropdown & Mapped Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              id="select-location"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-all cursor-pointer"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc} className="bg-slate-900 text-slate-200">
                  {loc === '' ? 'All Locations' : loc}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none whitespace-nowrap bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all">
            <button
              type="button"
              onClick={() => setFilterHasLocation(filterHasLocation ? null : true)}
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              {filterHasLocation ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            <span>Mapped Only</span>
          </label>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>
            {(() => {
              const currentTotal = activeTab === 'signal' ? (signalTotal ?? signalTweets.length) : (noiseTotal ?? noiseTweets.length);
              if (displayTweets.length < currentTotal) {
                return (
                  <>
                    Showing <strong className="text-slate-200 font-semibold">{displayTweets.length.toLocaleString()}</strong> of{' '}
                    <strong className="text-slate-200 font-semibold">{currentTotal.toLocaleString()}</strong> tweets
                  </>
                );
              }
              return (
                <>
                  Showing <strong className="text-slate-200 font-semibold">{displayTweets.length.toLocaleString()}</strong> tweets
                </>
              );
            })()}
          </span>
          {filterCategory && (
            <span className="text-indigo-400 font-medium flex items-center gap-1">
              Filtered: {filterCategory}
              <button
                onClick={() => setFilterCategory('')}
                className="hover:text-white underline text-[9px]"
              >
                (clear)
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Tweet List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {displayTweets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2">
            <Search className="w-8 h-8 opacity-40" />
            <p className="text-xs font-medium">No tweets match the selected filters.</p>
            {(filterSearch || filterCategory || filterLocation || filterHasLocation) && (
              <button
                onClick={() => {
                  setFilterSearch('');
                  setFilterCategory('');
                  setFilterLocation('');
                  setFilterHasLocation(null);
                }}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}

        {displayTweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} onFlyTo={onFlyTo} />
        ))}
      </div>
    </div>
  );
}

function TweetCard({ tweet, onFlyTo }) {
  const loc = getFirstLocation(tweet);
  const coordsAvailable = loc?.lat != null && loc?.lng != null;
  const text = tweet.text || tweet.tweet_text || '';
  const rawCategory = tweet.category || tweet.impact_category || null;
  const confidence = tweet.confidence ?? null;
  const isRelevant = tweet.relevant ?? tweet.is_relevant ?? false;
  const timestamp = tweet.created_at || tweet.timestamp || null;

  return (
    <div className="tweet-card p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 animate-fade-in hover:border-slate-700 transition-all">
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Relevance badge */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isRelevant
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {isRelevant ? 'SIGNAL' : 'NOISE'}
        </span>

        {/* Category badge with synced color */}
        {rawCategory && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getCategoryBadge(rawCategory)}`}
          >
            {getCategoryDisplay(rawCategory)}
          </span>
        )}

        {/* Confidence score */}
        {confidence != null && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getConfidenceColor(confidence)}`}
          >
            {(confidence * 100).toFixed(0)}% conf
          </span>
        )}
      </div>

      {/* Tweet text */}
      <p className="text-xs text-slate-200 leading-relaxed font-normal">{text}</p>

      {/* Footer: location + timestamp */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-2 flex-wrap">
          {loc?.name && coordsAvailable && (
            <button
              onClick={() => onFlyTo({ lat: loc.lat, lng: loc.lng })}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors group"
              title="Click to zoom to location on map"
            >
              <Navigation className="w-3 h-3 group-hover:scale-125 transition-transform text-blue-400" />
              <span>{loc.name}</span>
            </button>
          )}
          {loc?.name && !coordsAvailable && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <MapPin className="w-3 h-3 text-slate-500" />
              <span>{loc.name}</span>
            </span>
          )}
        </div>

        {timestamp && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
            <Clock className="w-3 h-3" />
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
