import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet';

/** Fly the map to given coords */
function FlyToHandler({ flyTo }) {
  const map = useMap();
  React.useEffect(() => {
    if (flyTo) {
      map.flyTo([flyTo.lat, flyTo.lng], 11, { duration: 1.2 });
    }
  }, [flyTo, map]);
  return null;
}

/**
 * Get marker color based on backend category string.
 * Categories: infrastructure_damage, evacuation, rescue_help,
 *             donations_volunteering, weather_water_levels,
 *             sympathy_support, other_related
 * Fallback categories (from demo): Elder / Home Water, Submerged Road / Bridge, Rising Water / Evacuation
 */
function getMarkerColor(category) {
  if (!category) return { fill: '#3b82f6', stroke: '#1d4ed8' }; // blue
  const cat = category.toLowerCase();
  if (cat.includes('rescue') || cat.includes('elder') || cat.includes('home'))
    return { fill: '#ef4444', stroke: '#b91c1c' }; // red
  if (cat.includes('infrastructure') || cat.includes('road') || cat.includes('bridge'))
    return { fill: '#f97316', stroke: '#c2410c' }; // orange
  if (cat.includes('evacuation'))
    return { fill: '#f59e0b', stroke: '#b45309' }; // amber
  if (cat.includes('weather') || cat.includes('water') || cat.includes('rising'))
    return { fill: '#3b82f6', stroke: '#1d4ed8' }; // blue
  if (cat.includes('donation') || cat.includes('volunteer'))
    return { fill: '#10b981', stroke: '#047857' }; // emerald
  return { fill: '#8b5cf6', stroke: '#6d28d9' }; // violet for sympathy/other
}

function getUrgencyBadge(confidence) {
  if (confidence >= 0.8)
    return 'bg-rose-500/20 text-rose-300 ring-rose-500/30';
  if (confidence >= 0.5)
    return 'bg-amber-500/20 text-amber-300 ring-amber-500/30';
  return 'bg-blue-500/20 text-blue-300 ring-blue-500/30';
}

export default function FloodMap({
  geojson,
  showHeatmap,
  flyTo,
}) {
  const features = geojson?.features || [];

  // Compute center of all features
  const center = useMemo(() => {
    if (features.length === 0) return [53.0, -85.0]; // Default: Northern Ontario
    let sumLat = 0, sumLng = 0;
    features.forEach((f) => {
      sumLng += f.geometry.coordinates[0];
      sumLat += f.geometry.coordinates[1];
    });
    return [sumLat / features.length, sumLng / features.length];
  }, [features]);

  // Cluster locations for heatmap circles
  const clusterData = useMemo(() => {
    const clusters = {};
    features.forEach((f) => {
      const place = f.properties.place || f.properties.location_name || 'unknown';
      const [lng, lat] = f.geometry.coordinates;
      if (!clusters[place]) {
        clusters[place] = { lat, lng, count: 0 };
      }
      clusters[place].count += 1;
    });
    return Object.values(clusters);
  }, [features]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden ring-1 ring-slate-800/60">
      <MapContainer
        center={center}
        zoom={5}
        className="w-full h-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FlyToHandler flyTo={flyTo} />

        {/* Heatmap / Concentration circles */}
        {showHeatmap &&
          clusterData.map((c, i) => (
            <CircleMarker
              key={`heatmap-${i}`}
              center={[c.lat, c.lng]}
              radius={Math.min(18 + c.count * 8, 55)}
              pathOptions={{
                fillColor: '#6366f1',
                fillOpacity: 0.12 + Math.min(c.count * 0.04, 0.2),
                color: '#818cf8',
                weight: 1,
                opacity: 0.25,
              }}
            />
          ))}

        {/* Individual feature markers */}
        {features.map((feature, idx) => {
          const [lng, lat] = feature.geometry.coordinates;
          const p = feature.properties;
          const colors = getMarkerColor(p.category);
          return (
            <CircleMarker
              key={p.tweet_id ?? idx}
              center={[lat, lng]}
              radius={7}
              pathOptions={{
                fillColor: colors.fill,
                fillOpacity: 0.85,
                color: colors.stroke,
                weight: 2,
                opacity: 1,
              }}
            >
              <Popup maxWidth={320} minWidth={240}>
                <div className="space-y-2">
                  {/* Location name */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: colors.fill }}
                    />
                    <span className="font-semibold text-sm text-white">
                      {p.place || p.location_name || 'Unknown Location'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {p.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                        {p.category.replace(/_/g, ' ')}
                      </span>
                    )}
                    {p.confidence != null && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${getUrgencyBadge(p.confidence)}`}
                      >
                        {(p.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  {p.created_at && (
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.created_at).toLocaleString()}
                    </p>
                  )}

                  {/* Tweet text */}
                  <p className="text-xs text-slate-200 leading-relaxed border-t border-slate-700/50 pt-2">
                    {p.text || p.tweet_text || ''}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
