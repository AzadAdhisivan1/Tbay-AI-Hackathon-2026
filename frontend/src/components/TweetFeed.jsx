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

const IMPACT_CATEGORIES = [
  'All',
  'Elder / Home Water',
  'Submerged Road / Bridge',
  'Rising Water / Evacuation',
];

/** Map raw category to display pill */
function matchCategory(tweetCat, filterCat) {
  if (filterCat === 'All') return true;
  if (!tweetCat) return false;
  const tc = tweetCat.toLowerCase();
  const fc = filterCat.toLowerCase();
  if (fc.includes('elder') && (tc.includes('elder') || tc.includes('home'))) return true;
  if (fc.includes('road') && (tc.includes('road') || tc.includes('bridge') || tc.includes('infrastructure')))
    return true;
  if (fc.includes('rising') && (tc.includes('rising') || tc.includes('evacuation') || tc.includes('general')))
    return true;
  return false;
}

function getCategoryColor(category) {
  if (!category) return 'bg-slate-700/40 text-slate-400';
  const cat = category.toLowerCase();
  if (cat.includes('elder') || cat.includes('home'))
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30';
  if (cat.includes('road') || cat.includes('bridge'))
    return 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30';
  return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30';
}

function getUrgencyColor(urgency) {
  if (urgency === 'high') return 'bg-rose-500/15 text-rose-300';
  if (urgency === 'medium') return 'bg-amber-500/15 text-amber-300';
  return 'bg-slate-700/40 text-slate-400';
}

export default function TweetFeed({
  allTweets,
  onFlyTo,
}) {
  const [activeTab, setActiveTab] = useState('signal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [mappedOnly, setMappedOnly] = useState(false);

  // Split signal vs noise
  const signalTweets = useMemo(
    () => allTweets.filter((t) => t.is_relevant),
    [allTweets]
  );
  const noiseTweets = useMemo(
    () => allTweets.filter((t) => !t.is_relevant),
    [allTweets]
  );

  // Unique locations for dropdown
  const locations = useMemo(() => {
    const locs = new Set();
    signalTweets.forEach((t) => {
      if (t.location_name) locs.add(t.location_name);
    });
    return ['All', ...Array.from(locs).sort()];
  }, [signalTweets]);

  // Active set for filtering
  const baseTweets = activeTab === 'signal' ? signalTweets : noiseTweets;

  // Apply filters
  const filteredTweets = useMemo(() => {
    let result = baseTweets;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.tweet_text?.toLowerCase().includes(q) ||
          t.location_name?.toLowerCase().includes(q)
      );
    }

    // Category filter (only for signal tab)
    if (activeTab === 'signal' && selectedCategory !== 'All') {
      result = result.filter((t) => matchCategory(t.impact_category, selectedCategory));
    }

    // Location filter
    if (selectedLocation !== 'All') {
      result = result.filter((t) => t.location_name === selectedLocation);
    }

    // Mapped only
    if (mappedOnly) {
      result = result.filter((t) => t.lat != null && t.lng != null);
    }

    return result;
  }, [baseTweets, searchQuery, selectedCategory, selectedLocation, mappedOnly, activeTab]);

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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
          />
        </div>

        {/* Category pills — only show for signal tab */}
        {activeTab === 'signal' && (
          <div className="flex flex-wrap gap-1.5">
            {IMPACT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Location dropdown + Mapped checkbox */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              id="select-location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === 'All' ? 'All Locations' : loc}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none whitespace-nowrap">
            <button
              onClick={() => setMappedOnly(!mappedOnly)}
              className="text-slate-400 hover:text-indigo-400 transition-colors"
            >
              {mappedOnly ? (
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            Mapped Only
          </label>
        </div>

        <p className="text-[10px] text-slate-500">
          Showing {filteredTweets.length} of {baseTweets.length} tweets
        </p>
      </div>

      {/* Tweet List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredTweets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No tweets match your filters.</p>
          </div>
        )}

        {filteredTweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} onFlyTo={onFlyTo} />
        ))}
      </div>
    </div>
  );
}

function TweetCard({ tweet, onFlyTo }) {
  const hasCoords = tweet.lat != null && tweet.lng != null;

  return (
    <div className="tweet-card p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 space-y-2 animate-fade-in">
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Relevance badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            tweet.is_relevant
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-slate-700/40 text-slate-500'
          }`}
        >
          {tweet.is_relevant ? 'RELEVANT' : 'NOISE'}
        </span>

        {/* Category badge */}
        {tweet.impact_category && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(tweet.impact_category)}`}>
            {tweet.impact_category}
          </span>
        )}

        {/* Urgency */}
        {tweet.urgency && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getUrgencyColor(tweet.urgency)}`}>
            {tweet.urgency.toUpperCase()}
          </span>
        )}
      </div>

      {/* Tweet text */}
      <p className="text-xs text-slate-300 leading-relaxed">{tweet.tweet_text}</p>

      {/* Footer: location + timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {tweet.location_name && hasCoords && (
            <button
              onClick={() => onFlyTo({ lat: tweet.lat, lng: tweet.lng })}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors group"
            >
              <Navigation className="w-3 h-3 group-hover:scale-110 transition-transform" />
              {tweet.location_name}
            </button>
          )}
          {tweet.location_name && !hasCoords && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <MapPin className="w-3 h-3" />
              {tweet.location_name}
            </span>
          )}
        </div>

        {tweet.timestamp && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
            <Clock className="w-3 h-3" />
            {new Date(tweet.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
