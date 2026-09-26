"""
Robust CSV parsing. Judges will upload an unseen CSV, so we can't assume column
names — we detect the tweet-text column (and optional date / lat / lon columns).
"""
import csv
import io
from typing import Dict, List, Optional

csv.field_size_limit(10_000_000)

TEXT_COLUMN_NAMES = ["tweet", "text", "tweet_text", "full_text", "content", "body", "message", "post"]
DATE_COLUMN_NAMES = ["created_at", "date", "datetime", "timestamp", "time", "tweet_created_at", "posted", "posted_at", "created"]
LAT_COLUMN_NAMES = ["lat", "latitude", "y"]
LON_COLUMN_NAMES = ["lon", "lng", "long", "longitude", "x"]


class CSVError(ValueError):
    pass


def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise CSVError("Could not decode file (tried utf-8, cp1252, latin-1).")


def _find_column(fieldnames: List[str], candidates: List[str]) -> Optional[str]:
    norm = {f.strip().lower(): f for f in fieldnames if f}
    for c in candidates:
        if c in norm:
            return norm[c]
    return None


def _to_float(v) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_tweets_csv(raw: bytes) -> List[Dict]:
    """
    Returns a list of tweet records:
        {"id": int, "text": str, "created_at": str|None,
         "lat": float|None, "lon": float|None, "meta": {other columns}}
    """
    text = _decode(raw)
    if not text.strip():
        raise CSVError("File is empty.")

    try:
        dialect = csv.Sniffer().sniff(text[:5000], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    fieldnames = [f for f in (reader.fieldnames or []) if f is not None]
    if not fieldnames:
        raise CSVError("No header row found.")
    rows = list(reader)

    text_col = _find_column(fieldnames, TEXT_COLUMN_NAMES)
    if text_col is None:
        # Single unnamed column: the "header" is probably the first tweet.
        if len(fieldnames) == 1 and len(fieldnames[0]) > 30:
            rows.insert(0, {fieldnames[0]: fieldnames[0]})
            text_col = fieldnames[0]
        else:
            # Fall back to the column with the longest average text.
            def avg_len(col):
                vals = [len(r.get(col) or "") for r in rows[:500]]
                return sum(vals) / max(len(vals), 1)
            text_col = max(fieldnames, key=avg_len)

    date_col = _find_column(fieldnames, DATE_COLUMN_NAMES)
    lat_col = _find_column(fieldnames, LAT_COLUMN_NAMES)
    lon_col = _find_column(fieldnames, LON_COLUMN_NAMES)
    used = {text_col, date_col, lat_col, lon_col}

    tweets = []
    for row in rows:
        body = (row.get(text_col) or "").strip()
        if not body:
            continue
        lat = _to_float(row.get(lat_col)) if lat_col else None
        lon = _to_float(row.get(lon_col)) if lon_col else None
        if lat is not None and lon is not None and not (-90 <= lat <= 90 and -180 <= lon <= 180):
            lat = lon = None
        tweets.append({
            "id": len(tweets),
            "text": body,
            "created_at": (row.get(date_col) or None) if date_col else None,
            "lat": lat,
            "lon": lon,
            "meta": {k: v for k, v in row.items() if k not in used and k is not None},
        })

    if not tweets:
        raise CSVError(f"No tweet text found (used column '{text_col}').")
    return tweets
