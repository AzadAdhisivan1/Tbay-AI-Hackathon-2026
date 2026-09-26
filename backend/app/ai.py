"""
AI layer — what the backend pipeline calls.

  classify_batch(texts, use_llm=True) -> [dict]   one dict per tweet, same order
  summarize(texts) -> str

Classification uses the hackathon Gemini API (HACKATHON_API_KEY) with ONE request per
batch of tweets (structured JSON output). Whenever the LLM is unavailable, disabled,
over budget or fails, it falls back to the ai_workflow rule engine (analyze_tweet_nlp),
so the app always works.

Quota: the hackathon key has a small fixed quota (~500 requests) and failed requests
count too, so there are no automatic retries and we stop calling the LLM once
`requests_remaining` drops to LLM_MIN_REMAINING (kept for summaries/judging).
"""
import hashlib
import json
import logging
import re
import sys
import threading
from collections import Counter
from typing import Dict, List, Optional

import httpx

from .config import (AI_WORKFLOW_DIR, HACKATHON_API_KEY, HACKATHON_API_URL, LLM_CONCURRENCY,
                     LLM_ENABLED, LLM_MAX_CONSECUTIVE_FAILURES, LLM_MIN_REMAINING, LLM_MODEL)

log = logging.getLogger("ai")

if str(AI_WORKFLOW_DIR) not in sys.path:
    sys.path.insert(0, str(AI_WORKFLOW_DIR))
try:
    from analyzer import analyze_tweet_nlp  # ai_workflow rule engine (no network)
except Exception:  # a broken analyzer.py must not take the whole backend down
    log.exception("Could not import ai_workflow/analyzer.py — every tweet will be marked unrelated")
    analyze_tweet_nlp = None
try:  # the AI teammate's batch prompt in ai_workflow (optional)
    from prompt_template import format_batch_prompt
except Exception:
    format_batch_prompt = None
try:
    from prompt_template import format_summary_prompt
except Exception:
    format_summary_prompt = None

# Categories the UI filters on.
CATEGORIES = [
    "infrastructure_damage",  # roads, bridges, homes, power out
    "evacuation",             # evac orders, shelters, displaced people
    "rescue_help",            # people needing help / rescue / medical
    "donations_volunteering", # donate, volunteer, relief efforts
    "weather_water_levels",   # official updates, river levels, warnings
    "sympathy_support",       # prayers, solidarity, stay safe
    "other_related",          # related but none of the above
]
SEVERITIES = ["low", "medium", "high", "critical"]
DISASTER_TYPES = ["flood", "storm", "wildfire", "earthquake", "explosion", "shooting",
                  "transport_accident", "haze", "other", "none"]
# Shared agreement: "relevant" = FLOOD-related. Tweets about these are never relevant.
NON_FLOOD_TYPES = {"storm", "wildfire", "earthquake", "explosion", "shooting",
                   "transport_accident", "haze"}

# Backend keyword rules. Used when neither the LLM nor ai_workflow's rule engine gives a
# disaster_type, and to decide which tweets are worth an LLM request. Flood wins over
# other types ("hurricane storm surge floods the city" -> flood).
_FLOOD_STRONG = re.compile(
    r"flood|inundat|inondation|inundaci|submerg|under ?water|flash ?flood|storm ?surge|"
    r"sandbag|levee|dyke|dike (breach|burst)|banjir|hochwasser|überschwemm|alluvione|"
    r"enchente|洪水|#(ab|yyc|qld|bc|mb|sk|ph)?flood|#rescueph|#floodph", re.IGNORECASE)
_FLOOD_WEAK = re.compile(
    r"high water|water ?level|river|overflow|deluge|torrential|heavy rain|rainfall|downpour|"
    r"monsoon|typhoon|cyclone|hurricane|tropical storm|dam (burst|break|breach|release)|"
    r"evacuat|landslide|mudslide|#yyc|#abstrong|#highriver", re.IGNORECASE)
_OTHER_TYPES = [
    ("explosion", r"explo|bomb|blast|detonat"),
    ("shooting", r"shoot|shots fired|gunman|gunfire"),
    ("wildfire", r"wildfire|bushfire|forest fire|\bfire\b|blaze|burning"),
    ("earthquake", r"earthquake|quake|tsunami|aftershock|magnitude \d"),
    ("storm", r"hurricane|typhoon|cyclone|tornado|tropical storm|superstorm|blizzard|\bstorm\b"),
    ("transport_accident", r"derail|plane crash|train crash|helicopter crash|crash landing|capsiz"),
    ("haze", r"\bhaze\b|smog|\bpsi\b|air quality"),
]
_OTHER_TYPES = [(t, re.compile(p, re.IGNORECASE)) for t, p in _OTHER_TYPES]


