import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet';
import { getMarkerColor, getCategoryBadge, getCategoryDisplay } from '../utils/categories';

/** Fly the map to given coords */
function FlyToHandler({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo && flyTo.lat != null && flyTo.lng != null) {
      map.flyTo([flyTo.lat, flyTo.lng], 13, { duration: 1.0 });
    }
  }, [flyTo, map]);
  return null;
}

/** Invalidate map size on container resize to prevent gray gaps */
function InvalidateSizeHandler() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const container = map.getContainer();
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map]);
  return null;
}

/** Auto-fit bounds ONLY once when dataset loads, so manual zooming/panning is preserved */
function FitBoundsToData({ geojson, stats, datasetId }) {
  const map = useMap();
  const lastFittedDatasetId = useRef(null);

  useEffect(() => {
    // Only fit bounds if we haven't already fitted for this dataset
    if (lastFittedDatasetId.current === datasetId) return;

    const isWorld = stats?.scope === 'world';

    if (!geojson?.features || geojson.features.length === 0) {
      if (isWorld) {
        lastFittedDatasetId.current = datasetId;
        map.setView([20, 0], 2);
      } else if (stats?.anchor) {
        lastFittedDatasetId.current = datasetId;
        map.setView(stats.anchor, 10);
      }
      return;
    }

    try {
      const geoLayer = L.geoJSON(geojson);
      const bounds = geoLayer.getBounds();
      if (bounds && bounds.isValid()) {
        lastFittedDatasetId.current = datasetId;
        map.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: isWorld ? 6 : 14,
        });
      }
    } catch (err) {
      console.warn('Could not fit bounds to geojson:', err);
    }
  }, [datasetId, geojson, stats?.scope, stats?.anchor, map]);

  return null;
}

