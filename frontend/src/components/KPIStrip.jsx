import React from 'react';
import {
  BarChart3,
  Signal,
  ShieldOff,
  MapPin,
} from 'lucide-react';

export default function KPIStrip({ total, relevant, noise, withLocation, topLocations }) {
  const relevantPct = total > 0 ? ((relevant / total) * 100).toFixed(1) : '0.0';
  const noisePct = total > 0 ? ((noise / total) * 100).toFixed(1) : '0.0';
  const hotspotLocation = topLocations?.[0]?.name || '—';

  const cards = [
    {
      icon: BarChart3,
      label: 'Total Tweets Processed',
      value: total,
      sub: null,
      color: 'text-slate-300',
      bg: 'bg-slate-800/60',
      ring: 'ring-slate-700/50',
      iconBg: 'bg-slate-700/50',
      iconColor: 'text-slate-300',
    },
    {
      icon: Signal,
      label: 'Relevant Flood Signal',
      value: relevant,
      sub: `${relevantPct}% of total`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/30',
      ring: 'ring-emerald-800/40',
      iconBg: 'bg-emerald-900/40',
      iconColor: 'text-emerald-400',
    },
    {
      icon: ShieldOff,
      label: 'Noise Filtered Out',
      value: noise,
      sub: `${noisePct}% removed`,
      color: 'text-amber-400',
      bg: 'bg-amber-950/20',
      ring: 'ring-amber-800/30',
      iconBg: 'bg-amber-900/30',
      iconColor: 'text-amber-400',
    },
    {
      icon: MapPin,
      label: 'Plotted Ground Locations',
      value: withLocation,
      sub: hotspotLocation,
      color: 'text-blue-400',
      bg: 'bg-blue-950/20',
      ring: 'ring-blue-800/30',
      iconBg: 'bg-blue-900/30',
      iconColor: 'text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} rounded-xl p-4 ring-1 ${card.ring} transition-all hover:scale-[1.02]`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
            <span className="text-[11px] text-slate-400 font-medium leading-tight">
              {card.label}
            </span>
          </div>
          <div className={`text-2xl font-bold ${card.color} font-[Outfit]`}>
            {(card.value ?? 0).toLocaleString()}
          </div>
          {card.sub && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
