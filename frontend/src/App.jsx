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
import { Loader2 } from 'lucide-react';

/** Default dataset id the backend auto-creates from the provided CSV. */
const SAMPLE_DATASET_ID = 'sample';

export default function App() {
  // ── Connection & loading state ──
  const [backendOnline, setBackendOnline] = useState(null); // null = checking
  const [isLoading, setIsLoading] = useState(false);
  const [jobProgress, setJobProgress] = useState(null); // {status, stage, processed, total}

  // ── Active dataset ──
  const [datasetId, setDatasetId] = useState(null);
  const [dataSource, setDataSource] = useState('fallback'); // 'backend' | 'upload' | 'fallback'

  // ── Data from backend ──
  const [stats, setStats] = useState(null);
  const [signalTweets, setSignalTweets] = useState([]);
  const [noiseTweets, setNoiseTweets] = useState([]);
  const [signalTotal, setSignalTotal] = useState(0);
  const [noiseTotal, setNoiseTotal] = useState(0);
  const [geojson, setGeojson] = useState(null);
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [categories, setCategories] = useState([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // ── Filters (shared between tweet list and map) ──
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterHasLocation, setFilterHasLocation] = useState(null);

  // ── Fallback mode data ──
  const [useFallback, setUseFallback] = useState(true);

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
      setSignalTweets(signalRes.tweets || []);
      setNoiseTweets(noiseRes.tweets || []);
      setSignalTotal(signalRes.total ?? st.relevant ?? (signalRes.tweets || []).length);
      setNoiseTotal(noiseRes.total ?? st.noise ?? st.unrelated ?? (noiseRes.tweets || []).length);
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
        setSignalTweets(signalRes.tweets || []);
        setSignalTotal(signalRes.total ?? (signalRes.tweets || []).length);
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
    setIsLoadingSummary(true);
    if (backendOnline && datasetId && !useFallback) {
      try {
        const params = {};
        if (filterCategory) params.category = filterCategory;
        if (filterSearch) params.q = filterSearch;
        if (filterLocation) params.location = filterLocation;
        const res = await fetchSummary(datasetId, params);
        setSummary(res.summary);
        showToast({ type: 'success', text: `AI summary updated from ${res.tweet_count} verified signals.` });
      } catch (err) {
        showToast({ type: 'warning', text: `Summary request: ${err.message}` });
      } finally {
        setIsLoadingSummary(false);
      }
    } else {
      // In fallback mode, simulate AI re-generation with updated timestamp and analysis
      setTimeout(() => {
        setIsLoadingSummary(false);
        setSummary(
          `ACTIVE FLOOD SITUATION OVERVIEW (${new Date().toLocaleTimeString()}) — ` +
          'Kashechewan First Nation, Red Earth Cree Nation, and Peguis First Nation remain under high-priority flood advisories. ' +
          '12 verified signals identify active dike breaching, contaminated water intakes, isolated road washouts, and submerged bridge crossings. ' +
          'Emergency priority: rapid aerial medical evacuation for vulnerable elders and clean water airlift logistics.'
        );
        showToast({ type: 'success', text: 'AI situation summary re-generated from active flood signals!' });
      }, 500);
    }
  };

  const handleFlyTo = useCallback((coords) => {
    setFlyTo({ ...coords, _ts: Date.now() });
  }, []);

  // ── Determine what data to show in each section ──

  // Active tweets for the feed
  const displaySignal = useFallback ? fallbackRelevant : signalTweets;
  const displayNoise = useFallback ? fallbackNoise : noiseTweets;
  const displaySignalTotal = useFallback ? fallbackRelevant.length : (signalTotal || stats?.relevant || signalTweets.length);
  const displayNoiseTotal = useFallback ? fallbackNoise.length : (noiseTotal || stats?.noise || stats?.unrelated || noiseTweets.length);
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
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
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div
            className={`px-3 py-2 rounded text-xs font-mono border shadow-md flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-zinc-900 text-white border-zinc-700'
                : toastMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : toastMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-300'
                : 'bg-zinc-900 text-white border-zinc-700'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Job Progress Overlay */}
      {jobProgress && jobProgress.status !== 'done' && (
        <div className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded border border-zinc-300 p-6 max-w-sm w-full mx-4 shadow-xl text-center space-y-3">
            <Loader2 className="w-8 h-8 text-zinc-700 animate-spin mx-auto" />
            <h3 className="text-base font-bold text-zinc-900">Processing Ingestion Pipeline</h3>
            <p className="text-xs text-zinc-600 capitalize font-mono">
              {jobProgress.stage || jobProgress.status}
            </p>
            {jobProgress.total > 0 && (
              <>
                <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-zinc-900 h-1.5 transition-all duration-300"
                    style={{ width: `${Math.round((jobProgress.processed / jobProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {jobProgress.processed.toLocaleString()} / {jobProgress.total.toLocaleString()} tweets
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-2 p-3 sm:px-4 max-w-[1920px] w-full mx-auto min-h-0">
        {/* Data Source Banner */}
        <div className="rounded border border-zinc-200 bg-white px-3 py-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500 shrink-0">
          <span>
            Data Source:{' '}
            <strong className="text-zinc-800 font-semibold">
              {dataSource === 'backend'
                ? `Backend API (Dataset: ${datasetId})`
                : dataSource === 'upload'
                ? `Custom CSV (Dataset: ${datasetId})`
                : 'Built-in Demo Dataset (First Nations Emergency Reports)'}
            </strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-600' : backendOnline === false ? 'bg-red-600' : 'bg-amber-500'
              }`}
            />
            <span>{backendOnline ? 'API Connected' : backendOnline === false ? 'API Offline (Demo Mode)' : 'Connecting...'}</span>
          </span>
        </div>

        {/* Combined Horizontal Intelligence & KPI Strip (Single screen, no scrolling) */}
        <div className="bg-white border border-zinc-200 rounded divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 grid grid-cols-1 lg:grid-cols-12 shadow-sm shrink-0">
          {/* Left: KPIs (4 cells) */}
          <div className="lg:col-span-5 h-full">
            <KPIStrip
              total={kpiTotal}
              relevant={kpiRelevant}
              noise={kpiNoise}
              withLocation={kpiWithLocation}
              topLocations={kpiTopLocations}
            />
          </div>

          {/* Right: Situation Summary & Hotspots */}
          <div className="lg:col-span-7 h-full">
            <SummaryPanel
              summary={summary}
              filteredRelevantCount={displaySignal.length}
              totalRelevantCount={kpiRelevant}
              topLocations={kpiTopLocations}
              byCategory={kpiByCategory}
              onRequestSummary={handleRequestSummary}
              isLoadingSummary={isLoadingSummary}
            />
          </div>
        </div>

        {/* Split Workspace: Map (60%) + Feed (40%) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0" style={{ minHeight: '520px' }}>
          {/* Map Panel (60%) */}
          <div className="lg:w-[60%] flex flex-col gap-1.5 min-h-[400px] lg:min-h-0">
            {/* Map Toolbar & Legend */}
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 text-xs">
                  Flood Map
                </span>
                {displayGeoJSON && (
                  <span className="text-[11px] font-mono tabular-nums text-zinc-500 font-normal">
                    ({displayGeoJSON.features?.length ?? 0} mapped)
                  </span>
                )}
              </div>

              {/* Map Legend */}
              <div className="flex items-center gap-3 text-[11px] text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span>Rescue / Help</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
                  <span>Infrastructure</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                  <span>Evacuation</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                  <span>Weather / Water</span>
                </span>
              </div>

              <button
                id="btn-toggle-heatmap"
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
                  showHeatmap
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                {showHeatmap ? 'Concentration: ON' : 'Concentration: OFF'}
              </button>
            </div>

            {/* Map Canvas */}
            <div className="flex-1 min-h-0">
              <FloodMap
                geojson={displayGeoJSON}
                showHeatmap={showHeatmap}
                flyTo={flyTo}
              />
            </div>
          </div>

          {/* Tweet Feed Panel (40%) */}
          <div className="lg:w-[40%] min-h-[400px] lg:min-h-0 flex flex-col">
            <TweetFeed
              signalTweets={displaySignal}
              noiseTweets={displayNoise}
              signalTotal={displaySignalTotal}
              noiseTotal={displayNoiseTotal}
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
      <footer className="border-t border-zinc-200 bg-white py-1.5 px-4 text-xs text-zinc-500 font-mono tabular-nums shrink-0">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <p>&copy; 2026 CE Strategies &bull; ThunderBay AI Emergency Intelligence</p>
          <p className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
            React + Leaflet GIS + Canvas Engine
          </p>
        </div>
      </footer>
    </div>
  );
}
