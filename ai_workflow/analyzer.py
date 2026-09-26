"""
Disaster Response Tweet Analyzer Engine
Analyzes tweets according to strict requirements:
1. is_relevant (boolean)
2. relevance_confidence (float 0.0 - 1.0)
3. category (infrastructure_damage, evacuation, medical_need, request_for_help, official_update, volunteer_relief_effort, general_concern, other)
4. severity (low, medium, high, critical)
5. locations (array of {"raw_text": str, "location_confidence": float})
6. reasoning (string justification)

Supports both the official Hackathon Gemini API proxy and high-accuracy offline NLP Rule Engine.
"""

import os
import re
import json
import logging
import requests
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv

from prompt_template import (
    SYSTEM_PROMPT,
    BATCH_RESPONSE_SCHEMA,
    format_tweet_prompt,
    format_batch_prompt,
    format_summary_prompt,
)
from geocoder import resolve_locations

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

HACKATHON_API_BASE = "https://hackathon-api-new-152590733511.northamerica-northeast2.run.app"

# Disaster keyword patterns (English + French + hashtags)
DISASTER_RELEVANCE_PATTERNS = [
    r'\b(flood|floods|flooding|flooded|under\s+water|underwater)\b',
    r'\b(evacuat(e|ed|ing|ion|ions)|évacuation|evacuation|displac(e|ed|ing|ement))\b',
    r'\b(rescue|rescued|rescuing|shelter|shelters|secours|sinistrés|sinistres)\b',
    r'\b(submerge|submerged|waterlevel|water levels|montée des eaux|montee des eaux)\b',
    r'\b(sandbag|sandbags|sandbagging)\b',
    r'\b(dike|levee|dam|overflow|overflowing)\b',
    r'\b(power outage|without power|blackout|grid down)\b',
    r'\b(wildfire|fire|blaze|flames|smoke evacuation)\b',
    r'\b(storm|tornado|hurricane|landslide|mudslide|glissement de terrain)\b',
    r'\b(state of emergency|emergency declared|red cross|relief effort|urgence)\b',
    r'\b(need help|needs help|help needed|family trapped|families need help)\b',
    r'\b(inondation|inondations|route fermée|route fermee)\b',
    r'#(abflood|mbflood|skflood|onflood|qcflood|bcflood|yycflood|yccflood|calgaryflood|highriverflood|inondation|inondations)\b',
]

# Sarcasm / Casual / Non-disaster filters
NON_RELEVANT_PATTERNS = [
    r'\b(camping|vacation|party|taco|tequila|skated|tanning|movie|game|poker)\b',
    r'\b(just a joke|lol|haha|lmao|sarcasm|funny)\b',
]

KNOWN_LOCATIONS_REGEX = [
    (r'\b(calgary|yyc)\b', 'Calgary', 0.9),
    (r'\b(high river)\b', 'High River', 0.9),
    (r'\b(fort mcmurray|fort mac)\b', 'Fort McMurray', 0.9),
    (r'\b(canmore)\b', 'Canmore', 0.9),
    (r'\b(lethbridge)\b', 'Lethbridge', 0.9),
    (r'\b(medicine hat)\b', 'Medicine Hat', 0.9),
    (r'\b(edmonton|yeg)\b', 'Edmonton', 0.9),
    (r'\b(banff)\b', 'Banff', 0.9),
    (r'\b(okotoks)\b', 'Okotoks', 0.9),
    (r'\b(bragg creek)\b', 'Bragg Creek', 0.9),
    (r'\b(cochrane)\b', 'Cochrane', 0.9),
    (r'\b(thunder bay)\b', 'Thunder Bay', 0.9),
    (r'\b(pickle lake)\b', 'Pickle Lake', 0.9),
    (r'\b(kashechewan)\b', 'Kashechewan', 0.9),
    (r'\b(red earth cree)\b', 'Red Earth Cree', 0.9),
    (r'\b(peguis|peguis first nation)\b', 'Peguis First Nation', 0.9),
    (r'\b(siska|siska first nation)\b', 'Siska First Nation', 0.9),
    (r'\b(siksika|siksika nation)\b', 'Siksika Nation', 0.9),
    (r'\b(selkirk)\b', 'Selkirk', 0.9),
    (r'\b(millennium park)\b', 'Millennium Park', 0.85),
    (r'\b(henderson park)\b', 'Henderson Park', 0.85),
    (r'\b(elbow river)\b', 'Elbow River', 0.85),
    (r'\b(bow river)\b', 'Bow River', 0.85),
    (r'\b(bowness)\b', 'Bowness', 0.85),
    (r'\b(sunnyside)\b', 'Sunnyside', 0.85),
    (r'\b(bridgeland)\b', 'Bridgeland', 0.85),
    (r'\b(inglewood)\b', 'Inglewood', 0.85),
    (r'\b(mission)\b', 'Mission', 0.8),
    (r'\b(victoria park)\b', 'Victoria Park', 0.85),
    (r'\b(saddledome)\b', 'Saddledome', 0.85),
    (r'\b(highway 599|hwy 599)\b', 'Highway 599', 0.95),
    (r'\b(highway 2|hwy 2)\b', 'Highway 2', 0.85),
    (r'\b(route 9)\b', 'Route 9', 0.85),
    (r'\b(alberta|ab)\b', 'Alberta', 0.75),
    (r'\b(western canada)\b', 'Western Canada', 0.7),
]

