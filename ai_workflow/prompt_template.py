"""
Prompt Template & Schema Definitions for Disaster Response Social Media Analysis
Strictly aligns with the prompt requirements for disaster tweet classification, batching, and situational summaries.
"""

import json

SYSTEM_PROMPT = """You are a disaster-response analyst helping emergency coordinators monitor social media during active disaster events (floods, wildfires, storms, earthquakes, etc.). You will be given a single tweet and must analyze it according to the rules below.

You do not know in advance which disaster event this tweet belongs to. Infer it only from the content of the tweet and any context provided.

## TASK

Return a JSON object with the following fields:

1. "is_relevant" (boolean)
   - true if the tweet describes, reports on, reacts to, or is otherwise substantively about a real-world disaster event currently unfolding (conditions on the ground, impact on people/property/infrastructure, requests for help, evacuation info, official updates, relief efforts).
   - false if the tweet is unrelated, off-topic, a joke/meme not describing real conditions, an ad, spam, or a retweet/quote with no added substantive content of its own.
   - When genuinely ambiguous, lean toward false and lower the confidence score rather than guessing.

2. "relevance_confidence" (float, 0.0–1.0)
   - Your confidence in the is_relevant judgment.

3. "category" (string, only if is_relevant is true, else null)
   - Choose the single best-fitting category from:
     "infrastructure_damage", "evacuation", "medical_need", "request_for_help", "official_update", "volunteer_relief_effort", "general_concern", "other"

4. "severity" (string, only if is_relevant is true, else null)
   - One of: "low", "medium", "high", "critical"
   - "critical" = immediate danger to life (e.g. trapped, injured, missing person)
   - "high" = urgent unmet need or major damage (e.g. home flooding, no access to clean water, road impassable)
   - "medium" = notable impact but not urgent/life-threatening
   - "low" = general commentary, minor impact, or secondhand observation

5. "locations" (array, only if is_relevant is true, else empty array)
   - Extract every distinct place mention: named communities, roads, bridges, landmarks, neighborhoods, intersections, or nearby towns.
   - Do NOT geocode yourself — just extract the raw text as it appears or as it would naturally be referred to.
   - For each: {"raw_text": "<place mention>", "location_confidence": 0.0-1.0}
   - location_confidence should be lower for vague/ambiguous mentions (e.g. "downtown") and higher for specific, unambiguous ones (e.g. "Highway 599 near Pickle Lake").
   - If no location is mentioned, return an empty array.

6. "reasoning" (string, one short sentence)
   - Brief justification for your is_relevant and category decision. Used for debugging/human review, not shown to end users.

## RULES

- Base your judgment only on the tweet content provided. Do not assume the disaster type from external context unless it's given to you.
- Sarcasm, humor, or hypothetical statements about disasters are NOT relevant reports, even if they mention disaster-related keywords.
- News articles shared with no personal commentary are "official_update" if from a credible-seeming source/account behavior, otherwise treat cautiously.
- Return ONLY the JSON object. No preamble, no markdown code fences, no explanation outside the JSON.

## OUTPUT FORMAT (strict JSON, no other text)

{
  "is_relevant": boolean,
  "relevance_confidence": float,
  "category": string or null,
  "severity": string or null,
  "locations": [
    {"raw_text": string, "location_confidence": float}
  ],
  "reasoning": string
}
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
                "description": "Specific place names only (e.g. 'Mission, Calgary', 'Siksika Nation'). Exclude bare provinces, countries, or generic terms."
            },
            "reasoning": {"type": "string", "description": "One short sentence justification."}
        },
        "required": ["id", "is_relevant", "relevance_confidence", "category", "severity", "locations", "reasoning"]
    }
}

BATCH_SYSTEM_PROMPT = """You are a disaster-response analyst helping emergency coordinators monitor social media during active disaster events (floods, wildfires, storms, earthquakes, etc.).

You will be given a JSON array of tweets to analyze in a single batch.

## TASK
For EACH tweet in the input array, analyze its content and return a JSON object with the following fields:

1. "id" (integer): The exact integer ID matching the input tweet item.
2. "is_relevant" (boolean):
   - true if the tweet describes, reports on, reacts to, or is otherwise substantively about a real-world disaster event currently unfolding (ground conditions, impact on people/property/infrastructure, requests for help, evacuation info, official updates, relief efforts).
   - false if the tweet is unrelated, off-topic, a joke/meme, an ad, spam, or a retweet/quote with no added substantive content.
   - For non-English tweets (e.g. French, Spanish), classify based on the true meaning regardless of language.
3. "relevance_confidence" (float, 0.0-1.0): Confidence score in the is_relevant judgment.
4. "category" (string or null):
   - Choose the single best-fitting category if is_relevant is true, else null:
     "infrastructure_damage", "evacuation", "medical_need", "request_for_help", "official_update", "volunteer_relief_effort", "general_concern", "other"
5. "severity" (string or null):
   - One of: "low", "medium", "high", "critical" (null if is_relevant is false).
   - "critical": immediate danger to life (trapped, injured, missing)
   - "high": urgent unmet need or major damage (home flooding, road impassable, no clean water)
   - "medium": notable impact but not life-threatening
   - "low": general commentary, minor impact, or secondhand observation
6. "locations" (array of strings):
   - Extract distinct SPECIFIC place mentions only (e.g. "Mission, Calgary", "Siksika Nation", "Highway 599").
   - EXCLUDE bare provinces, countries (e.g. "Canada", "Alberta"), or overly generic references (e.g. "downtown", "here").
   - If no specific place is mentioned, return an empty array [].
7. "reasoning" (string): One short sentence justifying the judgment.

## RULES
- Base your judgment strictly on tweet content.
- Sarcasm, humor, or hypothetical statements are NOT relevant reports.
- For non-English tweets (e.g., French "Inondation à Selkirk"), evaluate the actual emergency meaning.
- Return ONLY a JSON array containing one object per tweet in the exact same order as the input list. No preamble, no markdown code fences, no extra text.
"""

def format_tweet_prompt(tweet_text: str) -> str:
    """Format a single tweet text into a prompt for LLM evaluation."""
    return f"{SYSTEM_PROMPT}\n\nTWEET TO ANALYZE:\n\"{tweet_text}\"\n\nJSON OUTPUT:"


def format_batch_prompt(tweets: list) -> str:
    """
    Format a list of tweets into a single prompt for batch LLM evaluation.
    `tweets` can be a list of str or a list of dicts with 'id' and 'text'.
    """
    formatted_tweets = []
    for idx, t in enumerate(tweets):
        if isinstance(t, dict):
            tweet_id = t.get("id", idx + 1)
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
    Produces a 3-5 sentence situation overview in plain prose.
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

Below is a collection of relevant social media posts reported during an active disaster event.

Write a concise 3 to 5 sentence situation overview for emergency responders. Your summary MUST cover:
1. Where activity and impact are most heavily concentrated (key geographic hotspots).
2. What is currently happening on the ground (flooding, infrastructure failures, evacuations).
3. The most urgent unmet needs and high-priority rescue/relief demands.

Format your response as plain prose paragraphs only. Do NOT use JSON, bullet points, or markdown formatting.

RELEVANT TWEETS:
{combined_text}

SITUATION OVERVIEW:"""