def keyword_disaster_type(text: str) -> str:
    if _FLOOD_STRONG.search(text or ""):
        return "flood"
    for dtype, pattern in _OTHER_TYPES:
        if pattern.search(text or ""):
            return dtype
    return "none"


def llm_priority(text: str) -> int:
    """2 = clear flood signal, 1 = possibly flood-related, 0 = not worth an LLM request."""
    if _FLOOD_STRONG.search(text or ""):
        return 2
    return 1 if _FLOOD_WEAK.search(text or "") else 0

# ai_workflow / LLM categories -> UI categories
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
LLM_CATEGORIES = list(CATEGORY_MAP)


# ---------------------------------------------------------------------------
# LLM client with quota guard
# ---------------------------------------------------------------------------

class _Quota:
    def __init__(self):
        self.lock = threading.Lock()
        self.remaining: Optional[int] = None  # unknown until the first response
        self.disabled_reason: Optional[str] = None
        self.requests_made = 0
        self.consecutive_failures = 0
        self.slots = threading.BoundedSemaphore(max(1, LLM_CONCURRENCY))

    def record(self, ok: bool):
        with self.lock:
            self.consecutive_failures = 0 if ok else self.consecutive_failures + 1
            if self.consecutive_failures >= LLM_MAX_CONSECUTIVE_FAILURES and not self.disabled_reason:
                self.disabled_reason = f"{self.consecutive_failures} failed requests in a row"
                log.error("LLM disabled for this run — %s", self.disabled_reason)

    def can_spend(self) -> bool:
        with self.lock:
            if not (LLM_ENABLED and HACKATHON_API_KEY) or self.disabled_reason:
                return False
            return self.remaining is None or self.remaining > LLM_MIN_REMAINING


quota = _Quota()


def llm_status() -> Dict:
    return {
        "configured": bool(HACKATHON_API_KEY),
        "enabled": LLM_ENABLED and bool(HACKATHON_API_KEY) and not quota.disabled_reason,
        "active": quota.can_spend(),
        "model": LLM_MODEL or "default",
        "requests_remaining": quota.remaining,
        "reserve": LLM_MIN_REMAINING,
        "requests_made_this_run": quota.requests_made,
        "disabled_reason": quota.disabled_reason,
    }


def _generate(prompt: str, schema: Optional[Dict] = None, timeout: float = 90) -> Optional[str]:
    """One request to the hackathon API. Returns the text, or None. Never raises, never retries."""
    with quota.slots:
        if not quota.can_spend():  # re-checked after waiting for a slot
            return None
        text = _generate_once(prompt, schema, timeout)
    quota.record(text is not None)
    return text


def _generate_once(prompt: str, schema: Optional[Dict], timeout: float) -> Optional[str]:
    body = {"contents": prompt}
    if LLM_MODEL:
        body["model"] = LLM_MODEL
    if schema:
        body["response_schema"] = schema
    with quota.lock:
        quota.requests_made += 1
    try:
        r = httpx.post(HACKATHON_API_URL, json=body, timeout=timeout,
                       headers={"X-API-Key": HACKATHON_API_KEY})
    except httpx.HTTPError as e:
        log.warning("LLM request failed: %s", e)
        return None
    if r.status_code in (401, 403):
        quota.disabled_reason = f"HTTP {r.status_code}: key invalid or deactivated"
        log.error("LLM disabled — %s", quota.disabled_reason)
        return None
    if r.status_code == 429:
        with quota.lock:
            quota.remaining = 0
        log.error("LLM quota exhausted — using rule engine from now on")
        return None
    if r.status_code != 200:
        log.warning("LLM HTTP %s: %s", r.status_code, r.text[:1000])
        return None
    try:
        data = r.json()
    except ValueError:
        return None
    rem = data.get("requests_remaining")
    if isinstance(rem, int):
        with quota.lock:
            quota.remaining = rem
    log.info("LLM request ok (requests_remaining=%s)", rem)
    return data.get("text")


# ---------------------------------------------------------------------------
# Batch classification
# ---------------------------------------------------------------------------