/** 100% Free, No-API-Key Light GIS Tile Configurations */
const MAP_STYLES = {
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  topo: {
    id: 'topo',
    label: 'Esri Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
};

export default function FloodMap({
  geojson,
  showHeatmap,
  flyTo,
  onSelectLocation,
  stats,
  datasetId,
}) {
  const [mapStyle, setMapStyle] = useState('osm');
  const features = geojson?.features || [];

  const isWorld = stats?.scope === 'world';
  const defaultCenter = isWorld ? [20, 0] : (stats?.anchor || [51.05, -114.07]);
  const defaultZoom = isWorld ? 2 : 10;

  // Jitter/offset markers that share identical or nearby coordinates so all dots are visible
  const displayMarkers = useMemo(() => {
    const clusters = [];
    features.forEach((feature, idx) => {
      if (!feature.geometry?.coordinates) return;
      const [rawLng, rawLat] = feature.geometry.coordinates;
      if (rawLat == null || rawLng == null) return;

      let added = false;
      for (const group of clusters) {
        const [gLng, gLat] = group.centroid;
        if (Math.hypot(rawLat - gLat, rawLng - gLng) < 0.015) {
          group.items.push({ feature, idx, rawLat, rawLng });
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({
          centroid: [rawLng, rawLat],
          items: [{ feature, idx, rawLat, rawLng }],
        });
      }
    });

    const markers = [];
    clusters.forEach((group) => {
      const count = group.items.length;
      group.items.forEach(({ feature, idx, rawLat, rawLng }, i) => {
        let lat = rawLat;
        let lng = rawLng;
        if (count > 1) {
          const angle = (i * 2 * Math.PI) / count;
          lat = rawLat + Math.sin(angle) * 0.008;
          lng = rawLng + Math.cos(angle) * 0.008;
        }
        markers.push({
          id: feature.properties?.tweet_id ?? `feat-${idx}`,
          lat,
          lng,
          feature,
        });
      });
    });

    return markers;
  }, [features]);

  // Cluster locations for heatmap concentration circles
  const heatmapData = useMemo(() => {
    const places = {};
    features.forEach((f) => {
      const place = f.properties?.place || f.properties?.location_name || 'Hotspot';
      if (!f.geometry?.coordinates) return;
      const [lng, lat] = f.geometry.coordinates;
      if (lat == null || lng == null) return;
      if (!places[place]) {
        places[place] = { lat, lng, count: 0 };
      }
      places[place].count += 1;
    });
    return Object.values(places);
  }, [features]);

  const currentTileConfig = MAP_STYLES[mapStyle] || MAP_STYLES.osm;

  return (
    <div className="relative w-full h-full rounded border border-zinc-200 overflow-hidden bg-zinc-100">
      {/* Map Style Switcher (Top-Right Corner) - Utilitarian GIS tabs */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center bg-white/95 backdrop-blur-sm p-0.5 rounded border border-zinc-300 shadow-sm text-[11px] font-mono">
        {Object.values(MAP_STYLES).map((style) => (
          <button
            key={style.id}
            id={`btn-map-style-${style.id}`}
            type="button"
            onClick={() => setMapStyle(style.id)}
            className={`px-2 py-0.5 rounded transition-colors ${
              mapStyle === style.id
                ? 'bg-zinc-900 text-white font-medium'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={2}
        maxZoom={19}
        preferCanvas={true}
        className="w-full h-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          key={mapStyle}
          attribution={currentTileConfig.attribution}
          url={currentTileConfig.url}
          maxZoom={currentTileConfig.maxZoom}
        />
        <InvalidateSizeHandler />
        <FlyToHandler flyTo={flyTo} />
        <FitBoundsToData geojson={geojson} stats={stats} datasetId={datasetId} />

        {/* Heatmap / Activity Concentration Circles */}
        {showHeatmap &&
          heatmapData.map((c, i) => (
            <CircleMarker
              key={`heatmap-${i}`}
              center={[c.lat, c.lng]}
              radius={Math.min(20 + c.count * 6, 60)}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0.12 + Math.min(c.count * 0.04, 0.2),
                color: '#2563eb',
                weight: 1,
                opacity: 0.4,
              }}
            />
          ))}

        {/* Individual Feature Markers with Jittered Dots and Rich Popups */}
        {displayMarkers.map(({ id, lat, lng, feature }) => {
          const p = feature.properties || {};
          const colors = getMarkerColor(p.category);
          const categoryBadgeClass = getCategoryBadge(p.category);
          const categoryLabel = getCategoryDisplay(p.category);
          const severity = p.severity?.toLowerCase();
          const place = p.place || p.location_name || 'Ground Location';

          let sevClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
          if (severity === 'critical') sevClass = 'bg-red-950 text-red-200 border-red-800';
          else if (severity === 'high') sevClass = 'bg-red-100 text-red-800 border-red-300';
          else if (severity === 'medium') sevClass = 'bg-amber-100 text-amber-800 border-amber-300';
          else if (severity === 'low') sevClass = 'bg-zinc-100 text-zinc-600 border-zinc-200';

          return (
            <CircleMarker
              key={id}
              center={[lat, lng]}
              radius={6.5}
              pathOptions={{
                fillColor: colors.fill,
                fillOpacity: 0.9,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
              }}
            >
              <Popup maxWidth={300} minWidth={220}>
                <div className="space-y-1.5 text-zinc-900 font-sans">
                  {/* Location Header */}
                  <div className="flex items-center gap-1.5 border-b border-zinc-200 pb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: colors.fill }}
                    />
                    <span className="font-semibold text-xs text-zinc-900">
                      {place}
                    </span>
                  </div>

                  {/* Category, Severity & Confidence */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${categoryBadgeClass}`}>
                      {categoryLabel}
                    </span>
                    {severity && (
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold ${sevClass}`}>
                        {severity}
                      </span>
                    )}
                    {p.confidence != null && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {(p.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>

                  {/* Tweet Text */}
                  <p className="text-xs text-zinc-700 leading-normal pt-0.5">
                    {p.text || p.tweet_text || ''}
                  </p>

                  {/* Timestamp & Location Filter Action */}
                  <div className="pt-1 border-t border-zinc-100 flex items-center justify-between gap-1 text-[10px] font-mono">
                    <span className="text-zinc-400">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>

                    {onSelectLocation && (
                      <button
                        type="button"
                        onClick={() => onSelectLocation(place)}
                        className="text-zinc-700 hover:text-zinc-900 underline font-medium hover:bg-zinc-100 px-1 py-0.5 rounded cursor-pointer"
                        title="Filter feed to this location"
                      >
                        Filter feed to this location
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
