"""
Place name -> (lat, lon) using OpenStreetMap Nominatim, with a persistent cache.

Nominatim's usage policy: max 1 request/second and a real User-Agent. The cache
(data/geocode_cache.json) is committed to the repo so the deployed app doesn't
need to re-geocode the sample dataset.
"""
import json
import os
import threading
import time
from pathlib import Path
from typing import Dict, Optional

import httpx

from .config import DATA_DIR, GEOCODE_COUNTRY_CODES, GEOCODE_USER_AGENT

CACHE_PATH = DATA_DIR / "geocode_cache.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_lock = threading.Lock()
_last_request = 0.0
_cache: Dict[str, Optional[Dict]] = {}


def _load_cache():
    global _cache
    if CACHE_PATH.exists():
        _cache = json.loads(CACHE_PATH.read_text())


def _save_cache():
    tmp = CACHE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(_cache, indent=0, sort_keys=True))
    os.replace(tmp, CACHE_PATH)


def _query(name: str, countrycodes: Optional[str]) -> Optional[Dict]:
    global _last_request
    wait = 1.1 - (time.time() - _last_request)
    if wait > 0:
        time.sleep(wait)
    params = {"q": name, "format": "json", "limit": 1}
    if countrycodes:
        params["countrycodes"] = countrycodes
    try:
        r = httpx.get(NOMINATIM_URL, params=params,
                      headers={"User-Agent": GEOCODE_USER_AGENT}, timeout=10)
        _last_request = time.time()
        r.raise_for_status()
        results = r.json()
    except (httpx.HTTPError, ValueError):
        _last_request = time.time()
        return None
    if not results:
        return None
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]), "display_name": top.get("display_name")}


def geocode(name: str) -> Optional[Dict]:
    """Returns {"lat", "lon", "display_name"} or None. Thread-safe, cached."""
    key = name.strip().lower()
    if not key:
        return None
    with _lock:
        if key in _cache:
            return _cache[key]
        # Prefer the configured country (e.g. Canada) first, then fall back to anywhere.
        result = _query(name, GEOCODE_COUNTRY_CODES) if GEOCODE_COUNTRY_CODES else None
        if result is None:
            result = _query(name, None)
        _cache[key] = result
        _save_cache()
        return result


def is_cached(name: str) -> bool:
    return name.strip().lower() in _cache


_load_cache()
