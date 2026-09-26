/**
 * API Service for The Living Flood Map
 *
 * Talks to the real backend API documented in backend/README.md.
 *
 * Endpoints used:
 *   GET  /api/health
 *   GET  /api/categories
 *   POST /api/datasets              (upload CSV → returns dataset_id + job_id)
 *   GET  /api/jobs/{job_id}          (poll progress)
 *   GET  /api/datasets              (list previous datasets)
 *   GET  /api/datasets/{id}/stats   (KPI numbers)
 *   GET  /api/datasets/{id}/tweets  (tweet list with filters)
 *   GET  /api/datasets/{id}/geojson (GeoJSON for Leaflet, with filters)
 *   POST /api/datasets/{id}/summary (AI overview, filtered)
 *
 * Base URL comes from VITE_API_URL. If unset: http://localhost:8000 in `npm run dev`,
 * and same-origin in production (the backend serves the built frontend).
 * Fallback data is used only when the backend is completely unreachable.
 */

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '');

// ── Low-level helpers ──────────────────────────────────────────────

async function get(path, params = {}) {
  const url = new URL(`${API}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function postFile(path, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────

/** Quick backend connectivity test. */
export async function checkHealth() {
  try {
    await get('/api/health');
    return true;
  } catch {
    return false;
  }
}

/** Fetch available category strings for filter pills. */
export async function fetchCategories() {
  const data = await get('/api/categories');
  return data.categories; // string[]
}

/** List previously processed datasets. */
export async function fetchDatasets() {
  const data = await get('/api/datasets');
  return data.datasets; // [{id, name, total, relevant}]
}

/** Upload a CSV file → kicks off async pipeline, returns ids. */
export async function uploadCSV(file) {
  // POST /api/datasets  (multipart file)
  return postFile('/api/datasets', file);
  // → {dataset_id, job_id, total}
}

/** Poll a background job. Resolves when done, rejects on failure. */
export async function pollJob(jobId) {
  const data = await get(`/api/jobs/${jobId}`);
  return data; // {status, stage, processed, total, error?, dataset_id}
}

/**
 * Helper: upload CSV and poll until the pipeline finishes.
 * Calls `onProgress({status, stage, processed, total})` each tick.
 * Returns the dataset_id on success.
 */
export async function uploadAndWait(file, onProgress) {
  const { dataset_id, job_id, total } = await uploadCSV(file);
  onProgress?.({ status: 'queued', stage: 'queued', processed: 0, total });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));
    const job = await pollJob(job_id);
    onProgress?.(job);
    if (job.status === 'done') return dataset_id;
    if (job.status === 'failed') throw new Error(job.error || 'Job failed');
  }
}

/** KPI stats for a dataset. */
export async function fetchStats(datasetId) {
  return get(`/api/datasets/${datasetId}/stats`);
  // → {name, total, relevant, unrelated, with_location, by_category, top_locations}
}

/**
 * Filtered tweets.
 * filters: { relevant, category, q, location, min_confidence, has_location, limit, offset }
 */
export async function fetchTweets(datasetId, filters = {}) {
  return get(`/api/datasets/${datasetId}/tweets`, filters);
  // → {total, offset, limit, tweets: [{id, text, created_at, relevant, confidence, category, locations, meta}]}
}

/**
 * GeoJSON FeatureCollection for Leaflet.
 * filters: { category, q, min_confidence }
 */
export async function fetchGeoJSON(datasetId, filters = {}) {
  return get(`/api/datasets/${datasetId}/geojson`, filters);
  // → { type: "FeatureCollection", features: [...] }
}

/**
 * AI summary of filtered tweets.
 * filters: { relevant, category, q, location, min_confidence }
 */
export async function fetchSummary(datasetId, filters = {}) {
  return post(`/api/datasets/${datasetId}/summary`, {
    relevant: true,
    ...filters,
  });
  // → {summary, tweet_count}
}

/**
 * Build a downloadable GeoJSON blob from a FeatureCollection object.
 * (The backend already returns valid GeoJSON, so this just wraps download.)
 */
export function downloadGeoJSON(featureCollection, filename = 'living_flood_map_export.geojson') {
  const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
