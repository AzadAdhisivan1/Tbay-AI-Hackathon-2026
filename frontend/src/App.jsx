import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Header from './components/Header';
import KPIStrip from './components/KPIStrip';
import SummaryPanel from './components/SummaryPanel';
import FloodMap from './components/FloodMap';
import TweetFeed from './components/TweetFeed';
import {
  checkHealth,
  fetchCategories,
  fetchDatasets,
  fetchStats,
  fetchTweets,
  fetchGeoJSON,
  fetchSummary,
  uploadAndWait,
  downloadGeoJSON,
} from './api';
import { FALLBACK_TWEETS, FALLBACK_SUMMARY } from './data/fallbackData';
import { Sparkles, Eye, EyeOff, Layers, Loader2 } from 'lucide-react';

/** Default dataset id the backend auto-creates from the provided CSV. */
const SAMPLE_DATASET_ID = 'sample';

export default function App() {
  // ── Connection & loading state ──
  const [backendOnline, setBackendOnline] = useState(null); // null = checking
  const [isLoading, setIsLoading] = useState(false);
  const [jobProgress, setJobProgress] = useState(null); // {status, stage, processed, total}

  // ── Active dataset ──
  const [datasetId, setDatasetId] = useState(null);
  const [dataSource, setDataSource] = useState('none'); // 'backend' | 'upload' | 'fallback'

  // ── Data from backend ──
  const [stats, setStats] = useState(null);
  const [signalTweets, setSignalTweets] = useState([]);
  const [noiseTweets, setNoiseTweets] = useState([]);
  const [geojson, setGeojson] = useState(null);
  const [summary, setSummary] = useState('');
  const [categories, setCategories] = useState([]);

  // ── Filters (shared between tweet list and map) ──
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterHasLocation, setFilterHasLocation] = useState(null);

  // ── Fallback mode data ──
  const [useFallback, setUseFallback] = useState(false);

  // ── Map state ──
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [flyTo, setFlyTo] = useState(null);

  // ── Toast ──
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }, []);

  // ── Fallback-mode derived data ──
  const fallbackRelevant = useMemo(() => FALLBACK_TWEETS.filter((t) => t.is_relevant), []);
  const fallbackNoise = useMemo(() => FALLBACK_TWEETS.filter((t) => !t.is_relevant), []);
  const fallbackMapped = useMemo(
    () => fallbackRelevant.filter((t) => t.lat != null && t.lng != null),
    [fallbackRelevant]
  );

  // Build a client-side GeoJSON from fallback data for export / map
  const fallbackGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: fallbackMapped.map((t) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        tweet_id: t.id,
        text: t.tweet_text,
        category: t.impact_category,
        confidence: 1.0,
        place: t.location_name,
        created_at: t.timestamp,
      },
    })),
  }), [fallbackMapped]);

  // ── Startup: check backend health ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkHealth();
      if (cancelled) return;
      setBackendOnline(ok);
      if (ok) {
        // Grab categories
        try {
          const cats = await fetchCategories();
          if (!cancelled) setCategories(cats);
        } catch { /* ignore */ }
        // Try auto-loading the sample dataset
        try {
          await loadDataset(SAMPLE_DATASET_ID, 'backend');
        } catch {
          // sample doesn't exist yet — show fallback
          if (!cancelled) {
            setUseFallback(true);
            setDataSource('fallback');
            setSummary(FALLBACK_SUMMARY);
          }
        }
      } else {
        setUseFallback(true);
        setDataSource('fallback');
        setSummary(FALLBACK_SUMMARY);
        showToast({ type: 'warning', text: 'Backend offline — loaded built-in demo dataset.' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load a dataset by id from the backend ──
  const loadDataset = async (dsId, source = 'backend') => {
    setIsLoading(true);
    setUseFallback(false);
    try {
      const [st, signalRes, noiseRes, gj] = await Promise.all([
        fetchStats(dsId),
        fetchTweets(dsId, { relevant: true, limit: 1000 }),
        fetchTweets(dsId, { relevant: false, limit: 1000 }),
        fetchGeoJSON(dsId),
      ]);
      setStats(st);
      setSignalTweets(signalRes.tweets);
      setNoiseTweets(noiseRes.tweets);
      setGeojson(gj);
      setDatasetId(dsId);
      setDataSource(source);

      // Fire off summary request (non-blocking)
      fetchSummary(dsId, {})
        .then((s) => setSummary(s.summary))
        .catch(() => setSummary('AI summary unavailable — the summarize() function may not be implemented yet.'));

      showToast({ type: 'success', text: `Dataset "${st.name || dsId}" loaded — ${st.total} tweets.` });
    } catch (err) {
      // If 409, dataset is still processing — try finding its job
      if (err.message?.includes('409')) {
        showToast({ type: 'info', text: 'Dataset is still processing. Try again in a moment.' });
      } else {
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reload data when filters change (backend-mode only) ──
  useEffect(() => {
    if (!datasetId || useFallback) return;
    let cancelled = false;

    const params = {};
    if (filterCategory) params.category = filterCategory;
    if (filterSearch) params.q = filterSearch;
    if (filterLocation) params.location = filterLocation;
    if (filterHasLocation != null) params.has_location = filterHasLocation;

    const reload = async () => {
      try {
        const [signalRes, gj] = await Promise.all([
          fetchTweets(datasetId, { relevant: true, limit: 1000, ...params }),
          fetchGeoJSON(datasetId, params),
        ]);
        if (cancelled) return;
        setSignalTweets(signalRes.tweets);
        setGeojson(gj);
      } catch { /* best-effort */ }
    };

    // Debounce for search input
    const timer = setTimeout(reload, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [datasetId, useFallback, filterCategory, filterSearch, filterLocation, filterHasLocation]);

  // ── Handlers ──

  const handleLoadDataset = async () => {
    if (!backendOnline) {
      setUseFallback(true);
      setDataSource('fallback');
      setSummary(FALLBACK_SUMMARY);
      showToast({ type: 'warning', text: 'Backend offline — showing built-in demo data.' });
      return;
    }
    try {
      // Try sample first, then fall back to listing datasets
      await loadDataset(SAMPLE_DATASET_ID, 'backend');
    } catch {
      try {
        const { datasets } = await fetchDatasets();
        if (datasets.length > 0) {
          await loadDataset(datasets[0].id, 'backend');
        } else {
          setUseFallback(true);
          setDataSource('fallback');
          setSummary(FALLBACK_SUMMARY);
          showToast({ type: 'info', text: 'No datasets on server. Loaded built-in demo.' });
        }
      } catch {
        setUseFallback(true);
        setDataSource('fallback');
        setSummary(FALLBACK_SUMMARY);
        showToast({ type: 'error', text: 'Could not load dataset. Using fallback.' });
      }
    }
  };

  const handleUploadCSV = async (file) => {
    if (!backendOnline) {
      showToast({ type: 'error', text: 'Backend is offline — cannot process CSV. Start the backend first.' });
      return;
    }
    setIsLoading(true);
    setJobProgress({ status: 'uploading', stage: 'uploading', processed: 0, total: 0 });
    try {
      const dsId = await uploadAndWait(file, (progress) => {
        setJobProgress(progress);
      });
      setJobProgress(null);
      await loadDataset(dsId, 'upload');
      showToast({ type: 'success', text: `CSV "${file.name}" processed!` });
    } catch (err) {
      setJobProgress(null);
      showToast({ type: 'error', text: `CSV upload failed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportGeoJSON = async () => {
    try {
      let gj;
      if (useFallback) {
        gj = fallbackGeoJSON;
      } else if (datasetId) {
        gj = await fetchGeoJSON(datasetId);
      } else {
        gj = fallbackGeoJSON;
      }
      downloadGeoJSON(gj);
      showToast({ type: 'success', text: 'GeoJSON exported!' });
    } catch (err) {
      showToast({ type: 'error', text: `Export failed: ${err.message}` });
    }
  };

  const handleRequestSummary = async () => {
    if (!datasetId || useFallback) return;
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterSearch) params.q = filterSearch;
      if (filterLocation) params.location = filterLocation;
      const res = await fetchSummary(datasetId, params);
      setSummary(res.summary);
      showToast({ type: 'success', text: `Summary generated from ${res.tweet_count} tweets.` });
    } catch (err) {
      showToast({ type: 'warning', text: `Summary failed: ${err.message}` });
    }
  };

  const handleFlyTo = useCallback((coords) => {
    setFlyTo({ ...coords, _ts: Date.now() });
  }, []);

  // ── Determine what data to show in each section ──

  // Active tweets for the feed
  const displaySignal = useFallback ? fallbackRelevant : signalTweets;
  const displayNoise = useFallback ? fallbackNoise : noiseTweets;
  const displayGeoJSON = useFallback ? fallbackGeoJSON : geojson;

  // KPI values
  const kpiTotal = useFallback ? FALLBACK_TWEETS.length : (stats?.total ?? 0);
  const kpiRelevant = useFallback ? fallbackRelevant.length : (stats?.relevant ?? 0);
  const kpiNoise = useFallback ? fallbackNoise.length : (stats?.unrelated ?? 0);
  const kpiWithLocation = useFallback ? fallbackMapped.length : (stats?.with_location ?? 0);
  const kpiTopLocations = useFallback
    ? (() => {
        const c = {};
        fallbackMapped.forEach((t) => { c[t.location_name] = (c[t.location_name] || 0) + 1; });
        return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      })()
    : (stats?.top_locations ?? []);
  const kpiByCategory = useFallback
    ? (() => {
        const c = {};
        fallbackRelevant.forEach((t) => { if (t.impact_category) c[t.impact_category] = (c[t.impact_category] || 0) + 1; });
        return c;
      })()
    : (stats?.by_category ?? {});

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        onLoadDataset={handleLoadDataset}
        onUploadCSV={handleUploadCSV}
        onExportGeoJSON={handleExportGeoJSON}
        isLoading={isLoading}
        hasData={useFallback || datasetId != null}
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

      {/* Job Progress Overlay */}
      {jobProgress && jobProgress.status !== 'done' && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-white font-[Outfit]">Processing CSV</h3>
            <p className="text-sm text-slate-300 capitalize">
              {jobProgress.stage || jobProgress.status}
            </p>
            {jobProgress.total > 0 && (
              <>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((jobProgress.processed / jobProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {jobProgress.processed} / {jobProgress.total} tweets
                </p>
              </>
            )}
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
                ? `Backend API — dataset "${datasetId}"`
                : dataSource === 'upload'
                ? `Custom CSV Upload — dataset "${datasetId}"`
                : 'Built-in Demo Dataset (First Nations Flood Events)'}
            </strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : backendOnline === false ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`} />
            {backendOnline ? 'Backend connected' : backendOnline === false ? 'Backend offline' : 'Checking...'}
          </span>
        </div>

        {/* KPI Strip */}
        <KPIStrip
          total={kpiTotal}
          relevant={kpiRelevant}
          noise={kpiNoise}
          withLocation={kpiWithLocation}
          topLocations={kpiTopLocations}
        />

        {/* AI Summary Panel */}
        <SummaryPanel
          summary={summary}
          filteredRelevantCount={displaySignal.length}
          totalRelevantCount={kpiRelevant}
          topLocations={kpiTopLocations}
          byCategory={kpiByCategory}
          onRequestSummary={handleRequestSummary}
          canRequestSummary={!!datasetId && !useFallback}
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
                {displayGeoJSON && (
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({displayGeoJSON.features?.length ?? 0} points)
                  </span>
                )}
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
                Rescue / Help
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Infrastructure
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Evacuation
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Weather / Water
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
                geojson={displayGeoJSON}
                showHeatmap={showHeatmap}
                flyTo={flyTo}
              />
            </div>
          </div>

          {/* Tweet Feed Panel */}
          <div className="lg:w-[40%] min-h-[400px] lg:min-h-0">
            <TweetFeed
              signalTweets={displaySignal}
              noiseTweets={displayNoise}
              categories={categories}
              useFallback={useFallback}
              onFlyTo={handleFlyTo}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterSearch={filterSearch}
              setFilterSearch={setFilterSearch}
              filterLocation={filterLocation}
              setFilterLocation={setFilterLocation}
              filterHasLocation={filterHasLocation}
              setFilterHasLocation={setFilterHasLocation}
            />
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
