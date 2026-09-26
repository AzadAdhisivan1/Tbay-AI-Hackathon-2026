import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet';
import { MapPin, Clock, Tag, AlertTriangle } from 'lucide-react';

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

/** Get marker color based on impact category */
function getMarkerColor(category) {
  if (!category) return { fill: '#3b82f6', stroke: '#1d4ed8' }; // blue
  const cat = category.toLowerCase();
  if (cat.includes('elder') || cat.includes('home'))
    return { fill: '#ef4444', stroke: '#b91c1c' }; // red
  if (cat.includes('road') || cat.includes('bridge') || cat.includes('infrastructure'))
    return { fill: '#f97316', stroke: '#c2410c' }; // orange
  return { fill: '#3b82f6', stroke: '#1d4ed8' }; // blue
}

/** Get urgency label color */
function getUrgencyBadge(urgency) {
  if (urgency === 'high')
    return 'bg-rose-500/20 text-rose-300 ring-rose-500/30';
  if (urgency === 'medium')
    return 'bg-amber-500/20 text-amber-300 ring-amber-500/30';
  return 'bg-blue-500/20 text-blue-300 ring-blue-500/30';
}

export default function FloodMap({
  tweets,
  showHeatmap,
  flyTo,
}) {
  // Only tweets with coords
  const mappedTweets = useMemo(
    () => tweets.filter((t) => t.lat != null && t.lng != null),
    [tweets]
  );

  // Compute center of all mapped tweets
  const center = useMemo(() => {
    if (mappedTweets.length === 0) return [53.0, -85.0]; // Default: Northern Ontario
    const avgLat =
      mappedTweets.reduce((s, t) => s + t.lat, 0) / mappedTweets.length;
    const avgLng =
      mappedTweets.reduce((s, t) => s + t.lng, 0) / mappedTweets.length;
    return [avgLat, avgLng];
  }, [mappedTweets]);

  // Cluster locations for heatmap circles
  const clusterData = useMemo(() => {
    const clusters = {};
    mappedTweets.forEach((t) => {
      const key = t.location_name || `${t.lat.toFixed(2)},${t.lng.toFixed(2)}`;
      if (!clusters[key]) {
        clusters[key] = { lat: t.lat, lng: t.lng, count: 0 };
      }
      clusters[key].count += 1;
    });
    return Object.values(clusters);
  }, [mappedTweets]);

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

        {/* Individual tweet markers */}
        {mappedTweets.map((tweet) => {
          const colors = getMarkerColor(tweet.impact_category);
          return (
            <CircleMarker
              key={tweet.id}
              center={[tweet.lat, tweet.lng]}
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
                      {tweet.location_name || 'Unknown Location'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {tweet.impact_category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                        {tweet.impact_category}
                      </span>
                    )}
                    {tweet.urgency && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${getUrgencyBadge(tweet.urgency)}`}
                      >
                        {tweet.urgency.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  {tweet.timestamp && (
                    <p className="text-[10px] text-slate-400">
                      {new Date(tweet.timestamp).toLocaleString()}
                    </p>
                  )}

                  {/* Tweet text */}
                  <p className="text-xs text-slate-200 leading-relaxed border-t border-slate-700/50 pt-2">
                    {tweet.tweet_text}
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
