"""
Living Flood Map — backend API.

Run locally:  uvicorn app.main:app --reload --port 8000
Interactive docs: http://localhost:8000/docs
"""
import logging
from collections import Counter
from typing import Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ai, pipeline, store
from .config import ALLOWED_ORIGINS, MAX_SUMMARY_TWEETS, MAX_UPLOAD_MB, SAMPLE_CSV, SAMPLE_DATASET_ID
from .csv_loader import CSVError, parse_tweets_csv

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Living Flood Map API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    store.load_persisted()
    # Process the provided dataset once so the demo loads instantly afterwards.
    if SAMPLE_DATASET_ID not in store.datasets and SAMPLE_CSV.exists():
        tweets = parse_tweets_csv(SAMPLE_CSV.read_bytes())
        pipeline.start("Sample: main_contestant.csv", tweets, dataset_id=SAMPLE_DATASET_ID)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_dataset_or_404(dataset_id: str) -> Dict:
    ds = store.get_dataset(dataset_id)
    if ds is None:
        job = store.find_job_for_dataset(dataset_id)
        if job:
            raise HTTPException(409, detail={"message": "Dataset is still processing", "job": job})
        raise HTTPException(404, "Dataset not found")
    return ds


def _filter(tweets: List[Dict], relevant: Optional[bool], category: Optional[str],
            q: Optional[str], location: Optional[str], min_confidence: float,
            has_location: Optional[bool] = None) -> List[Dict]:
    q = (q or "").lower()
    location = (location or "").lower()
    cats = {c for c in (category or "").split(",") if c}
    out = []
    for t in tweets:
        if relevant is not None and t["relevant"] != relevant:
            continue
        if cats and t["category"] not in cats:
            continue
        if t["confidence"] < min_confidence:
            continue
        if q and q not in t["text"].lower():
            continue
        if location and not any(location in l["name"].lower() for l in t["locations"]):
            continue
        if has_location is not None and bool(t["locations"]) != has_location:
            continue
        out.append(t)
    return out


def _public(t: Dict) -> Dict:
    return {k: t[k] for k in ("id", "text", "created_at", "relevant", "confidence",
                               "category", "locations", "meta")}


class FilterParams(BaseModel):
    relevant: Optional[bool] = True
    category: Optional[str] = None
    q: Optional[str] = None
    location: Optional[str] = None
    min_confidence: float = 0.0


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/categories")
def categories():
    return {"categories": ai.CATEGORIES}


@app.post("/api/datasets", status_code=202)
async def upload_dataset(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File too large (max {MAX_UPLOAD_MB} MB)")
    try:
        tweets = parse_tweets_csv(raw)
    except CSVError as e:
        raise HTTPException(400, str(e))
    job = pipeline.start(file.filename or "upload.csv", tweets)
    return {"dataset_id": job["dataset_id"], "job_id": job["id"], "total": len(tweets)}


@app.get("/api/datasets")
def list_datasets():
    return {"datasets": store.list_datasets()}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = store.jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/api/datasets/{dataset_id}/tweets")
def get_tweets(
    dataset_id: str,
    relevant: Optional[bool] = True,
    category: Optional[str] = Query(None, description="Comma-separated categories"),
    q: Optional[str] = None,
    location: Optional[str] = None,
    min_confidence: float = 0.0,
    has_location: Optional[bool] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
):
    ds = _get_dataset_or_404(dataset_id)
    rows = _filter(ds["tweets"], relevant, category, q, location, min_confidence, has_location)
    return {"total": len(rows), "offset": offset, "limit": limit,
            "tweets": [_public(t) for t in rows[offset:offset + limit]]}


@app.get("/api/datasets/{dataset_id}/stats")
def get_stats(dataset_id: str):
    ds = _get_dataset_or_404(dataset_id)
    tweets = ds["tweets"]
    rel = [t for t in tweets if t["relevant"]]
    places = Counter(l["name"] for t in rel for l in t["locations"])
    return {
        "name": ds["name"],
        "total": len(tweets),
        "relevant": len(rel),
        "unrelated": len(tweets) - len(rel),
        "with_location": sum(1 for t in rel if t["locations"]),
        "by_category": dict(Counter(t["category"] for t in rel).most_common()),
        "top_locations": [{"name": n, "count": c} for n, c in places.most_common(15)],
    }


@app.get("/api/datasets/{dataset_id}/geojson")
def get_geojson(
    dataset_id: str,
    category: Optional[str] = None,
    q: Optional[str] = None,
    min_confidence: float = 0.0,
):
    """One Point feature per (tweet, location). Drop straight into Leaflet / Mapbox."""
    ds = _get_dataset_or_404(dataset_id)
    rows = _filter(ds["tweets"], True, category, q, None, min_confidence, has_location=True)
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [loc["lon"], loc["lat"]]},
            "properties": {"tweet_id": t["id"], "text": t["text"], "category": t["category"],
                           "confidence": t["confidence"], "place": loc["name"],
                           "created_at": t["created_at"]},
        }
        for t in rows for loc in t["locations"]
    ]
    return {"type": "FeatureCollection", "features": features}


@app.post("/api/datasets/{dataset_id}/summary")
def get_summary(dataset_id: str, filters: FilterParams):
    ds = _get_dataset_or_404(dataset_id)
    rows = _filter(ds["tweets"], filters.relevant, filters.category, filters.q,
                   filters.location, filters.min_confidence)
    # Most confident first so the summary is based on the strongest signal.
    rows = sorted(rows, key=lambda t: t["confidence"], reverse=True)[:MAX_SUMMARY_TWEETS]
    try:
        summary = ai.summarize([t["text"] for t in rows])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Summary failed: {e}")
    return {"summary": summary, "tweet_count": len(rows)}