_BATCH_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "is_relevant": {"type": "boolean"},
            "relevance_confidence": {"type": "number"},
            "category": {"type": "string", "enum": LLM_CATEGORIES + ["none"]},
            "severity": {"type": "string", "enum": SEVERITIES + ["none"]},
            "disaster_type": {"type": "string", "enum": DISASTER_TYPES},
            "locations": {"type": "array", "items": {"type": "string"}},
            "reasoning": {"type": "string"},
        },
        "required": ["id", "is_relevant", "relevance_confidence", "category", "severity",
                     "disaster_type", "locations", "reasoning"],
    },
}

_BATCH_INSTRUCTIONS = """You are a disaster-response analyst helping emergency coordinators monitor social media during an active disaster (flood, wildfire, storm, etc.). Below is a numbered list of tweets from the same time window. Analyze EVERY tweet and return one JSON object per tweet, with the same "id".

For each tweet:
- is_relevant: true ONLY if it is about FLOODING that is really happening (flood conditions, rising/high water, storm surge, flash floods, flood damage, flood evacuations, requests for help, official flood updates, flood relief). false for other disasters (explosions, shootings, fires, earthquakes, haze, and hurricanes/typhoons/tornadoes unless the tweet mentions flooding or water), and for unrelated tweets, jokes, ads or spam. Tweets may be in any language. When genuinely ambiguous, choose false with lower confidence.
- disaster_type: flood, storm, wildfire, earthquake, explosion, shooting, transport_accident, haze, other, or none (not about any disaster). Use flood whenever the tweet is about flooding, even if caused by a storm.
- relevance_confidence: 0.0-1.0.
- category (use "none" if not relevant): infrastructure_damage, evacuation, medical_need, request_for_help, official_update, volunteer_relief_effort, general_concern, other.
- severity (use "none" if not relevant): critical = immediate danger to life (trapped, injured, missing); high = urgent unmet need or major damage (home flooding, no clean water, road impassable, evacuation order); medium = notable impact, not urgent; low = general commentary, minor impact, secondhand observation.
- locations: every specific place mentioned (communities, First Nations, neighbourhoods, roads, bridges, rivers, landmarks). Make each as specific as the tweet allows, adding the city/province and the COUNTRY (outside Canada) when clear from context, e.g. "Mission, Calgary, Alberta", "Tacloban, Philippines", "Brisbane, Queensland, Australia". Expand hashtags/abbreviations ("#yyc" -> "Calgary, Alberta", "#highriver" -> "High River, Alberta"). Do NOT include bare provinces, countries or vague words like "downtown". Empty list if none or not relevant.
- reasoning: one short sentence (max 15 words).

TWEETS:
"""


# Appended to ai_workflow's batch prompt until it covers the flood-only rule and disaster_type.
_PROMPT_ADDENDUM = """

ADDITIONAL RULES (these override anything above):
- is_relevant means FLOOD-related only. Tweets about other disasters (explosions, shootings, fires, earthquakes, haze, hurricanes/typhoons/tornadoes without flooding or water) are NOT relevant.
- Add "disaster_type" to every object: flood, storm, wildfire, earthquake, explosion, shooting, transport_accident, haze, other, or none. Use flood whenever the tweet is about flooding, even if caused by a storm.
- For places outside Canada, include the country in each location, e.g. "Tacloban, Philippines".
- If is_relevant is false, use "none" for category and severity.
"""


def _default_batch_prompt(texts: List[str]) -> str:
    lines = "\n".join(f"{i}: {json.dumps(t, ensure_ascii=False)}" for i, t in enumerate(texts))
    return _BATCH_INSTRUCTIONS + lines


def _apply_flood_policy(result: Dict, text: str, given_type: Optional[str]) -> Dict:
    """Fill disaster_type and enforce: relevant == flood-related."""
    dtype = given_type if given_type in DISASTER_TYPES else keyword_disaster_type(text)
    if result["relevant"] and dtype in NON_FLOOD_TYPES and keyword_disaster_type(text) != "flood":
        result.update(relevant=False, category=None, severity=None, locations=[],
                      reasoning=f"About a {dtype.replace('_', ' ')}, not flooding.")
    if result["relevant"]:
        dtype = "flood"
    result["disaster_type"] = dtype
    return result


def _nlp(text: str) -> Dict:
    if analyze_tweet_nlp is None:
        return _apply_flood_policy(
            {"relevant": False, "confidence": 0.0, "category": None, "severity": None,
             "locations": [], "reasoning": "Analyzer unavailable", "source": "none"}, text, None)
    res = analyze_tweet_nlp(text)
    relevant = bool(res.get("is_relevant"))
    return _apply_flood_policy({
        "relevant": relevant,
        "confidence": float(res.get("relevance_confidence") or 0.5),
        "category": CATEGORY_MAP.get(res.get("category"), "other_related") if relevant else None,
        "severity": res.get("severity") if relevant else None,
        "locations": [l.get("raw_text") for l in res.get("locations", []) if l.get("raw_text")],
        "reasoning": res.get("reasoning", ""),
        "source": "rules",
    }, text, res.get("disaster_type"))


