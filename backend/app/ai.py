"""
AI interface — THIS IS THE CONTRACT BETWEEN BACKEND AND THE AI TEAMMATE.

The backend only ever calls the two functions below. The AI teammate can replace
their bodies with real model calls (LLM, fine-tuned classifier, spaCy NER, etc.)
as long as the input/output shapes stay the same.

The current implementations are keyword heuristics so the whole app works
end-to-end before the real model is ready.
"""
import re
from collections import Counter
from typing import Dict, List

# Categories the UI will filter on. Keep this list in sync with the frontend.
CATEGORIES = [
    "infrastructure_damage",  # roads, bridges, homes, power out
    "evacuation",             # evac orders, shelters, displaced people
    "rescue_help",            # people needing help / rescue requests
    "donations_volunteering", # donate, volunteer, relief efforts
    "weather_water_levels",   # rain, river levels, warnings
    "sympathy_support",       # prayers, solidarity, stay safe
    "other_related",          # related but none of the above
]


def classify_batch(texts: List[str]) -> List[Dict]:
    """
    Classify a batch of tweets (the backend sends ~50 at a time).

    Must return one dict per input text, in the same order:
        {
            "relevant":   bool,       # related to the disaster?
            "confidence": float,      # 0.0 - 1.0
            "category":   str | None, # one of CATEGORIES if relevant, else None
            "locations":  [str],      # place names mentioned, as specific as possible,
                                      # e.g. "Bow River, Calgary, Alberta". Skip bare
                                      # provinces/countries — they geocode to a
                                      # meaningless centroid on the map.
        }
    """
    return [_heuristic_classify(t) for t in texts]


def summarize(texts: List[str]) -> str:
    """
    Summarize a set of relevant tweets (already filtered by the user) into a short
    overview paragraph for the UI. The backend caps input at ~300 tweets.
    """
    if not texts:
        return "No relevant tweets match the current filters."
    cats = Counter(_heuristic_classify(t)["category"] for t in texts)
    places = Counter(p for t in texts for p in _extract_locations(t))
    top_cats = ", ".join(f"{c.replace('_', ' ')} ({n})" for c, n in cats.most_common(3) if c)
    top_places = "; ".join(p for p, _ in places.most_common(5)) or "no specific places"
    return (
        f"[placeholder summary] {len(texts)} relevant tweets. "
        f"Most common themes: {top_cats}. Most mentioned places: {top_places}."
    )


# ---------------------------------------------------------------------------
# Placeholder heuristics below — safe for the AI teammate to delete.
# ---------------------------------------------------------------------------

_DISASTER_WORDS = re.compile(
    r"flood|water|river|evacuat|rain|storm|disaster|emergency|rescue|damage|"
    r"shelter|relief|donat|volunteer|sandbag|power outage|washed|submerged|"
    r"#yycflood|#abflood|#albertaflood|#yyc|#highriver|#uttertrouble",
    re.IGNORECASE,
)

_CATEGORY_RULES = [
    ("evacuation", r"evacuat|shelter|displaced|leave (your|their) home|reception cent"),
    ("rescue_help", r"rescue|stranded|trapped|need help|help needed|missing"),
    ("infrastructure_damage", r"road|bridge|closed|damage|destroy|power|basement|washed|collapse"),
    ("donations_volunteering", r"donat|volunteer|relief|red cross|fundrais|help out|clean ?up"),
    ("weather_water_levels", r"rain|level|crest|warning|forecast|river|water"),
    ("sympathy_support", r"pray|thoughts|stay safe|proud|solidarity|love|strong"),
]

# Hashtag / nickname -> place
_HASHTAG_PLACES = {
    "#yyc": "Calgary, Alberta",
    "#yycflood": "Calgary, Alberta",
    "#calgary": "Calgary, Alberta",
    "#highriver": "High River, Alberta",
    "#canmore": "Canmore, Alberta",
    "#yeg": "Edmonton, Alberta",
}

# Place mention -> fully qualified name (qualified names geocode far more reliably)
_KNOWN_PLACES = {
    **{n: f"{n}, Calgary, Alberta" for n in [
        "Mission", "Sunnyside", "Bowness", "Inglewood", "Roxboro", "Erlton",
        "Saddledome", "East Village", "Elbow River", "Bow River",
    ]},
    **{n: f"{n}, Alberta" for n in [
        "Calgary", "High River", "Canmore", "Okotoks", "Medicine Hat", "Lethbridge",
        "Bragg Creek", "Cochrane", "Sundre", "Drumheller", "Banff", "Exshaw",
        "Edmonton", "Red Deer",
    ]},
    "Siksika": "Siksika Nation, Alberta",
    "Kashechewan": "Kashechewan, Ontario",
    "Peguis": "Peguis First Nation, Manitoba",
    "Winnipeg": "Winnipeg, Manitoba",
    "Thunder Bay": "Thunder Bay, Ontario",
}
_PLACE_RE = re.compile(r"\b(" + "|".join(re.escape(p) for p in _KNOWN_PLACES) + r")\b", re.IGNORECASE)
_PLACE_LOOKUP = {k.lower(): v for k, v in _KNOWN_PLACES.items()}


def _extract_locations(text: str) -> List[str]:
    found = [place for tag, place in _HASHTAG_PLACES.items()
             if re.search(re.escape(tag) + r"\b", text, re.IGNORECASE)]
    found += [_PLACE_LOOKUP[m.group(1).lower()] for m in _PLACE_RE.finditer(text)]
    return list(dict.fromkeys(found))


def _heuristic_classify(text: str) -> Dict:
    text = text or ""
    hits = len(_DISASTER_WORDS.findall(text))
    relevant = hits > 0
    category = None
    if relevant:
        category = "other_related"
        for cat, pattern in _CATEGORY_RULES:
            if re.search(pattern, text, re.IGNORECASE):
                category = cat
                break
    return {
        "relevant": relevant,
        "confidence": round(min(0.5 + 0.15 * hits, 0.95), 2) if relevant else 0.6,
        "category": category,
        "locations": _extract_locations(text) if relevant else [],
    }