JUNK_LOCATION_WORDS = {
    'prince', 'hope', 'titanic', 'criminal minds', 'canada', 'alberta', 'ontario',
    'manitoba', 'saskatchewan', 'quebec', 'british columbia', 'global news', 'news',
    'facebook', 'twitter', 'youtube', 'instagram', 'god', 'lord', 'happy', 'lol',
    'omg', 'rt', 'canadian', 'america', 'american', 'daily', 'today', 'tonight',
    'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december', 'photo',
    'video', 'pics', 'image', 'water', 'flood', 'floods', 'flooding', 'evacuation',
    'first', 'second', 'third', 'some', 'many', 'all', 'this', 'that', 'with'
}


def analyze_tweet_nlp(tweet_text: str) -> Dict[str, Any]:
    """
    High-accuracy rule-based & pattern matching analyzer for offline fallback.
    Supports English and French emergency terms and filters place false positives.
    """
    text = tweet_text.strip()
    text_lower = text.lower()

    # 1. Relevance Detection
    matches = []
    for pattern in DISASTER_RELEVANCE_PATTERNS:
        if re.search(pattern, text_lower):
            matches.append(pattern)

    is_joke_or_casual = False
    if any(re.search(pat, text_lower) for pat in [r'\bcamping\b', r'\bparty\b', r'\btaco\b', r'\bpoker\b', r'\bskated when i lived\b']):
        if not any(kw in text_lower for kw in ['displace', 'evacuat', 'trapped', 'without power', 'floods displace', 'under water', 'need help']):
            is_joke_or_casual = True

    is_relevant = len(matches) > 0 and not is_joke_or_casual

    if not is_relevant:
        if any(tag in text_lower for tag in ['#abflood', '#mbflood', '#skflood', '#yycflood', '#yccflood', '#flooding', '#floods', '#inondation']):
            if not is_joke_or_casual:
                is_relevant = True

    confidence = round(min(0.95, 0.70 + (len(matches) * 0.10)), 2) if is_relevant else (0.90 if is_joke_or_casual or len(matches) == 0 else 0.60)

    if not is_relevant:
        return {
            "is_relevant": False,
            "relevance_confidence": confidence,
            "category": None,
            "severity": None,
            "locations": [],
            "reasoning": "Tweet does not describe active disaster conditions, impact, or official relief efforts."
        }

    # 2. Category Classification
    category = "general_concern"

    if re.search(r'\b(trapped|rescue|help us|sos|need help|needs help|please help|missing|secours)\b', text_lower):
        category = "request_for_help"
    elif re.search(r'\b(doctor|hospital|injured|ambulance|medical|blood|triage|blessé)\b', text_lower):
        category = "medical_need"
    elif re.search(r'\b(evacuat|évacuation|evacuation|displac|flee|leave home|shelter order)\b', text_lower):
        category = "evacuation"
    elif re.search(r'\b(bridge|road|route|power|outage|submerged|basement|home flood|under water|underwater|building|dam|dike|impassable|closed|fermée|fermee)\b', text_lower):
        category = "infrastructure_damage"
    elif re.search(r'\b(official|news|city of|police|officials say|mayor|statement|gov|announcement|press release)\b', text_lower) or text.startswith('#News') or 'http' in text_lower:
        category = "official_update"
    elif re.search(r'\b(volunteer|sandbag|donation|red cross|shelter open|food bank|supplies|helping)\b', text_lower):
        category = "volunteer_relief_effort"
    elif re.search(r'\b(pray|solidarity|proud|stay safe|thoughts|thinking of|hope)\b', text_lower):
        category = "general_concern"
    else:
        category = "other"

    # 3. Severity Classification
    severity = "medium"

    if category == "request_for_help" or re.search(r'\b(trapped|drowning|life threatening|missing person|critical|injured|emergency call)\b', text_lower):
        severity = "critical"
    elif category == "evacuation" or re.search(r'\b(without power|30,000|displace|home flooded|homes under water|under water|no clean water|impassable|major damage|mandatory)\b', text_lower):
        severity = "high"
    elif category in ["general_concern", "volunteer_relief_effort"] or re.search(r'\b(minor|postponed|skated|pics|solidarity|proud)\b', text_lower):
        severity = "low"
    else:
        severity = "medium"

    # 4. Location Extraction (Strict regex to eliminate non-place words)
    extracted_locations = []
    seen_locs = set()

    for pattern, place_name, loc_conf in KNOWN_LOCATIONS_REGEX:
        if re.search(pattern, text_lower):
            if place_name.lower() not in seen_locs:
                seen_locs.add(place_name.lower())
                extracted_locations.append({
                    "raw_text": place_name,
                    "location_confidence": loc_conf
                })

    hashtags = re.findall(r'#([A-Za-z0-9]+)', text)
    for tag in hashtags:
        tag_clean = tag.lower()
        if tag_clean in ['calgary', 'lethbridge', 'fortmac', 'highriver', 'canmore', 'yyc', 'yeg', 'peguis', 'selkirk']:
            if tag_clean not in seen_locs:
                seen_locs.add(tag_clean)
                extracted_locations.append({
                    "raw_text": tag,
                    "location_confidence": 0.85
                })

    # Strict phrase extractor: requires specific location keywords or multi-word proper nouns not in junk list
    place_candidates = re.findall(r'\b(?:in|near|at|around|de|à|a)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', text)
    location_indicators = {'river', 'park', 'lake', 'road', 'street', 'hwy', 'highway', 'route', 'city', 'town', 'nation', 'bridge', 'creek', 'bay'}

    for p in place_candidates:
        p_clean = p.strip()
        p_lower = p_clean.lower()
        words = p_lower.split()

        # Reject junk words or bare provinces/countries
        if any(w in JUNK_LOCATION_WORDS for w in words):
            continue
        if len(p_clean) < 3:
            continue

        # Check if it has an indicator word or is a multi-word proper noun
        is_known = any(k in p_lower for k in ['calgary', 'river', 'peguis', 'selkirk', 'high river'])
        has_indicator = any(ind in p_lower for ind in location_indicators)

        if is_known or has_indicator or len(words) >= 2:
            if p_lower not in seen_locs:
                seen_locs.add(p_lower)
                extracted_locations.append({
                    "raw_text": p_clean,
                    "location_confidence": 0.80 if has_indicator else 0.70
                })

    reasoning_map = {
        "evacuation": "Tweet reports active evacuation notices or displacement during the disaster event.",
        "infrastructure_damage": "Tweet describes physical damage to infrastructure, roads, or property caused by the disaster.",
        "request_for_help": "Tweet indicates an urgent call for emergency assistance or rescue.",
        "medical_need": "Tweet highlights immediate medical requirements or injuries.",
        "official_update": "Tweet shares official announcements, news updates, or emergency instructions.",
        "volunteer_relief_effort": "Tweet mentions community volunteering, relief donations, or sandbagging efforts.",
        "general_concern": "Tweet expresses public reaction, concern, or solidarity regarding the disaster.",
        "other": "Tweet provides relevant disaster information."
    }
    reasoning = reasoning_map.get(category, "Tweet contains relevant information regarding the disaster event.")

    return {
        "is_relevant": True,
        "relevance_confidence": confidence,
        "category": category,
        "severity": severity,
        "locations": extracted_locations,
        "reasoning": reasoning
    }