def _from_llm(row: Dict, text: str) -> Dict:
    relevant = bool(row.get("is_relevant"))
    sev = row.get("severity")
    try:
        conf = max(0.0, min(1.0, float(row.get("relevance_confidence"))))
    except (TypeError, ValueError):
        conf = 0.5
    return _apply_flood_policy({
        "relevant": relevant,
        "confidence": conf,
        "category": CATEGORY_MAP.get(row.get("category"), "other_related") if relevant else None,
        "severity": sev if relevant and sev in SEVERITIES else None,
        "locations": [str(l) for l in (row.get("locations") or []) if l] if relevant else [],
        "reasoning": str(row.get("reasoning") or ""),
        "source": "gemini",
    }, text, row.get("disaster_type"))


def classify_batch(texts: List[str], use_llm: bool = True) -> List[Dict]:
    """
    One dict per text, same order:
      {"relevant", "confidence", "category", "severity", "disaster_type", "locations": [str],
       "reasoning", "source"}
    "relevant" means flood-related (shared agreement). One LLM request for the whole batch; any tweet the LLM misses falls back to rules.
    """
    llm_rows: Dict[int, Dict] = {}
    if use_llm and texts and quota.can_spend():
        if format_batch_prompt:
            # Explicit 0-based ids: results are matched back by position.
            prompt = format_batch_prompt([{"id": i, "text": t} for i, t in enumerate(texts)])
            if "disaster_type" not in prompt:
                prompt += _PROMPT_ADDENDUM
        else:
            prompt = _default_batch_prompt(texts)
        # Always our schema: the hackathon service returns HTTP 500 for JSON-schema
        # features like "type": ["string", "null"] (ai_workflow's BATCH_RESPONSE_SCHEMA).
        schema = _BATCH_SCHEMA
        text = _generate(prompt, schema)
        if text:
            try:
                for row in json.loads(text):
                    if isinstance(row, dict) and isinstance(row.get("id"), int):
                        llm_rows[row["id"]] = row
            except (ValueError, TypeError) as e:
                log.warning("Could not parse LLM batch output: %s", e)
            if len(llm_rows) < len(texts):
                log.warning("LLM returned %d/%d rows; rest use rules", len(llm_rows), len(texts))
    return [_from_llm(llm_rows[i], t) if i in llm_rows else _nlp(t) for i, t in enumerate(texts)]


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

_summary_cache: Dict[str, str] = {}

_SUMMARY_INSTRUCTIONS = """You are briefing emergency coordinators and First Nations community leaders during an active disaster. Below are social-media posts already filtered as relevant (most urgent first). Write a situation overview in 3-5 sentences of plain text (no markdown, no bullet points): where the impact is concentrated, what is happening on the ground, the most urgent needs or dangers, and any notable relief or official activity. Only state what the posts support; mention specific places.

POSTS:
"""


def summarize(texts: List[str]) -> str:
    """LLM situation overview (one request, cached per exact tweet set); rule-based fallback."""
    if not texts:
        return "No relevant tweets match the current filters."
    key = hashlib.sha1("\n".join(texts).encode()).hexdigest()
    if key in _summary_cache:
        return _summary_cache[key]
    if format_summary_prompt:
        prompt = format_summary_prompt(list(texts))
    else:
        prompt = _SUMMARY_INSTRUCTIONS + "\n".join(f"- {t}" for t in texts)[:60000]
    text = _generate(prompt, timeout=60)
    if text and text.strip():
        _summary_cache[key] = text.strip()
        return _summary_cache[key]
    return _rules_summary(texts)


def _rules_summary(texts: List[str]) -> str:
    rows = [_nlp(t) for t in texts]
    cats = Counter(r["category"] for r in rows if r["relevant"])
    places = Counter(p for r in rows for p in r["locations"])
    top_cats = ", ".join(f"{c.replace('_', ' ')} ({n})" for c, n in cats.most_common(3) if c)
    top_places = "; ".join(p for p, _ in places.most_common(5)) or "no specific places"
    return (f"{len(texts)} relevant tweets. Main themes: {top_cats or 'general updates'}. "
            f"Most mentioned places: {top_places}. (Rule-based summary; AI summary unavailable.)")
