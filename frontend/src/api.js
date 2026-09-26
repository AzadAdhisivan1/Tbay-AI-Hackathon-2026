/**
 * API Service for The Living Flood Map
 *
 * Handles:
 * 1. Loading the default/provided dataset from backend or fallback
 * 2. Uploading custom CSV files to the backend for processing
 * 3. Graceful fallback to built-in demo data when backend is unreachable
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Load the default/provided disaster dataset from the backend.
 * Falls back to built-in data if backend is unreachable.
 */
export async function loadProvidedDataset() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/api/process-csv`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
      source: 'backend',
    };
  } catch (error) {
    console.warn('[Living Flood Map] Backend unreachable, using fallback data:', error.message);
    return {
      success: false,
      data: null,
      source: 'fallback',
      error: error.message,
    };
  }
}

/**
 * Upload a custom CSV file to the backend for AI processing.
 * @param {File} file - The CSV file to upload
 */
export async function uploadCustomCSV(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${API_BASE_URL}/api/process-csv`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
      source: 'upload',
    };
  } catch (error) {
    console.warn('[Living Flood Map] CSV upload failed:', error.message);
    return {
      success: false,
      data: null,
      source: 'upload',
      error: error.message,
    };
  }
}

/**
 * Export filtered tweets as GeoJSON FeatureCollection
 * @param {Array} tweets - Array of tweet objects with lat/lng
 * @returns {string} - GeoJSON string
 */
export function tweetsToGeoJSON(tweets) {
  const features = tweets
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [t.lng, t.lat],
      },
      properties: {
        id: t.id,
        tweet_text: t.tweet_text,
        location_name: t.location_name || 'Unknown',
        impact_category: t.impact_category || 'Unknown',
        urgency: t.urgency || 'unknown',
        is_relevant: t.is_relevant,
        timestamp: t.timestamp || null,
      },
    }));

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    2
  );
}
