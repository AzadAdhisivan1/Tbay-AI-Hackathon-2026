"""
Prompt Template & Schema Definitions for Disaster Response Social Media Analysis.
Includes flood relevance rules, multi-disaster classification, worldwide location formatting, and regional summaries.
"""

import json

SYSTEM_PROMPT = """You are a disaster-response analyst helping emergency coordinators monitor social media during active disaster events.

You will be given a single tweet and must analyze it according to the rules below.

## RELEVANCE RULE (FLOOD-FOCUSED)
- "is_relevant" is TRUE ONLY if the tweet is directly FLOOD-RELATED (flooding, rising/high water, storm surge, flash floods, flood evacuations, flood relief).
- "is_relevant" is FALSE for explosions, shootings, fires, earthquakes, haze, and storms/hurricanes UNLESS the tweet explicitly mentions flooding or water inundation.

## TASK

Return a JSON object with the following fields:

1. "is_relevant" (boolean): true ONLY if flood-related, else false.
2. "relevance_confidence" (float, 0.0–1.0): Your confidence in the judgment.
3. "disaster_type" (string): One of: "flood", "storm", "wildfire", "earthquake", "explosion", "shooting", "transport_accident", "haze", "other", "none" ("none" if not a disaster).
4. "category" (string or null): If is_relevant is true, one of:
   "infrastructure_damage", "evacuation", "medical_need", "request_for_help", "official_update", "volunteer_relief_effort", "general_concern", "other" (else null).
5. "severity" (string or null): One of: "low", "medium", "high", "critical" (else null).
6. "locations" (array of strings): Specific place mentions including city/province/country when clear (e.g. "Mission, Calgary, Alberta", "Tacloban, Philippines"). Exclude bare provinces/countries or vague terms ("downtown").
7. "reasoning" (string): One short sentence justification.
"""

BATCH_RESPONSE_SCHEMA = {
    "type": "array",
    "description": "Array of disaster analysis objects for each input tweet in exact input order.",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "integer"},
            "is_relevant": {"type": "boolean"},
            "relevance_confidence": {"type": "number"},
            "disaster_type": {
                "type": "string",
                "enum": ["flood", "storm", "wildfire", "earthquake", "explosion", "shooting", "transport_accident", "haze", "other", "none"]
            },
            "category": {
                "type": ["string", "null"],
                "enum": [
                    "infrastructure_damage",
                    "evacuation",
                    "medical_need",
                    "request_for_help",
                    "official_update",
                    "volunteer_relief_effort",
                    "general_concern",
                    "other",
                    None
                ]
            },
            "severity": {
                "type": ["string", "null"],
                "enum": ["low", "medium", "high", "critical", None]
            },
            "locations": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific place names with city/province/country when clear (e.g. 'Tacloban, Philippines', 'Brisbane, Queensland, Australia', 'Mission, Calgary, Alberta'). Exclude bare provinces or countries."
            },
            "reasoning": {"type": "string", "description": "One short sentence justification."}
        },
        "required": ["id", "is_relevant", "relevance_confidence", "disaster_type", "category", "severity", "locations", "reasoning"]
    }
}

