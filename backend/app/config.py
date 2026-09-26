import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
DATA_DIR = BACKEND_DIR / "data"
DATASETS_DIR = DATA_DIR / "datasets"
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_CSV = BACKEND_DIR.parent / "CE Strategies" / "main_contestant.csv"
SAMPLE_DATASET_ID = "sample"
# Precomputed sample (committed) so deployed servers don't reprocess on every cold start.
SAMPLE_SEED = DATA_DIR / "sample_seed.json"

AI_WORKFLOW_DIR = BACKEND_DIR.parent / "ai_workflow"

# Built React app (npm run build). Served by the backend in production.
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"

# Comma-separated list of frontend origins, e.g. "https://our-app.vercel.app,http://localhost:5173"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

GEOCODE_COUNTRY_CODES = os.getenv("GEOCODE_COUNTRY_CODES", "ca")
GEOCODE_USER_AGENT = os.getenv("GEOCODE_USER_AGENT", "LivingFloodMap-TbayHackathon/1.0")

# Tweets per AI batch — with the LLM on, one batch = one API request.
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
# How many AI batches run at once. Lower it if the model API rate-limits you.
AI_CONCURRENCY = int(os.getenv("AI_CONCURRENCY", "4"))
# Max new Nominatim lookups per dataset (~1/s). Cached names don't count.
GEOCODE_MAX_LOOKUPS = int(os.getenv("GEOCODE_MAX_LOOKUPS", "250"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_SUMMARY_TWEETS = int(os.getenv("MAX_SUMMARY_TWEETS", "300"))

# --- Hackathon Gemini API ----------------------------------------------------
HACKATHON_API_KEY = os.getenv("HACKATHON_API_KEY", "").strip()
HACKATHON_API_URL = os.getenv(
    "HACKATHON_API_URL",
    "https://hackathon-api-new-152590733511.northamerica-northeast2.run.app/api/generate")
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()  # empty = the service default
# Set LLM_ENABLED=0 to test uploads locally without spending quota.
LLM_ENABLED = os.getenv("LLM_ENABLED", "1") not in ("0", "false", "no")
# Stop calling the LLM when requests_remaining drops to this (kept for summaries/judging).
LLM_MIN_REMAINING = int(os.getenv("LLM_MIN_REMAINING", "40"))
# Parallel LLM requests (the hackathon service returned 500s at 4 in parallel).
LLM_CONCURRENCY = int(os.getenv("LLM_CONCURRENCY", "2"))
# Stop using the LLM for this server run after this many failures in a row.
LLM_MAX_CONSECUTIVE_FAILURES = int(os.getenv("LLM_MAX_CONSECUTIVE_FAILURES", "3"))
# Max LLM requests per uploaded dataset (x BATCH_SIZE tweets); the rest use the rule engine.
LLM_MAX_REQUESTS_PER_DATASET = int(os.getenv("LLM_MAX_REQUESTS_PER_DATASET", "170"))
# Only when explicitly set does (re)processing the provided sample use the LLM — so a
# deployed server never spends quota on it. Set it locally when regenerating sample_seed.json.
SAMPLE_USE_LLM = os.getenv("SAMPLE_USE_LLM", "0") in ("1", "true", "yes")
