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

/** Nice display labels for backend category keys */
const CATEGORY_LABELS = {
  infrastructure_damage: 'Infrastructure',
  evacuation: 'Evacuation',
  rescue_help: 'Rescue / Help',
  donations_volunteering: 'Donations',
  weather_water_levels: 'Weather / Water',
  sympathy_support: 'Sympathy',
  other_related: 'Other',
};

function categoryLabel(key) {
  if (!key) return 'Unknown';
  return CATEGORY_LABELS[key] || key.replace(/_/g, ' ');
}

function getCategoryColor(category) {
  if (!category) return 'bg-slate-700/40 text-slate-400';
  const cat = category.toLowerCase();
  if (cat.includes('rescue') || cat.includes('elder') || cat.includes('home'))
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30';
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge'))
    return 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30';
  if (cat.includes('evacuation'))
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
  if (cat.includes('weather') || cat.includes('water') || cat.includes('rising'))
    return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30';
  if (cat.includes('donation') || cat.includes('volunteer'))
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
  return 'bg-slate-700/40 text-slate-400';
}

function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'bg-emerald-500/15 text-emerald-300';
  if (confidence >= 0.5) return 'bg-amber-500/15 text-amber-300';
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

  // Client-side filtering for fallback mode or noise tab
  const displayTweets = useMemo(() => {
    // If in backend mode and on signal tab, tweets are already server-filtered
    if (!useFallback && activeTab === 'signal') return baseTweets;

    // Client-side filtering for fallback mode or noise tab
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
        return cat === filterCategory;
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
  }, [baseTweets, filterSearch, filterCategory, filterLocation, filterHasLocation, useFallback, activeTab]);

  // Build category pills from backend categories or fallback
  const categoryPills = useMemo(() => {
    if (categories && categories.length > 0) return categories;
    // Fallback categories
    return [
      'Elder / Home Water',
      'Submerged Road / Bridge',
      'Rising Water / Evacuation',
    ];
  }, [categories]);

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-800/80">
        <button
          id="tab-signal"
          onClick={() => setActiveTab('signal')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all ${
            activeTab === 'signal'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Signal className="w-3.5 h-3.5" />
          <span>Relevant Flood Reports</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400">
            {signalTweets.length}
          </span>
        </button>
        <button
          id="tab-noise"
          onClick={() => setActiveTab('noise')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all ${
            activeTab === 'noise'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldOff className="w-3.5 h-3.5" />
          <span>Filtered Out (Noise)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-400">
            {noiseTweets.length}
          </span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="p-3 border-b border-slate-800/60 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            id="input-search"
            type="text"
            placeholder="Search by tweet text or location..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
          />
        </div>

        {/* Category pills — only show for signal tab */}
        {activeTab === 'signal' && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCategory('')}
              className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${
                filterCategory === ''
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300'
              }`}
            >
              All
            </button>
            {categoryPills.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  filterCategory === cat
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        )}

        {/* Location dropdown + Mapped checkbox */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              id="select-location"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === '' ? 'All Locations' : loc}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none whitespace-nowrap">
            <button
              onClick={() =>
                setFilterHasLocation(filterHasLocation ? null : true)
              }
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              {filterHasLocation ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            Mapped Only
          </label>
        </div>

        <p className="text-[10px] text-slate-500">
          Showing {displayTweets.length} tweets
        </p>
      </div>

      {/* Tweet List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {displayTweets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No tweets match your filters.</p>
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
  const category = tweet.category || tweet.impact_category || null;
  const confidence = tweet.confidence ?? null;
  const isRelevant = tweet.relevant ?? tweet.is_relevant ?? false;
  const timestamp = tweet.created_at || tweet.timestamp || null;

  return (
    <div className="tweet-card p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 space-y-2 animate-fade-in">
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Relevance badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            isRelevant
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-slate-700/40 text-slate-500'
          }`}
        >
          {isRelevant ? 'RELEVANT' : 'NOISE'}
        </span>

        {/* Category badge */}
        {category && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(category)}`}>
            {categoryLabel(category)}
          </span>
        )}

        {/* Confidence */}
        {confidence != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getConfidenceColor(confidence)}`}>
            {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Tweet text */}
      <p className="text-xs text-slate-300 leading-relaxed">{text}</p>

      {/* Footer: location + timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {loc?.name && coordsAvailable && (
            <button
              onClick={() => onFlyTo({ lat: loc.lat, lng: loc.lng })}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors group"
            >
              <Navigation className="w-3 h-3 group-hover:scale-110 transition-transform" />
              {loc.name}
            </button>
          )}
          {loc?.name && !coordsAvailable && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <MapPin className="w-3 h-3" />
              {loc.name}
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
