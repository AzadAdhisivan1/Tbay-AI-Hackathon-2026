import React, { useState, useMemo, useCallback } from 'react';
import Header from './components/Header';
import KPIStrip from './components/KPIStrip';
import SummaryPanel from './components/SummaryPanel';
import FloodMap from './components/FloodMap';
import TweetFeed from './components/TweetFeed';
import { loadProvidedDataset, uploadCustomCSV, tweetsToGeoJSON } from './api';
import { FALLBACK_TWEETS, FALLBACK_SUMMARY } from './data/fallbackData';
import { Sparkles, Eye, EyeOff, Layers } from 'lucide-react';

export default function App() {
  // Core data state
  const [tweets, setTweets] = useState(FALLBACK_TWEETS);
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState('fallback');

  // Map state
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [flyTo, setFlyTo] = useState(null);

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }, []);

  // Derived data
  const relevantTweets = useMemo(() => tweets.filter((t) => t.is_relevant), [tweets]);
  const mappedTweets = useMemo(
    () => relevantTweets.filter((t) => t.lat != null && t.lng != null),
    [relevantTweets]
  );

  // Location and impact breakdowns for the summary panel
  const locationBreakdown = useMemo(() => {
    const counts = {};
    relevantTweets.forEach((t) => {
      if (t.location_name) {
        counts[t.location_name] = (counts[t.location_name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [relevantTweets]);

  const impactBreakdown = useMemo(() => {
    const counts = {};
    relevantTweets.forEach((t) => {
      if (t.impact_category) {
        counts[t.impact_category] = (counts[t.impact_category] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [relevantTweets]);

  // ── Actions ──

  /** Normalize backend response into tweet array */
  const normalizeBackendData = (data) => {
    if (!data) return null;
    let tweetList = [];
    let summaryText = FALLBACK_SUMMARY;

    if (data.summary) summaryText = data.summary;
    if (Array.isArray(data.tweets)) tweetList = data.tweets;
    else if (Array.isArray(data.results)) tweetList = data.results;
    else if (Array.isArray(data)) tweetList = data;

    // Ensure each tweet has an id
    tweetList = tweetList.map((t, i) => ({
      id: t.id || i + 1,
      tweet_text: t.tweet_text || t.text || t.content || '',
      is_relevant: t.is_relevant ?? t.relevant ?? true,
      location_name: t.location_name || t.location || null,
      lat: t.lat != null ? Number(t.lat) : null,
      lng: t.lng != null ? Number(t.lng) : null,
      impact_category: t.impact_category || t.category || null,
      urgency: t.urgency || null,
      timestamp: t.timestamp || t.created_at || null,
    }));

    return { tweets: tweetList, summary: summaryText };
  };

  const handleLoadDataset = async () => {
    setIsLoading(true);
    try {
      const res = await loadProvidedDataset();
      if (res.success && res.data) {
        const normalized = normalizeBackendData(res.data);
        if (normalized && normalized.tweets.length > 0) {
          setTweets(normalized.tweets);
          setSummary(normalized.summary);
          setDataSource('backend');
          showToast({ type: 'success', text: 'Dataset loaded from backend API!' });
        } else {
          // Backend returned empty data, use fallback
          setTweets(FALLBACK_TWEETS);
          setSummary(FALLBACK_SUMMARY);
          setDataSource('fallback');
          showToast({ type: 'info', text: 'Backend returned empty data. Loaded built-in demo dataset.' });
        }
      } else {
        // Backend unreachable, use fallback
        setTweets(FALLBACK_TWEETS);
        setSummary(FALLBACK_SUMMARY);
        setDataSource('fallback');
        showToast({
          type: 'warning',
          text: 'Backend offline — loaded built-in First Nations flood demo dataset.',
        });
      }
    } catch (err) {
      setTweets(FALLBACK_TWEETS);
      setSummary(FALLBACK_SUMMARY);
      setDataSource('fallback');
      showToast({ type: 'error', text: 'Error loading dataset. Using fallback data.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadCSV = async (file) => {
    setIsLoading(true);
    try {
      const res = await uploadCustomCSV(file);
      if (res.success && res.data) {
        const normalized = normalizeBackendData(res.data);
        if (normalized && normalized.tweets.length > 0) {
          setTweets(normalized.tweets);
          setSummary(normalized.summary);
          setDataSource('upload');
          showToast({ type: 'success', text: `CSV "${file.name}" processed! ${normalized.tweets.length} tweets loaded.` });
        } else {
          showToast({ type: 'warning', text: 'CSV processed but no tweets returned. Check CSV format.' });
        }
      } else {
        showToast({
          type: 'error',
          text: `CSV upload failed: ${res.error || 'Backend unreachable'}. Ensure backend is running.`,
        });
      }
    } catch (err) {
      showToast({ type: 'error', text: 'Error uploading CSV file.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportGeoJSON = () => {
    const geojson = tweetsToGeoJSON(relevantTweets);
    const blob = new Blob([geojson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'living_flood_map_export.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ type: 'success', text: 'GeoJSON exported successfully!' });
  };

  const handleFlyTo = useCallback((coords) => {
    setFlyTo({ ...coords, _ts: Date.now() });
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        onLoadDataset={handleLoadDataset}
        onUploadCSV={handleUploadCSV}
        onExportGeoJSON={handleExportGeoJSON}
        isLoading={isLoading}
        hasData={tweets.length > 0}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-medium backdrop-blur-xl max-w-sm ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toastMessage.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-4 p-4 lg:px-6 max-w-[1800px] w-full mx-auto">
        {/* Data Source Banner */}
        <div className="rounded-lg bg-slate-900/40 border border-slate-800 px-3 py-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Data Source:{' '}
            <strong className="text-slate-300">
              {dataSource === 'backend'
                ? 'Backend API'
                : dataSource === 'upload'
                ? 'Custom CSV Upload'
                : 'Built-in Demo Dataset (First Nations Flood Events)'}
            </strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${tweets.length > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            {tweets.length} tweets loaded
          </span>
        </div>

        {/* KPI Strip */}
        <KPIStrip
          tweets={tweets}
          relevantTweets={relevantTweets}
          mappedTweets={mappedTweets}
        />

        {/* AI Summary Panel */}
        <SummaryPanel
          summary={summary}
          filteredRelevantCount={relevantTweets.length}
          totalRelevantCount={relevantTweets.length}
          locationBreakdown={locationBreakdown}
          impactBreakdown={impactBreakdown}
        />

        {/* Split Workspace: Map (60%) + Feed (40%) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0" style={{ minHeight: '520px' }}>
          {/* Map Panel */}
          <div className="lg:w-[60%] flex flex-col gap-2 min-h-[400px] lg:min-h-0">
            {/* Map toolbar */}
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Interactive Flood Map
              </h2>
              <button
                id="btn-toggle-heatmap"
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:border-indigo-500/40 transition-all"
              >
                {showHeatmap ? (
                  <Eye className="w-3 h-3 text-indigo-400" />
                ) : (
                  <EyeOff className="w-3 h-3 text-slate-500" />
                )}
                Activity Concentration
              </button>
            </div>

            {/* Map Legend */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Elder / Home
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Road / Bridge
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Rising Water
              </span>
              {showHeatmap && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/40 ring-1 ring-indigo-400/40" />
                  Concentration
                </span>
              )}
            </div>

            {/* Map */}
            <div className="flex-1 min-h-0">
              <FloodMap
                tweets={relevantTweets}
                showHeatmap={showHeatmap}
                flyTo={flyTo}
              />
            </div>
          </div>

          {/* Tweet Feed Panel */}
          <div className="lg:w-[40%] min-h-[400px] lg:min-h-0">
            <TweetFeed allTweets={tweets} onFlyTo={handleFlyTo} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3 px-4 text-center text-xs text-slate-400">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; 2026 CE Strategies &bull; ThunderBay AI Hackathon</p>
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Built with React 19 + Vite + Tailwind CSS + Leaflet
          </p>
        </div>
      </footer>
    </div>
  );
}
