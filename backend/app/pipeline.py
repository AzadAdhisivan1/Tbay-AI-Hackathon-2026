"""
Background processing: classify every tweet with the AI module, then geocode
the locations of relevant tweets. Runs in a worker thread; progress is exposed
through the job record.
"""
import logging
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List

from . import ai, store
from .config import BATCH_SIZE
from .geocode import geocode

log = logging.getLogger("pipeline")
_executor = ThreadPoolExecutor(max_workers=2)


def start(name: str, tweets: List[Dict], dataset_id: str = None) -> Dict:
    dataset_id = dataset_id or store.new_id()
    job = store.create_job(dataset_id, total=len(tweets))
    _executor.submit(_run, job["id"], dataset_id, name, tweets)
    return job


def _run(job_id: str, dataset_id: str, name: str, tweets: List[Dict]):
    try:
        store.update_job(job_id, status="running", stage="classifying")

        # 1. Classify in batches
        for i in range(0, len(tweets), BATCH_SIZE):
            batch = tweets[i:i + BATCH_SIZE]
            results = ai.classify_batch([t["text"] for t in batch])
            if len(results) != len(batch):
                raise RuntimeError(f"classify_batch returned {len(results)} results for {len(batch)} tweets")
            for t, r in zip(batch, results):
                t["relevant"] = bool(r.get("relevant"))
                t["confidence"] = float(r.get("confidence") or 0)
                t["category"] = r.get("category") if t["relevant"] else None
                t["location_names"] = list(r.get("locations") or []) if t["relevant"] else []
            store.update_job(job_id, processed=min(i + BATCH_SIZE, len(tweets)))

        # 2. Geocode unique place names from relevant tweets
        names = sorted({n for t in tweets for n in t["location_names"]})
        store.update_job(job_id, stage="geocoding", processed=0, total=len(names))
        coords = {}
        for idx, n in enumerate(names):
            coords[n] = geocode(n)
            store.update_job(job_id, processed=idx + 1)

        for t in tweets:
            t["locations"] = [
                {"name": n, "lat": coords[n]["lat"], "lon": coords[n]["lon"]}
                for n in t.pop("location_names") if coords.get(n)
            ]
            # Tweets with their own GPS coordinates in the CSV
            if t["relevant"] and t.get("lat") is not None and t.get("lon") is not None:
                t["locations"].insert(0, {"name": "Tweet GPS", "lat": t["lat"], "lon": t["lon"]})

        store.save_dataset({"id": dataset_id, "name": name, "created_at": time.time(), "tweets": tweets})
        store.update_job(job_id, status="done", stage="done")
        log.info("dataset %s processed: %d tweets", dataset_id, len(tweets))
    except Exception as e:  # noqa: BLE001 — surface any failure to the UI
        traceback.print_exc()
        store.update_job(job_id, status="failed", stage="failed", error=str(e))
