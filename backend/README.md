# Backend — Living Flood Map API

FastAPI service that takes a CSV of tweets, classifies each one as flood-related
or not, extracts and geocodes place names, and serves filtered tweets, stats,
map points (GeoJSON) and AI summaries to the frontend.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive API docs where you can try every endpoint.

The provided dataset (`CE Strategies/main_contestant.csv`) is available as dataset id
**`sample`**. It loads instantly from `data/sample_seed.json` (committed). That file is
tagged with a fingerprint of the AI/geocoding code; if the code changes, the server
reprocesses the sample on startup and rewrites the seed. **Commit the new
`sample_seed.json` and `geocode_cache.json` after changing the AI** so the deployed
server doesn't reprocess on every cold start.

## Project layout

| File | What it does | Owner |
|---|---|---|
| `app/ai.py` | `classify_batch()` and `summarize()` — **the AI contract**. Currently keyword placeholders. | AI teammate |
| `app/main.py` | API routes, filtering, CORS | Backend |
| `app/pipeline.py` | Background job: classify in parallel batches (with retries) → publish → geocode progressively → save | Backend |
| `app/csv_loader.py` | Parses any CSV, auto-detects the text / date / lat / lon columns | Backend |
| `app/geocode.py` | Place name → lat/lon: ai_workflow gazetteer first, then OpenStreetMap Nominatim restricted to the area around the disaster, with junk-name filtering. Cached in `data/geocode_cache.json` | Backend |
| `app/store.py` | In-memory store, finished datasets saved to `data/datasets/` | Backend |

### For the AI teammate

Only edit `app/ai.py`. Keep the signatures:

```python
classify_batch(texts: List[str]) -> List[dict]
# one dict per tweet, same order:
# {"relevant": bool, "confidence": float, "category": str | None, "locations": [str]}

summarize(texts: List[str]) -> str
```

- `category` must be one of `CATEGORIES` in `ai.py` (or `None` if not relevant).
- `locations` should be as specific as possible (`"Mission, Calgary, Alberta"`, not `"Mission"`), and skip bare provinces/countries.
- Put API keys in `backend/.env` and read them with `os.getenv(...)`.
- After changing the model, delete `backend/data/datasets/sample.json` and restart to reprocess.

## API (for the UI teammate)

Base URL: `http://localhost:8000` locally. Use `import.meta.env.VITE_API_URL` in the frontend.

| Method & path | Purpose | Returns |
|---|---|---|
| `GET /api/health` | Health check | `{ok: true}` |
| `GET /api/categories` | Filter options | `{categories: [...], severities: [critical, high, medium, low]}` |
| `POST /api/datasets` (multipart `file`) | Upload a CSV | `{dataset_id, job_id, total}` (202) |
| `GET /api/jobs/{job_id}` | Poll progress every ~1s | `{status: queued\|running\|done\|failed, stage: classifying\|geocoding\|done, processed, total, dataset_ready, places_done, places_total, ai_failed, error}` |
| `GET /api/datasets` | Previously processed datasets | `{datasets: [{id, name, total, relevant, processing}]}` |
| `GET /api/datasets/{id}/stats` | KPI cards / charts | `{total, relevant, unrelated, with_location, by_category, by_severity, top_locations: [{name, count}], anchor: [lat, lon], has_timestamps, processing}` |
| `GET /api/datasets/{id}/tweets` | Tweet list | `{total, tweets: [{id, text, created_at, ts, relevant, confidence, category, severity, reasoning, locations: [{name, lat, lon}], meta}]}` |
| `GET /api/datasets/{id}/geojson` | Map layer | GeoJSON `FeatureCollection` of Points (properties include `severity`) |
| `GET /api/datasets/{id}/timeline?interval=hour\|day` | Activity over time | `{available, buckets: [{t, total, relevant, by_category}]}` (`available: false` if the CSV has no dates) |
| `GET /api/datasets/{id}/export.csv` | Download classified tweets | CSV file (link to it directly; takes the same filters) |
| `POST /api/datasets/{id}/summary` | AI overview of the filtered tweets | `{summary, tweet_count}` |

**Filters** (query params; JSON body on `/summary`): `relevant` (`true` default, `false`, or `all`),
`category` and `severity` (comma-separated), `q` (text search), `location` (substring of place
name), `min_confidence`. `/tweets` also takes `has_location`, `sort`
(`original`\|`severity`\|`confidence`\|`time`), `limit` (max 1000), `offset`.

**Progressive loading:** once a job reports `dataset_ready: true` (stage `geocoding`), all
dataset endpoints work — tweets and stats are final, and map points keep being added
until `status: done`. Refresh `/geojson` periodically while `stats.processing` is true.
Use `stats.anchor` as the initial map centre. Datasets not yet classified return **409**.

Quick try:

```bash
curl localhost:8000/api/datasets/sample/stats
curl "localhost:8000/api/datasets/sample/tweets?category=evacuation&limit=5"
curl -F "file=@my_tweets.csv" localhost:8000/api/datasets
```

## Deploy (single service on Render)

The backend also serves the built React app, so the whole site is **one Render
Web Service with one URL** — the frontend calls `/api/...` on the same origin.

Render → New → **Web Service** → **Public Git Repository** →
`https://github.com/krish-bista/Tbay-AI-Hackathon-2026`

| Setting | Value |
|---|---|
| Branch | `main` |
| Root Directory | *(leave blank — needs both `frontend/` and `backend/`)* |
| Runtime | Python 3 |
| Build Command | `cd frontend && npm ci && npm run build && cd ../backend && pip install -r requirements.txt` |
| Start Command | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

Environment variables: `PYTHON_VERSION=3.11.9`, `NODE_VERSION=22`, plus any model API keys.
Optional tuning: `AI_CONCURRENCY` (parallel AI batches, default 4 — lower it if the model
rate-limits), `BATCH_SIZE` (default 50), `GEOCODE_MAX_LOOKUPS` (new OpenStreetMap lookups
per upload, default 250), `GEOCODE_COUNTRY_CODES` (country tried first, default `ca`).

Keep it awake for judging: free Render services sleep after ~15 min idle. Point a free
monitor (UptimeRobot / cron-job.org) at `https://<app>.onrender.com/api/health` every 10 min.

Redeploying: public-repo services don't auto-deploy. Use Settings → Deploy Hook
and run `curl -X POST "<hook-url>"` (or Manual Deploy in the dashboard) after merging to `main`.

To test the production setup locally: `cd frontend && npm run build`, then run
uvicorn as above and open http://localhost:8000. (`npm run dev` still works as
usual and talks to http://localhost:8000.)