def call_hackathon_gemini_api(prompt: str, response_schema: Optional[Dict] = None) -> Tuple[Optional[str], Optional[int]]:
    """
    Calls the official Hackathon Gemini API proxy at:
    POST https://hackathon-api-new-152590733511.northamerica-northeast2.run.app/api/generate
    Headers: X-API-Key: <HACKATHON_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY>

    Returns (text_response, requests_remaining).

    QUOTA LOCK: these calls are one request PER TWEET, and the hackathon quota is
    small, so they only happen when ALLOW_PER_TWEET_LLM=1 is set on purpose.
    Otherwise callers (batch_processor.py, app.py) fall back to the free NLP engine.
    The deployed backend doesn't use this — it batches 50 tweets per request itself.
    """
    if os.environ.get("ALLOW_PER_TWEET_LLM", "0").lower() not in ("1", "true", "yes"):
        return None, None

    api_key = (
        os.environ.get("HACKATHON_API_KEY") or
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key:
        logger.warning("No API key configured in HACKATHON_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY.")
        return None, None

    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "contents": prompt
    }
    if response_schema:
        payload["response_schema"] = response_schema

    try:
        url = f"{HACKATHON_API_BASE}/api/generate"
        res = requests.post(url, headers=headers, json=payload, timeout=20)
        if res.status_code == 200:
            data = res.json()
            text = data.get("text")
            remaining = data.get("requests_remaining")
            return text, remaining
        else:
            logger.warning(f"Hackathon API returned status {res.status_code}: {res.text}")
            return None, None
    except Exception as e:
        logger.warning(f"Hackathon API exception: {e}")
        return None, None


