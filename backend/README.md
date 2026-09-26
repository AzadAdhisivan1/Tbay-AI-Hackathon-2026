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

Two **built-in datasets** load instantly from gzipped seeds in `data/seeds/` (committed):

| id | Source | Scope |
|---|---|---|
| `sample` | `CE Strategies/main_contestant.csv` (Alberta floods 2013, 8,024 tweets) | `regional` |
| `bonus` | `CE Strategies/bonus_contestant.csv` (world disasters, 61,159 tweets) | `world` — **default** |

The UI should open `default_id` from `GET /api/datasets` (set via `"default": True` in
`BUILTIN_DATASETS` in `app/config.py`).

Seeds are tagged with a fingerprint of the AI/geocoding code (`app/ai.py`, `app/geocode.py`,
`app/pipeline.py`, `ai_workflow/{analyzer,prompt_template,geocoder}.py`). If that code changes,
the server rebuilds the built-ins on startup **with the free rule engine only** and
rewrites the seeds. **Commit `data/seeds/` and `data/geocode_cache.json` after changing
the AI** so the deployed server doesn't rebuild on every cold start.

**"Relevant" means flood-related** (shared agreement with the AI/UI teams). Every tweet
also gets a `disaster_type`: `flood`, `storm`, `wildfire`, `earthquake`, `explosion`,
`shooting`, `transport_accident`, `haze`, `other`, `none`. Tweets about non-flood disasters are
never relevant (backend policy in `ai.py`, applied to Gemini and rule-engine output alike).

**Map scope:** `regional` datasets bound OpenStreetMap lookups to ~300 km around the
disaster; `world` datasets look places up anywhere. Uploads are auto-detected (the 15
most-mentioned places are looked up worldwide; spread out = `world`) or forced with
`POST /api/datasets?scope=world|regional`.

## Project layout

| File | What it does | Owner |
|---|---|---|
| `app/ai.py` | Batched Gemini classification + summaries with quota guard; falls back to the ai_workflow rule engine | Backend (prompt overridable by AI teammate) |
| `app/main.py` | API routes, filtering, CORS | Backend |
| `app/pipeline.py` | Background job: classify in parallel batches (with retries) → publish → geocode progressively → save | Backend |
| `app/csv_loader.py` | Parses any CSV, auto-detects the text / date / lat / lon columns | Backend |
| `app/geocode.py` | Place name → lat/lon: ai_workflow gazetteer first, then OpenStreetMap Nominatim restricted to the area around the disaster, with junk-name filtering. Cached in `data/geocode_cache.json` | Backend |
| `app/store.py` | In-memory store, finished datasets saved to `data/datasets/` | Backend |

### AI: Gemini + rule-engine fallback

`app/ai.py` classifies tweets with the **hackathon Gemini API** (`HACKATHON_API_KEY`),
**one request per batch of 50 tweets** using structured JSON output. Anything the LLM
can't handle (disabled, quota guard hit, error, missing rows) falls back to the
`ai_workflow` rule engine (`analyze_tweet_nlp`). Each tweet's `ai_source` says which
(`gemini` / `rules`); `/api/ai/status` shows whether Gemini is live and the quota left.

**Quota rules (it's small, and failed requests count):**
- No automatic retries of LLM calls.
- The LLM stops once `requests_remaining` ≤ `LLM_MIN_REMAINING` (default 40, kept for summaries).
- At most `LLM_MAX_REQUESTS_PER_DATASET` (default 170 ≈ 8,500 tweets) per upload.
- **Pre-filter:** if a dataset needs more requests than its cap, only likely-flood tweets
  go to Gemini (clear flood words first, then rain/storm/river/evacuation words); the
  rest use the free rule engine. The 61k-tweet bonus → ~12.7k candidates → ~254 requests.
- Summaries are one request each, cached per identical filter result.
- **Built-in datasets never spend quota on a server.** To build the Gemini versions,
  run locally ONCE after the AI prompts are final, then commit `data/seeds/`:
  ```bash
  rm data/seeds/*.json.gz data/datasets/*.json
  BUILTIN_USE_LLM=1 uvicorn app.main:app --port 8000   # sample ~161 + bonus ~254 requests
  ```
- Testing uploads locally? Set `LLM_ENABLED=0` in `.env` to avoid spending quota.

**AI teammate:** the batch prompt/schema can be overridden without touching backend
code. Add `format_batch_prompt(texts: List[str]) -> str` and `BATCH_RESPONSE_SCHEMA` to
`ai_workflow/prompt_template.py`. The response must be a JSON array of
`{id, is_relevant, relevance_confidence, category, severity, locations: [str], reasoning}`,
one per tweet with `id` = index in the batch, using the ai_workflow categories.

## API (for the UI teammate)

Base URL: `http://localhost:8000` locally. Use `import.meta.env.VITE_API_URL` in the frontend.

| Method & path | Purpose | Returns |
|---|---|---|
| `GET /api/health` | Health check | `{ok: true}` |
| `GET /api/ai/status` | Is Gemini live? (for the "Gemini Live" badge) | `{active, enabled, requests_remaining, model, ...}` |
| `GET /api/categories` | Filter options | `{categories: [...], severities: [...], disaster_types: [...]}` |
| `POST /api/datasets` (multipart `file`) | Upload a CSV | `{dataset_id, job_id, total}` (202) |
| `GET /api/jobs/{job_id}` | Poll progress every ~1s | `{status: queued\|running\|done\|failed, stage: classifying\|geocoding\|done, processed, total, dataset_ready, places_done, places_total, ai_failed, error}` |
| `GET /api/datasets` | Default first, then built-ins, then uploads | `{default_id: "bonus", datasets: [{id, name, total, relevant, processing, builtin, default, scope}]}` |
| `GET /api/datasets/{id}/stats` | KPI cards / charts | `{total, relevant, unrelated, with_location, by_category, by_severity, by_disaster_type, top_locations: [{name, count}], scope: regional\|world, anchor: [lat, lon] or null, has_timestamps, ai_sources, builtin, processing}` |
| `GET /api/datasets/{id}/tweets` | Tweet list | `{total, tweets: [{id, text, created_at, ts, relevant, confidence, category, severity, disaster_type, reasoning, ai_source, locations: [{name, lat, lon}], meta}]}` |
| `GET /api/datasets/{id}/geojson` | Map layer | GeoJSON `FeatureCollection` of Points (properties include `severity`) |
| `GET /api/datasets/{id}/timeline?interval=hour\|day` | Activity over time | `{available, buckets: [{t, total, relevant, by_category}]}` (`available: false` if the CSV has no dates) |
| `GET /api/datasets/{id}/export.csv` | Download classified tweets | CSV file (link to it directly; takes the same filters) |
| `POST /api/datasets/{id}/summary` | AI overview of the filtered tweets | `{summary, tweet_count}` |

**Filters** (query params; JSON body on `/summary`): `relevant` (`true` default, `false`, or `all`),
`category`, `severity` and `disaster_type` (comma-separated), `q` (text search), `location` (substring of place
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

Environment variables: `PYTHON_VERSION=3.11.9`, `NODE_VERSION=22`, `HACKATHON_API_KEY` (secret).
Do NOT set `BUILTIN_USE_LLM` on Render.
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
