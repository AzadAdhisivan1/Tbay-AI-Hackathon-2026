import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent
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

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
# How many AI batches run at once. Lower it if the model API rate-limits you.
AI_CONCURRENCY = int(os.getenv("AI_CONCURRENCY", "4"))
# Max new Nominatim lookups per dataset (~1/s). Cached names don't count.
GEOCODE_MAX_LOOKUPS = int(os.getenv("GEOCODE_MAX_LOOKUPS", "250"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_SUMMARY_TWEETS = int(os.getenv("MAX_SUMMARY_TWEETS", "300"))
