"""
Background processing for an uploaded dataset:

  1. Classify every tweet with the AI module (batches run in parallel, with retries).
  2. Publish the dataset immediately so the UI can show tweets/stats.
  3. Geocode place names, most-mentioned first; map points appear progressively.
  4. Persist the finished dataset.

The provided sample dataset is also written to data/sample_seed.json (committed),
tagged with a fingerprint of the AI code, so deployed servers load it instantly
instead of reprocessing on every cold start.
"""
import hashlib
import json
import logging
import os
import threading
import time
import traceback
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Tuple

from . import ai, geocode, store
from .config import (AI_CONCURRENCY, AI_WORKFLOW_DIR, BACKEND_DIR, BATCH_SIZE,
                     GEOCODE_MAX_LOOKUPS, LLM_MAX_REQUESTS_PER_DATASET, SAMPLE_DATASET_ID,
                     SAMPLE_SEED, SAMPLE_USE_LLM)

log = logging.getLogger("pipeline")
_jobs_executor = ThreadPoolExecutor(max_workers=2)

# Files whose changes should invalidate the precomputed sample.
_FINGERPRINT_FILES = [
    BACKEND_DIR / "app" / "ai.py",
    BACKEND_DIR / "app" / "geocode.py",
    BACKEND_DIR / "app" / "pipeline.py",
    AI_WORKFLOW_DIR / "analyzer.py",
    AI_WORKFLOW_DIR / "prompt_template.py",
    AI_WORKFLOW_DIR / "geocoder.py",
]


def ai_fingerprint() -> str:
    """Hash of the AI/geocoding code. Whether the seed used Gemini is recorded separately."""
    h = hashlib.sha1()
    for p in _FINGERPRINT_FILES:
        if p.exists():
            h.update(p.read_bytes())
    return h.hexdigest()[:16]


def load_sample_seed() -> bool:
    """Load the committed precomputed sample if it matches the current AI code."""
    if not SAMPLE_SEED.exists():
        return False
    try:
        ds = json.loads(SAMPLE_SEED.read_text())
    except ValueError:
        return False
    if ds.get("fingerprint") != ai_fingerprint():
        log.warning("sample seed is stale (AI code changed) — reprocessing%s. Regenerate it "
                    "locally with SAMPLE_USE_LLM=1 and commit data/sample_seed.json.",
                    " with Gemini" if SAMPLE_USE_LLM else " with the rule engine (no quota)")
        return False
    store.save_dataset(ds)
    log.info("loaded precomputed sample dataset (%d tweets)", len(ds["tweets"]))
    return True


def start(name: str, tweets: List[Dict], dataset_id: str = None) -> Dict:
    dataset_id = dataset_id or store.new_id()
    job = store.create_job(dataset_id, total=len(tweets))
    _jobs_executor.submit(_run, job["id"], dataset_id, name, tweets)
    return job


# ---------------------------------------------------------------------------

_NOT_RELEVANT_ON_ERROR = {"relevant": False, "confidence": 0.0, "category": None,
                          "severity": None, "reasoning": "AI classification failed", "locations": [],
                          "source": "error"}


def _classify_with_retry(texts: List[str], use_llm: bool, attempts: int = 3) -> Tuple[List[Dict], bool]:
    """Returns (results, ok). Never raises — a failed batch is marked unrelated."""
    for attempt in range(attempts):
        try:
            # Retries never use the LLM: failed requests still cost quota.
            results = ai.classify_batch(texts, use_llm=use_llm and attempt == 0)
            if len(results) != len(texts):
                raise RuntimeError(f"classify_batch returned {len(results)} results for {len(texts)} tweets")
            return results, True
        except Exception as e:  # noqa: BLE001
            log.warning("classify_batch failed (attempt %d/%d): %s", attempt + 1, attempts, e)
            time.sleep(2 ** attempt)
    return [dict(_NOT_RELEVANT_ON_ERROR) for _ in texts], False


def _classify_all(job_id: str, tweets: List[Dict], use_llm: bool):
    batches = [tweets[i:i + BATCH_SIZE] for i in range(0, len(tweets), BATCH_SIZE)]
    # Cap LLM requests per dataset; later batches use the rule engine.
    llm_flags = [use_llm and i < LLM_MAX_REQUESTS_PER_DATASET for i in range(len(batches))]
    done = [0]
    failed = [0]
    lock = threading.Lock()

    def work(args):
        batch, batch_llm = args
        results, ok = _classify_with_retry([t["text"] for t in batch], batch_llm)
        for t, r in zip(batch, results):
            t["relevant"] = bool(r.get("relevant"))
            t["confidence"] = float(r.get("confidence") or 0)
            t["category"] = r.get("category") if t["relevant"] else None
            t["severity"] = r.get("severity") if t["relevant"] else None
            t["reasoning"] = r.get("reasoning") or ""
            t["ai_source"] = r.get("source") or "rules"
            t["location_names"] = list(r.get("locations") or []) if t["relevant"] else []
            t["locations"] = []
        with lock:
            done[0] += len(batch)
            if not ok:
                failed[0] += len(batch)
            store.update_job(job_id, processed=done[0], ai_failed=failed[0])

    with ThreadPoolExecutor(max_workers=AI_CONCURRENCY) as pool:
        list(pool.map(work, zip(batches, llm_flags)))


