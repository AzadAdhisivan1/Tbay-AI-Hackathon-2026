import React, { useState, useMemo, useEffect } from 'react';
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
      map.flyTo([flyTo.lat, flyTo.lng], 11, { duration: 1.2 });
    }
  }, [flyTo, map]);
  return null;
}

/** 100% Free, No-API-Key Tile Layer Configurations */
const MAP_STYLES = {
  dark: {
    id: 'dark',
    label: 'Dark Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
    maxZoom: 19,
  },
  topo: {
    id: 'topo',
    label: 'Topo / Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and GIS User Community',
    maxZoom: 19,
  },
};

function getConfidenceBadge(confidence) {
  if (confidence >= 0.8)
    return 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30';
  if (confidence >= 0.5)
    return 'bg-amber-500/20 text-amber-300 ring-amber-500/30';
  return 'bg-blue-500/20 text-blue-300 ring-blue-500/30';
}

export default function FloodMap({
  geojson,
  showHeatmap,
  flyTo,
}) {
  const [mapStyle, setMapStyle] = useState('dark');
  const features = geojson?.features || [];

  // Compute map center of all features
  const center = useMemo(() => {
    if (features.length === 0) return [52.0, -88.0]; // Default: Northern Ontario & James Bay
    let sumLat = 0, sumLng = 0;
    features.forEach((f) => {
      sumLng += f.geometry.coordinates[0];
      sumLat += f.geometry.coordinates[1];
    });
    return [sumLat / features.length, sumLng / features.length];
  }, [features]);

  // Jitter/offset markers that share identical or nearby coordinates (e.g. Kashechewan) by ±0.008 deg
  const displayMarkers = useMemo(() => {
    // 1. Group features within ~0.012 deg of each other
    const clusters = [];
    features.forEach((feature, idx) => {
      const [rawLng, rawLat] = feature.geometry.coordinates;
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

    // 2. Spread overlapping points in a small radius of 0.008 degrees
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

  // Cluster locations for heatmap circles (using raw community centroid)
  const heatmapData = useMemo(() => {
    const places = {};
    features.forEach((f) => {
      const place = f.properties.place || f.properties.location_name || 'Northern Ontario';
      const [lng, lat] = f.geometry.coordinates;
      if (!places[place]) {
        places[place] = { lat, lng, count: 0 };
      }
      places[place].count += 1;
    });
    return Object.values(places);
  }, [features]);

  const currentTileConfig = MAP_STYLES[mapStyle] || MAP_STYLES.dark;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden ring-1 ring-slate-800/80 shadow-2xl">
      {/* Map Style Switcher (Top-Right Corner) */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-slate-700/70 shadow-2xl">
        {Object.values(MAP_STYLES).map((style) => (
          <button
            key={style.id}
            id={`btn-map-style-${style.id}`}
            type="button"
            onClick={() => setMapStyle(style.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              mapStyle === style.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={6}
        className={`w-full h-full map-style-${mapStyle}`}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          key={mapStyle}
          attribution={currentTileConfig.attribution}
          url={currentTileConfig.url}
          maxZoom={currentTileConfig.maxZoom}
        />
        <FlyToHandler flyTo={flyTo} />

        {/* Heatmap / Concentration Circles */}
        {showHeatmap &&
          heatmapData.map((c, i) => (
            <CircleMarker
              key={`heatmap-${i}`}
              center={[c.lat, c.lng]}
              radius={Math.min(22 + c.count * 8, 65)}
              pathOptions={{
                fillColor: '#6366f1',
                fillOpacity: 0.16 + Math.min(c.count * 0.05, 0.25),
                color: '#818cf8',
                weight: 1.5,
                opacity: 0.35,
              }}
            />
          ))}

        {/* Individual Feature Markers with ±0.008° Jitter */}
        {displayMarkers.map(({ id, lat, lng, feature }) => {
          const p = feature.properties || {};
          const colors = getMarkerColor(p.category);
          const categoryBadgeClass = getCategoryBadge(p.category);
          const categoryLabel = getCategoryDisplay(p.category);

          return (
            <CircleMarker
              key={id}
              center={[lat, lng]}
              radius={8}
              pathOptions={{
                fillColor: colors.fill,
                fillOpacity: 0.9,
                color: colors.stroke,
                weight: 2,
                opacity: 1,
              }}
            >
              <Popup maxWidth={320} minWidth={240}>
                <div className="space-y-2 text-slate-100">
                  {/* Location Header */}
                  <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1.5">
                    <span
                      className="inline-block w-3 h-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: colors.fill }}
                    />
                    <span className="font-bold text-sm text-white">
                      {p.place || p.location_name || 'Ground Location'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryBadgeClass}`}
                    >
                      {categoryLabel}
                    </span>
                    {p.confidence != null && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ${getConfidenceBadge(p.confidence)}`}
                      >
                        {(p.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>

                  {/* Tweet Text */}
                  <p className="text-xs text-slate-200 leading-relaxed pt-1">
                    {p.text || p.tweet_text || ''}
                  </p>

                  {/* Timestamp */}
                  {p.created_at && (
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      Reported: {new Date(p.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