def analyze_tweet_llm(tweet_text: str) -> Tuple[Optional[Dict[str, Any]], Optional[int]]:
    """
    Evaluates tweet using the official Hackathon Gemini API proxy.
    Returns (result_dict, requests_remaining).
    """
    prompt = format_tweet_prompt(tweet_text)
    text_resp, remaining = call_hackathon_gemini_api(prompt)
    if text_resp:
        try:
            content = text_resp.strip()
            if content.startswith("```"):
                content = re.sub(r'^```json\s*', '', content)
                content = re.sub(r'^```\s*', '', content)
                content = re.sub(r'\s*```$', '', content)
            return json.loads(content), remaining
        except Exception as e:
            logger.warning(f"Failed to parse LLM JSON response: {e}")
    return None, remaining


def analyze_tweet(tweet_text: str, geocode: bool = True) -> Dict[str, Any]:
    """
    Main entrypoint for analyzing a tweet.
    Tries LLM first via Hackathon API proxy, falls back seamlessly to NLP rule engine.
    """
    result, _ = analyze_tweet_llm(tweet_text)
    if not result:
        result = analyze_tweet_nlp(tweet_text)

    if "is_relevant" not in result:
        result["is_relevant"] = False
    if "relevance_confidence" not in result:
        result["relevance_confidence"] = 0.5
    if "category" not in result:
        result["category"] = None
    if "severity" not in result:
        result["severity"] = None
    if "locations" not in result or not isinstance(result["locations"], list):
        result["locations"] = []
    if "reasoning" not in result:
        result["reasoning"] = "Analysis complete."

    if result["is_relevant"] and geocode and result["locations"]:
        # Standardize format for geocoder
        formatted_locs = []
        for l in result["locations"]:
            if isinstance(l, dict):
                formatted_locs.append(l)
            elif isinstance(l, str):
                formatted_locs.append({"raw_text": l, "location_confidence": 0.85})
        result["locations"] = resolve_locations(formatted_locs)

    return result