def _add_location(tweets: List[Dict], loc: Dict):
    for t in tweets:
        if not any(l["name"] == loc["name"] for l in t["locations"]):
            t["locations"].append(dict(loc))


def _geocode_all(job_id: str, ds: Dict):
    tweets = ds["tweets"]
    by_name: Dict[str, List[Dict]] = defaultdict(list)
    for t in tweets:
        for n in t.pop("location_names", []):
            by_name[n].append(t)
        # Tweets with their own GPS coordinates in the CSV
        if t["relevant"] and t.get("lat") is not None and t.get("lon") is not None:
            t["locations"].append({"name": "Tweet GPS", "lat": t["lat"], "lon": t["lon"]})

    names = sorted(by_name, key=lambda n: len(by_name[n]), reverse=True)
    store.update_job(job_id, stage="geocoding", places_done=0, places_total=len(names))

    # 1. Gazetteer (instant) — also tells us where the disaster is.
    # GPS columns in the CSV (any tweet) are the best hint of where the disaster is.
    anchor_points = [(t["lat"], t["lon"], 1) for t in tweets
                     if t.get("lat") is not None and t.get("lon") is not None]
    remaining = []
    for n in names:
        hit = geocode.lookup_gazetteer(n)
        if hit:
            _add_location(by_name[n], hit)
            anchor_points.append((hit["lat"], hit["lon"], len(by_name[n])))
        elif geocode.worth_looking_up(n):
            remaining.append(n)
    done = len(names) - len(remaining)
    store.update_job(job_id, places_done=done)

    # 2. No anchor yet (e.g. a disaster outside the gazetteer)? Geocode the top
    #    names unbounded until we know roughly where things are.
    anchor = geocode.weighted_anchor(anchor_points)
    lookups = 0
    while anchor is None and remaining and lookups < 10:
        n = remaining.pop(0)
        hit = geocode.lookup_nominatim(n, None)
        lookups += 1
        done += 1
        if hit:
            _add_location(by_name[n], hit)
            anchor_points.append((hit["lat"], hit["lon"], len(by_name[n])))
            if len(anchor_points) >= 3:
                anchor = geocode.weighted_anchor(anchor_points)
        store.update_job(job_id, places_done=done)
    if anchor is None:
        anchor = geocode.weighted_anchor(anchor_points)
    ds["anchor"] = anchor

    # 3. Everything else, restricted to a box around the anchor.
    for n in remaining:
        if lookups >= GEOCODE_MAX_LOOKUPS and not geocode.is_cached(n, anchor):
            done += 1
            continue
        if not geocode.is_cached(n, anchor):
            lookups += 1
        hit = geocode.lookup_nominatim(n, anchor)
        if hit:
            _add_location(by_name[n], hit)
        done += 1
        store.update_job(job_id, places_done=done)
    store.update_job(job_id, places_done=len(names))


def _run(job_id: str, dataset_id: str, name: str, tweets: List[Dict]):
    try:
        store.update_job(job_id, status="running", stage="classifying")
        use_llm = SAMPLE_USE_LLM if dataset_id == SAMPLE_DATASET_ID else True
        _classify_all(job_id, tweets, use_llm)

        ds = {"id": dataset_id, "name": name, "created_at": time.time(),
              "tweets": tweets, "processing": True}
        store.publish_dataset(ds)  # tweets & stats are browsable from here on
        store.update_job(job_id, dataset_ready=True)

        _geocode_all(job_id, ds)

        ds["processing"] = False
        if dataset_id == SAMPLE_DATASET_ID:
            ds["fingerprint"] = ai_fingerprint()
            _write_seed(ds)
        store.save_dataset(ds)
        store.update_job(job_id, status="done", stage="done")
        log.info("dataset %s processed: %d tweets", dataset_id, len(tweets))
    except Exception as e:  # noqa: BLE001 — surface any failure to the UI
        traceback.print_exc()
        store.update_job(job_id, status="failed", stage="failed", error=str(e))


def _write_seed(ds: Dict):
    tmp = SAMPLE_SEED.with_suffix(".tmp")
    tmp.write_text(json.dumps(ds, separators=(",", ":")))
    os.replace(tmp, SAMPLE_SEED)
