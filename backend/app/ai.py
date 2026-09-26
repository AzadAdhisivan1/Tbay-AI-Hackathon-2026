import os
import sys
from typing import Dict, List, Optional

# Add ai_workflow directory to import path
AI_WORKFLOW_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ai_workflow"))
if AI_WORKFLOW_DIR not in sys.path:
    sys.path.insert(0, AI_WORKFLOW_DIR)

try:
    from analyzer import analyze_tweet
except ImportError:
    analyze_tweet = None

# Categories supported by backend UI
CATEGORIES = [
    "infrastructure_damage",  # roads, bridges, homes, power out
    "evacuation",             # evac orders, shelters, displaced people
    "rescue_help",            # people needing help / rescue requests
    "donations_volunteering", # donate, volunteer, relief efforts
    "weather_water_levels",   # rain, river levels, warnings
    "sympathy_support",       # prayers, solidarity, stay safe
    "other_related",          # related but none of the above
]

CATEGORY_MAP = {
    "infrastructure_damage": "infrastructure_damage",
    "evacuation": "evacuation",
    "request_for_help": "rescue_help",
    "medical_need": "rescue_help",
    "volunteer_relief_effort": "donations_volunteering",
    "official_update": "weather_water_levels",
    "general_concern": "sympathy_support",
    "other": "other_related",
}


def classify_batch(texts: List[str]) -> List[Dict]:
    """
    Classifies a batch of tweets by connecting directly to the ai_workflow analyzer.
    """
    results = []
    for text in texts:
        if analyze_tweet:
            res = analyze_tweet(text, geocode=False)
            cat = res.get("category")
            mapped_cat = CATEGORY_MAP.get(cat, "other_related") if res.get("is_relevant") else None
            locs = [l.get("raw_text") for l in res.get("locations", []) if l.get("raw_text")]
            results.append({
                "relevant": res.get("is_relevant", False),
                "confidence": res.get("relevance_confidence", 0.5),
                "category": mapped_cat,
                "severity": res.get("severity"),
                "locations": locs,
                "reasoning": res.get("reasoning", "")
            })
        else:
            # Basic fallback if module not found
            results.append({
                "relevant": False,
                "confidence": 0.5,
                "category": None,
                "severity": None,
                "locations": [],
                "reasoning": "Analyzer unavailable"
            })
    return results


def summarize(texts: List[str]) -> str:
    """
    Summarizes a set of relevant tweets for UI overview using ai_workflow analyzer insights.
    """
    if not texts:
        return "No relevant tweets match the current filters."
    
    total = len(texts)
    classified = classify_batch(texts[:50])
    relevant_count = sum(1 for c in classified if c["relevant"])
    
    categories = {}
    places = []
    for c in classified:
        if c["relevant"]:
            cat = c.get("category") or "other_related"
            categories[cat] = categories.get(cat, 0) + 1
            places.extend(c.get("locations", []))
            
    top_cats = ", ".join(f"{cat.replace('_', ' ')} ({cnt})" for cat, cnt in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3])
    unique_places = list(dict.fromkeys(places))[:5]
    places_str = "; ".join(unique_places) if unique_places else "no specific places"
    
    return (
        f"Analyzed {total} relevant tweets. Key disaster impacts identified: {top_cats or 'general emergency updates'}. "
        f"Key location mentions: {places_str}."
    )

