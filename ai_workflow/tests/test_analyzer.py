"""
Unit tests for Disaster Response Tweet Analyzer & Prompt Rules Compliance.
"""

import sys
import os
import json
import unittest

# Ensure ai_workflow directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analyzer import analyze_tweet
from geocoder import geocode_raw_text, resolve_locations
from prompt_template import format_tweet_prompt, SYSTEM_PROMPT


class TestDisasterTweetAnalyzer(unittest.TestCase):

    def test_irrelevant_casual_tweet(self):
        tweet = "Camping tomorrow. That would be fun."
        res = analyze_tweet(tweet)
        self.assertFalse(res["is_relevant"])
        self.assertGreaterEqual(res["relevance_confidence"], 0.7)
        self.assertIsNone(res["category"])
        self.assertIsNone(res["severity"])
        self.assertEqual(res["locations"], [])

    def test_evacuation_high_severity(self):
        tweet = "Officials in #Calgary say evacuations will not end until water recedes; up to 30,000 still without power #abflood"
        res = analyze_tweet(tweet)
        self.assertTrue(res["is_relevant"])
        self.assertIn(res["category"], ["evacuation", "infrastructure_damage", "official_update"])
        self.assertIn(res["severity"], ["high", "critical"])
        self.assertTrue(any(loc["raw_text"].lower() == "calgary" for loc in res["locations"]))

    def test_urgent_request_for_help_critical_severity(self):
        tweet = "Emergency help needed in High River! Water entering home on Elbow River, family trapped upstairs #sos #abflood"
        res = analyze_tweet(tweet)
        self.assertTrue(res["is_relevant"])
        self.assertEqual(res["category"], "request_for_help")
        self.assertEqual(res["severity"], "critical")
        self.assertGreaterEqual(len(res["locations"]), 1)
        raw_texts = [loc["raw_text"].lower() for loc in res["locations"]]
        self.assertIn("high river", raw_texts)

    def test_official_update_news(self):
        tweet = "#News Floods displace nearly 200,000 in western Canada"
        res = analyze_tweet(tweet)
        self.assertTrue(res["is_relevant"])
        self.assertEqual(res["category"], "official_update")
        self.assertIn(res["severity"], ["high", "medium"])

    def test_geocoding_calgary(self):
        geo = geocode_raw_text("Calgary")
        self.assertIsNotNone(geo)
        self.assertAlmostEqual(geo["lat"], 51.0447, places=2)
        self.assertAlmostEqual(geo["lng"], -114.0719, places=2)

    def test_geocoding_fort_mcmurray(self):
        geo = geocode_raw_text("Fort McMurray")
        self.assertIsNotNone(geo)
        self.assertAlmostEqual(geo["lat"], 56.7264, places=2)
        self.assertAlmostEqual(geo["lng"], -111.3803, places=2)

    def test_strict_json_keys(self):
        tweet = "Water rising fast in Sunnyside Calgary! Basements flooded."
        res = analyze_tweet(tweet)
        expected_keys = {"is_relevant", "relevance_confidence", "category", "severity", "locations", "reasoning"}
        self.assertEqual(set(res.keys()), expected_keys)
        self.assertIsInstance(res["is_relevant"], bool)
        self.assertIsInstance(res["relevance_confidence"], float)
        self.assertIsInstance(res["locations"], list)
        self.assertIsInstance(res["reasoning"], str)


if __name__ == "__main__":
    unittest.main()