BATCH_SYSTEM_PROMPT = """You are a disaster-response analyst helping emergency coordinators monitor social media during active disaster events worldwide.

You will be given a JSON array of tweets to analyze in a single batch.

## RELEVANCE RULE (FLOOD-FOCUSED)
- "is_relevant" is TRUE ONLY if the tweet describes, reports on, or reacts to FLOOD-RELATED events (flooding, rising/high water, storm surge, flash floods, flood evacuations, flood relief).
- "is_relevant" is FALSE for explosions, shootings, fires, earthquakes, haze, and storms/hurricanes UNLESS the tweet explicitly describes flooding or water inundation.
- For non-English tweets (e.g. French, Spanish, German, Indonesian), classify based on the true emergency meaning regardless of language.

## EXAMPLES
- "Hurricane Sandy makes landfall" -> is_relevant: false, disaster_type: "storm"
- "Sandy storm surge floods lower Manhattan" -> is_relevant: true, disaster_type: "flood"
- "Explosion at Texas fertilizer plant" -> is_relevant: false, disaster_type: "explosion"
- "lol this rain" -> is_relevant: false, disaster_type: "none"

## TASK
For EACH tweet in the input array, return a JSON object with:

1. "id" (integer): Pass through the EXACT input tweet "id" unchanged.
2. "is_relevant" (boolean): true ONLY if flood-related, else false.
3. "relevance_confidence" (float, 0.0-1.0): Confidence in your judgment.
4. "disaster_type" (string): One of:
   "flood", "storm", "wildfire", "earthquake", "explosion", "shooting", "transport_accident", "haze", "other", "none"
5. "category" (string or null): If is_relevant is true, choose best fit:
   "infrastructure_damage", "evacuation", "medical_need", "request_for_help", "official_update", "volunteer_relief_effort", "general_concern", "other" (else null).
6. "severity" (string or null): One of "low", "medium", "high", "critical" if is_relevant is true, else null.
   - "critical": immediate threat to life (trapped, drowning, missing)
   - "high": major damage or urgent unmet need (homes flooded, road impassable, no clean water)
   - "medium": notable impact but not life-threatening
   - "low": general commentary, minor impact, or secondhand observation
7. "locations" (array of strings):
   - Extract distinct SPECIFIC place mentions. Include country/state/province for places outside Canada (e.g. "Tacloban, Philippines", "Brisbane, Queensland, Australia", "Manhattan, New York", "Mission, Calgary, Alberta").
   - EXCLUDE bare country/province names (e.g. "Canada", "Australia") or vague terms ("downtown", "here").
   - If no specific place is mentioned, return an empty array [].
8. "reasoning" (string): One short sentence justification.

## RULES
- Return ONLY a JSON array containing one object per tweet in the exact same order as the input list. No preamble, no markdown code fences, no extra text.
"""

def format_tweet_prompt(tweet_text: str) -> str:
    """Format a single tweet text into a prompt for LLM evaluation."""
    return f"{SYSTEM_PROMPT}\n\nTWEET TO ANALYZE:\n\"{tweet_text}\"\n\nJSON OUTPUT:"


def format_batch_prompt(tweets: list) -> str:
    """
    Format a list of tweets into a single prompt for batch LLM evaluation.
    `tweets` can be a list of str or a list of dicts with 'id' and 'text'.
    Preserves input integer IDs if provided in dicts.
    """
    formatted_tweets = []
    for idx, t in enumerate(tweets):
        if isinstance(t, dict):
            tweet_id = t.get("id") if t.get("id") is not None else idx
            text = t.get("text") or t.get("tweet") or str(t)
        else:
            tweet_id = idx + 1
            text = str(t)
        formatted_tweets.append({"id": tweet_id, "text": text})

    tweets_json = json.dumps(formatted_tweets, indent=2, ensure_ascii=False)
    return f"{BATCH_SYSTEM_PROMPT}\n\nTWEETS BATCH TO ANALYZE:\n{tweets_json}\n\nSTRICT JSON ARRAY OUTPUT:"


def format_summary_prompt(tweets: list) -> str:
    """
    Format a list of up to ~300 tweet texts into a summary prompt for emergency responders.
    When posts span several countries/regions, summarizes BY country/region.
    Produces a 3-6 sentence situation overview in plain prose.
    """
    tweet_texts = []
    for t in tweets[:300]:
        if isinstance(t, dict):
            text = t.get("text") or t.get("tweet") or str(t)
        else:
            text = str(t)
        tweet_texts.append(f"- {text}")

    combined_text = "\n".join(tweet_texts)

    return f"""You are a disaster-response intelligence analyst briefing emergency coordinators.

Below is a collection of relevant social media posts reported during active disaster events.

Write a concise 3 to 6 sentence situation overview for emergency responders.
- If the tweets cover multiple countries or regions, organize the overview BY country/region (e.g., "Philippines: ... Australia: ... Canada: ...").
- Highlight key geographic hotspots, ground flood impact, and the most urgent unmet needs.

Format your response as plain prose paragraphs only. Do NOT use JSON, bullet points, or code formatting.

RELEVANT TWEETS:
{combined_text}

SITUATION OVERVIEW:"""
