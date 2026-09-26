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

# Built React app (npm run build). Served by the backend in production.
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"

# Comma-separated list of frontend origins, e.g. "https://our-app.vercel.app,http://localhost:5173"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

GEOCODE_COUNTRY_CODES = os.getenv("GEOCODE_COUNTRY_CODES", "ca")
GEOCODE_USER_AGENT = os.getenv("GEOCODE_USER_AGENT", "LivingFloodMap-TbayHackathon/1.0")

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_SUMMARY_TWEETS = int(os.getenv("MAX_SUMMARY_TWEETS", "300"))
