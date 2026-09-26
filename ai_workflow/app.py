"""
FastAPI Disaster Response Intelligence Server for ai_workflow.
Provides REST API endpoints for single tweet prompt analysis, dataset exploration,
CSV batch processing, location mapping, and emergency coordinator insights.
"""

import os
import json
import shutil
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analyzer import analyze_tweet
from batch_processor import process_csv_dataset
from prompt_template import SYSTEM_PROMPT

app = FastAPI(
    title="Disaster Response AI Analyst API",
    description="Real-time disaster social media monitoring, relevance classification, location extraction, and emergency intelligence.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PROCESSED_JSON = os.path.join(DATA_DIR, "processed_tweets.json")
SUMMARY_JSON = os.path.join(DATA_DIR, "summary_metrics.json")


# Request/Response Models
class TweetRequest(BaseModel):
    tweet: str = Field(..., description="Single tweet text to analyze", example="Officials in Calgary say evacuations will not end until water recedes #abflood")
    geocode: Optional[bool] = Field(True, description="Whether to geocode extracted locations into lat/lng coordinates")


class LocationItem(BaseModel):
    raw_text: str
    location_confidence: float
    geocoded: Optional[bool] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    display_name: Optional[str] = None


class TweetAnalysisResponse(BaseModel):
    is_relevant: bool
    relevance_confidence: float
    category: Optional[str]
    severity: Optional[str]
    locations: List[LocationItem]
    reasoning: str


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Disaster Response Analyst AI",
        "system_prompt": SYSTEM_PROMPT[:150] + "...",
        "endpoints": [
            "POST /api/analyze-tweet",
            "POST /api/process-csv",
            "GET /api/dataset",
            "GET /api/summary",
            "GET /api/health"
        ]
    }


@app.get("/api/health")
def health_check():
    dataset_ready = os.path.exists(PROCESSED_JSON)
    return {
        "status": "ok",
        "dataset_loaded": dataset_ready,
        "processed_file": PROCESSED_JSON if dataset_ready else None
    }


@app.post("/api/analyze-tweet", response_model=TweetAnalysisResponse)
def analyze_single_tweet(request: TweetRequest):
    """
    Analyzes a single tweet according to the strict prompt specifications.
    Returns JSON containing is_relevant, relevance_confidence, category, severity, locations, and reasoning.
    """
    if not request.tweet or not request.tweet.strip():
        raise HTTPException(status_code=400, detail="Tweet text cannot be empty.")
        
    analysis = analyze_tweet(request.tweet.strip(), geocode=request.geocode)
    return analysis


@app.post("/api/process-csv")
async def process_csv_file(file: UploadFile = File(...), geocode: bool = True):
    """
    Upload a custom CSV of tweets (e.g. during hackathon judging).
    Analyzes every tweet in the uploaded file, saves results, and returns summary metrics.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .csv format.")
        
    temp_path = os.path.join(DATA_DIR, f"upload_{file.filename}")
    os.makedirs(DATA_DIR, exist_ok=True)
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        results = process_csv_dataset(temp_path, output_dir=DATA_DIR, geocode=geocode)
        return {
            "message": f"Successfully processed custom dataset: {file.filename}",
            "summary": results["summary_metrics"],
            "sample_tweets": results["processed_records"][:10]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV dataset: {str(e)}")


@app.get("/api/dataset")
def get_dataset(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    is_relevant: Optional[bool] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    has_location: Optional[bool] = None
):
    """
    Explores and filters processed dataset with search, category, severity, and location filters.
    """
    if not os.path.exists(PROCESSED_JSON):
        raise HTTPException(status_code=404, detail="Processed dataset not found. Please run batch_processor.py first.")
        
    with open(PROCESSED_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)
        
    filtered = records
    
    if is_relevant is not None:
        filtered = [r for r in filtered if r["is_relevant"] == is_relevant]
        
    if category:
        filtered = [r for r in filtered if r.get("category") == category]
        
    if severity:
        filtered = [r for r in filtered if r.get("severity") == severity]
        
    if has_location is True:
        filtered = [r for r in filtered if len(r.get("locations", [])) > 0]
    elif has_location is False:
        filtered = [r for r in filtered if len(r.get("locations", [])) == 0]
        
    if search:
        s = search.lower()
        filtered = [r for r in filtered if s in r["tweet"].lower() or (r.get("reasoning") and s in r["reasoning"].lower())]
        
    total_count = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered[start_idx:end_idx]
    
    return {
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "total_pages": (total_count + limit - 1) // limit,
        "records": paginated
    }


@app.get("/api/summary")
def get_summary_metrics():
    """
    Returns high-level summary dashboard metrics, location clusters for mapping, and critical alerts.
    """
    if not os.path.exists(SUMMARY_JSON):
        raise HTTPException(status_code=404, detail="Summary metrics not found. Please run batch_processor.py first.")
        
    with open(SUMMARY_JSON, "r", encoding="utf-8") as f:
        metrics = json.load(f)
        
    return metrics
