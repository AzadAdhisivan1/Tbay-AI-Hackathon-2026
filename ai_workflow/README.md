# AI Workflow - Disaster Response Tweet Analyst

A real-time disaster social media monitoring system designed for emergency response coordinators. Analyzes tweets during active disaster events (floods, wildfires, storms, earthquakes) to filter noise, classify relevance, rate emergency severity, extract place names, and resolve geocoded latitude/longitude coordinates.

---

## 🎯 Task & System Prompt Specification

The module evaluates incoming social media posts and produces a strictly formatted JSON output containing:

```json
{
  "is_relevant": true,
  "relevance_confidence": 0.95,
  "category": "infrastructure_damage",
  "severity": "high",
  "locations": [
    {
      "raw_text": "Calgary",
      "location_confidence": 0.9,
      "geocoded": true,
      "lat": 51.0447,
      "lng": -114.0719,
      "display_name": "Calgary, AB, Canada"
    }
  ],
  "reasoning": "Tweet describes physical damage to infrastructure, roads, or property caused by the disaster."
}
```

### Schema Fields:
1. `is_relevant` (`boolean`): `true` if describing an unfolding disaster event, impact, rescue request, evacuation, official update, or relief effort.
2. `relevance_confidence` (`float`, 0.0 - 1.0): Confidence score in the relevance judgment.
3. `category` (`string` or `null`): One of `infrastructure_damage`, `evacuation`, `medical_need`, `request_for_help`, `official_update`, `volunteer_relief_effort`, `general_concern`, `other`.
4. `severity` (`string` or `null`): One of `low`, `medium`, `high`, `critical`.
5. `locations` (`array`): Extracted place mentions with `raw_text` and `location_confidence` (and resolved `lat`, `lng`, `display_name`).
6. `reasoning` (`string`): One concise sentence justifying the classification for human oversight.

---

## 📁 Repository Structure

```
ai_workflow/
├── README.md               # Documentation & API specifications
├── requirements.txt        # Python dependencies
├── prompt_template.py      # Prompt definitions & LLM prompt formatter
├── analyzer.py             # Dual-engine analyzer (LLM + Zero-Shot/Rule NLP)
├── geocoder.py             # Location resolver & offline/online geocoder
├── batch_processor.py      # High-performance CSV dataset processor
├── app.py                  # FastAPI REST API server
├── tests/
│   └── test_analyzer.py    # Unit test suite
└── data/
    ├── processed_tweets.json  # Exported processed tweet dataset
    ├── summary_metrics.json   # Aggregated metrics & location clusters
    └── processed_tweets.csv   # Exported CSV dataset
```

---

## 🚀 Quick Start & Usage

### 1. Installation
```bash
pip install -r requirements.txt
```

### 2. Single Tweet Analysis (Python)
```python
from analyzer import analyze_tweet

tweet = "Emergency help needed in High River! Water entering home on Elbow River, family trapped upstairs #sos #abflood"
result = analyze_tweet(tweet, geocode=True)

print(result)
```

### 3. Batch Process Dataset CSV
Process `main_contestant.csv` or any uploaded CSV:
```bash
python batch_processor.py "../CE Strategies/main_contestant.csv"
```

### 4. Run REST API Server
Start the FastAPI server:
```bash
uvicorn app:app --reload --port 8000
```
Access interactive API docs at `http://localhost:8000/docs`.

---

## 🔌 API Endpoints

### `POST /api/analyze-tweet`
Analyzes a single tweet.
- **Request Body:**
  ```json
  {
    "tweet": "Officials in #Calgary say evacuations will not end until water recedes #abflood",
    "geocode": true
  }
  ```
- **Response:** Strict JSON schema as defined above.

### `POST /api/process-csv`
Upload a custom CSV file (e.g., judge testing dataset). Returns processed records and summary metrics.

### `GET /api/dataset`
Explore processed dataset with query parameters:
- `is_relevant` (`bool`): Filter relevant/irrelevant tweets.
- `category` (`str`): Filter by category (e.g., `infrastructure_damage`).
- `severity` (`str`): Filter by severity (e.g., `critical`).
- `search` (`str`): Full-text search in tweets and reasoning.
- `page`, `limit`: Pagination parameters.

### `GET /api/summary`
Returns high-level statistics, category breakdown, severity metrics, top mapped location clusters, and critical emergency alerts.

---

## 🧪 Running Tests

Run the test suite:
```bash
python -m unittest discover tests
```
