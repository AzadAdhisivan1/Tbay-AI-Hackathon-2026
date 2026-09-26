"""
Location Extraction & Geocoding Engine for Disaster Tweet Monitoring.
Resolves raw location strings extracted from tweets into geographic coordinates (latitude, longitude).
Includes built-in gazetteer for instant Canadian & disaster landmark resolution plus Nominatim HTTP fallback.
"""

import re
import time
import urllib.parse
import urllib.request
import json
from typing import Dict, List, Optional, Tuple

# Pre-populated high-precision Gazetteer for disaster-prone regions (Alberta, Ontario, First Nations, Canada)
KNOWN_GAZETTEER: Dict[str, Tuple[float, float, str]] = {
    # Cities & Towns
    "calgary": (51.0447, -114.0719, "Calgary, AB, Canada"),
    "yyc": (51.0447, -114.0719, "Calgary, AB, Canada"),
    "high river": (50.5806, -113.8681, "High River, AB, Canada"),
    "fort mcmurray": (56.7264, -111.3803, "Fort McMurray, AB, Canada"),
    "fort mac": (56.7264, -111.3803, "Fort McMurray, AB, Canada"),
    "canmore": (51.0890, -115.3594, "Canmore, AB, Canada"),
    "lethbridge": (49.6956, -112.8451, "Lethbridge, AB, Canada"),
    "medicine hat": (50.0417, -110.6775, "Medicine Hat, AB, Canada"),
    "edmonton": (53.5461, -113.4938, "Edmonton, AB, Canada"),
    "yeg": (53.5461, -113.4938, "Edmonton, AB, Canada"),
    "red deer": (52.2681, -113.8111, "Red Deer, AB, Canada"),
    "banff": (51.1784, -115.5708, "Banff, AB, Canada"),
    "okotoks": (50.7259, -113.9749, "Okotoks, AB, Canada"),
    "bragg creek": (50.9525, -114.5828, "Bragg Creek, AB, Canada"),
    "cochrane": (51.1890, -114.4688, "Cochrane, AB, Canada"),
    "thunder bay": (48.3809, -89.2477, "Thunder Bay, ON, Canada"),
    "pickle lake": (51.4667, -90.2000, "Pickle Lake, ON, Canada"),
    "kashechewan": (52.2858, -81.6508, "Kashechewan First Nation, ON, Canada"),
    "red earth cree": (53.4833, -103.4833, "Red Earth Cree Nation, SK, Canada"),
    "peguis": (51.3686, -97.4172, "Peguis First Nation, MB, Canada"),
    "siska": (50.1833, -121.5667, "Siska First Nation, BC, Canada"),
    
    # Specific Landmarks & Places
    "millennium park": (51.0465, -114.0885, "Millennium Park, Calgary, AB"),
    "henderson park": (49.6917, -112.8050, "Henderson Park, Lethbridge, AB"),
    "elbow river": (51.0333, -114.0500, "Elbow River, Calgary, AB"),
    "bow river": (51.0450, -114.0550, "Bow River, Calgary, AB"),
    "downton calgary": (51.0486, -114.0708, "Downtown Calgary, AB"),
    "downtown calgary": (51.0486, -114.0708, "Downtown Calgary, AB"),
    "stampede grounds": (51.0375, -114.0542, "Stampede Grounds, Calgary, AB"),
    "saddledome": (51.0374, -114.0519, "Scotiabank Saddledome, Calgary, AB"),
    "bowness": (51.0850, -114.1850, "Bowness, Calgary, AB"),
    "sunnyside": (51.0560, -114.0740, "Sunnyside, Calgary, AB"),
    "bridgeland": (51.0550, -114.0450, "Bridgeland, Calgary, AB"),
    "inglewood": (51.0400, -114.0350, "Inglewood, Calgary, AB"),
    "mission": (51.0330, -114.0710, "Mission, Calgary, AB"),
    "cliff bungalow": (51.0350, -114.0750, "Cliff Bungalow, Calgary, AB"),
    "victoria park": (51.0390, -114.0590, "Victoria Park, Calgary, AB"),
    "highway 599": (51.4667, -90.2000, "Highway 599, ON, Canada"),
    "highway 2": (51.1000, -114.0000, "Highway 2, AB, Canada"),
    "trans-canada highway": (51.0500, -114.0000, "Trans-Canada Highway, AB, Canada"),
    "alberta": (53.9333, -116.5765, "Alberta, Canada"),
    "western canada": (53.9333, -116.5765, "Western Canada"),
    "canada": (56.1304, -106.3468, "Canada"),
}

# Cache for dynamic HTTP geocoding calls
_DYNAMIC_CACHE: Dict[str, Tuple[float, float, str]] = {}

def geocode_raw_text(raw_text: str) -> Optional[Dict[str, any]]:
    """
    Geocodes a raw location string to lat/lng coordinates and formatted place name.
    """
    if not raw_text or len(raw_text.strip()) < 2:
        return None
    
    clean_text = raw_text.strip().lower()
    clean_text = re.sub(r'^[#@]', '', clean_text)
    
    # 1. Check exact gazetteer match
    if clean_text in KNOWN_GAZETTEER:
        lat, lng, display_name = KNOWN_GAZETTEER[clean_text]
        return {
            "raw_text": raw_text,
            "display_name": display_name,
            "lat": lat,
            "lng": lng,
            "source": "gazetteer"
        }
    
    # 2. Check substring gazetteer match
    for key, (lat, lng, display_name) in KNOWN_GAZETTEER.items():
        if key in clean_text or clean_text in key:
            return {
                "raw_text": raw_text,
                "display_name": display_name,
                "lat": lat,
                "lng": lng,
                "source": "gazetteer_partial"
            }
            
    # 3. Check dynamic cache
    if clean_text in _DYNAMIC_CACHE:
        lat, lng, display_name = _DYNAMIC_CACHE[clean_text]
        return {
            "raw_text": raw_text,
            "display_name": display_name,
            "lat": lat,
            "lng": lng,
            "source": "cache"
        }
        
    # 4. Fallback to OpenStreetMap Nominatim API (with timeout & retry handling)
    try:
        query = f"{raw_text}, Canada" if "canada" not in clean_text and "ab" not in clean_text else raw_text
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'DisasterResponseAnalyst/1.0 (hackathon@gestrategies.ca)'}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lng = float(data[0]['lon'])
                display_name = data[0]['display_name']
                _DYNAMIC_CACHE[clean_text] = (lat, lng, display_name)
                return {
                    "raw_text": raw_text,
                    "display_name": display_name,
                    "lat": lat,
                    "lng": lng,
                    "source": "nominatim"
                }
    except Exception:
        pass
        
    return None


def resolve_locations(locations_list: List[Dict[str, any]]) -> List[Dict[str, any]]:
    """
    Enriches extracted raw locations with geocoded lat/lng coordinates.
    """
    resolved = []
    for loc in locations_list:
        raw_text = loc.get("raw_text", "")
        conf = loc.get("location_confidence", 0.5)
        
        geo_res = geocode_raw_text(raw_text)
        item = {
            "raw_text": raw_text,
            "location_confidence": conf,
            "geocoded": geo_res is not None
        }
        if geo_res:
            item["lat"] = geo_res["lat"]
            item["lng"] = geo_res["lng"]
            item["display_name"] = geo_res["display_name"]
        else:
            item["lat"] = None
            item["lng"] = None
            item["display_name"] = None
            
        resolved.append(item)
    return resolved
