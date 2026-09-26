"""
Batch CSV Processing Engine for Disaster Tweet Dataset.
Processes large CSV datasets (such as main_contestant.csv), analyzes every tweet,
extracts location coordinates, and compiles summary statistics for emergency response.
"""

import os
import sys
import json
import time
import pandas as pd
from typing import Dict, Any, List, Optional
from analyzer import analyze_tweet

def process_csv_dataset(csv_path: str, output_dir: str = "data", geocode: bool = True, max_rows: Optional[int] = None) -> Dict[str, Any]:
    """
    Reads a CSV file of tweets, runs analyzer on each row, and saves structured JSON results and metrics.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Input CSV file not found: {csv_path}")

    print(f"Loading CSV dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    
    # Identify tweet column name
    tweet_col = None
    for col in df.columns:
        if col.lower() in ['tweet', 'tweets', 'text', 'content', 'message']:
            tweet_col = col
            break
    if not tweet_col:
        tweet_col = df.columns[0] # Default to first column
        
    print(f"Using column '{tweet_col}' for tweet text evaluation.")
    
    tweets_list = df[tweet_col].astype(str).tolist()
    total_tweets = len(tweets_list)
    from concurrent.futures import ThreadPoolExecutor
    
    print(f"Processing {total_tweets} tweets in parallel...")
    start_time = time.time()
    
    def process_item(item):
        idx, text = item
        analysis = analyze_tweet(text, geocode=geocode)
        return (idx, text, analysis)

    items = list(enumerate(tweets_list))
    results_list = []
    
    with ThreadPoolExecutor(max_workers=16) as executor:
        for idx, (i, text, analysis) in enumerate(executor.map(process_item, items)):
            if (idx + 1) % 1000 == 0 or idx == total_tweets - 1:
                elapsed = time.time() - start_time
                rate = (idx + 1) / elapsed if elapsed > 0 else 0
                print(f"Processed [{idx + 1}/{total_tweets}] tweets... ({rate:.1f} tweets/sec)")
            results_list.append((i, text, analysis))
            
    # Sort back by original index
    results_list.sort(key=lambda x: x[0])
    
    processed_records = []
    relevant_count = 0
    irrelevant_count = 0
    category_counts = {}
    severity_counts = {}
    location_clusters = {}
    critical_alerts = []
    
    for i, text, analysis in results_list:
        record = {
            "id": i + 1,
            "tweet": text,
            "is_relevant": analysis["is_relevant"],
            "relevance_confidence": analysis["relevance_confidence"],
            "category": analysis["category"],
            "severity": analysis["severity"],
            "locations": analysis["locations"],
            "reasoning": analysis["reasoning"]
        }
        processed_records.append(record)
        
        if analysis["is_relevant"]:
            relevant_count += 1
            cat = analysis["category"] or "other"
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
            sev = analysis["severity"] or "low"
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            
            # Aggregate locations for mapping cluster view
            for loc in analysis["locations"]:
                raw_loc = loc["raw_text"]
                if loc.get("geocoded") and loc.get("lat") and loc.get("lng"):
                    loc_key = loc.get("display_name") or raw_loc
                    if loc_key not in location_clusters:
                        location_clusters[loc_key] = {
                            "name": loc_key,
                            "raw_text": raw_loc,
                            "lat": loc["lat"],
                            "lng": loc["lng"],
                            "count": 0,
                            "severities": []
                        }
                    location_clusters[loc_key]["count"] += 1
                    location_clusters[loc_key]["severities"].append(sev)
                    
            if sev in ["critical", "high"] and len(critical_alerts) < 50:
                critical_alerts.append(record)
        else:
            irrelevant_count += 1

    elapsed_time = round(time.time() - start_time, 2)
    relevance_pct = round((relevant_count / total_tweets) * 100, 2) if total_tweets > 0 else 0.0
    
    # Format top location clusters
    top_locations = list(location_clusters.values())
    top_locations.sort(key=lambda x: x["count"], reverse=True)
    
    summary_metrics = {
        "dataset_filename": os.path.basename(csv_path),
        "total_tweets": total_tweets,
        "relevant_count": relevant_count,
        "irrelevant_count": irrelevant_count,
        "relevance_percentage": relevance_pct,
        "processing_time_seconds": elapsed_time,
        "category_counts": category_counts,
        "severity_counts": severity_counts,
        "top_locations": top_locations,
        "critical_alerts_count": len(critical_alerts)
    }
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    json_path = os.path.join(output_dir, "processed_tweets.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(processed_records, f, indent=2, ensure_ascii=False)
        
    metrics_path = os.path.join(output_dir, "summary_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(summary_metrics, f, indent=2, ensure_ascii=False)
        
    # Also save CSV version for convenient export
    csv_output_path = os.path.join(output_dir, "processed_tweets.csv")
    export_df = pd.DataFrame(processed_records)
    export_df.to_csv(csv_output_path, index=False)
    
    print(f"\nProcessing Complete!")
    print(f"Total: {total_tweets} | Relevant: {relevant_count} ({relevance_pct}%) | Irrelevant: {irrelevant_count}")
    print(f"Results saved to: {json_path}")
    print(f"Metrics saved to: {metrics_path}")
    
    return {
        "processed_records": processed_records,
        "summary_metrics": summary_metrics,
        "paths": {
            "json": json_path,
            "metrics": metrics_path,
            "csv": csv_output_path
        }
    }


if __name__ == "__main__":
    csv_input = sys.argv[1] if len(sys.argv) > 1 else "../CE Strategies/main_contestant.csv"
    process_csv_dataset(csv_input)
