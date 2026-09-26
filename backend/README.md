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

On first start the provided dataset (`CE Strategies/main_contestant.csv`) is
processed automatically and saved as dataset id **`sample`**.

## Project layout

| File | What it does | Owner |
|---|---|---|
| `app/ai.py` | `classify_batch()` and `summarize()` — **the AI contract**. Currently keyword placeholders. | AI teammate |
| `app/main.py` | API routes, filtering, CORS | Backend |
| `app/pipeline.py` | Background job: classify in batches → geocode → save | Backend |
| `app/csv_loader.py` | Parses any CSV, auto-detects the text / date / lat / lon columns | Backend |
| `app/geocode.py` | Place name → lat/lon via OpenStreetMap Nominatim, cached in `data/geocode_cache.json` | Backend |
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
| `GET /api/categories` | Category list for filter UI | `{categories: [...]}` |
| `POST /api/datasets` (multipart `file`) | Upload a CSV | `{dataset_id, job_id, total}` (202) |
| `GET /api/jobs/{job_id}` | Poll progress every ~1s | `{status: queued\|running\|done\|failed, stage: classifying\|geocoding\|done, processed, total, error}` |
| `GET /api/datasets` | Previously processed datasets | `{datasets: [{id, name, total, relevant}]}` |
| `GET /api/datasets/{id}/stats` | KPI cards / charts | `{total, relevant, unrelated, with_location, by_category: {...}, top_locations: [{name, count}]}` |
| `GET /api/datasets/{id}/tweets` | Tweet list | `{total, tweets: [{id, text, created_at, relevant, confidence, category, locations: [{name, lat, lon}], meta}]}` |
| `GET /api/datasets/{id}/geojson` | Map layer | GeoJSON `FeatureCollection` of Points |
| `POST /api/datasets/{id}/summary` | AI overview of the filtered tweets | `{summary, tweet_count}` |

**Filters** (query params on `/tweets` and `/geojson`, JSON body on `/summary`):
`relevant` (default `true`), `category` (comma-separated), `q` (text search),
`location` (substring of place name), `min_confidence`. `/tweets` also takes
`has_location`, `limit` (max 1000), `offset`.

While a dataset is still processing, dataset endpoints return **409** with the job in `detail.job`.

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

Redeploying: public-repo services don't auto-deploy. Use Settings → Deploy Hook
and run `curl -X POST "<hook-url>"` (or Manual Deploy in the dashboard) after merging to `main`.

To test the production setup locally: `cd frontend && npm run build`, then run
uvicorn as above and open http://localhost:8000. (`npm run dev` still works as
usual and talks to http://localhost:8000.)
