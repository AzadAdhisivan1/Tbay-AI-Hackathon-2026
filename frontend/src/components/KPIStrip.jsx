import React from 'react';

export default function KPIStrip({ total, relevant, noise, withLocation, topLocations }) {
  const relevantPct = total > 0 ? ((relevant / total) * 100).toFixed(1) : '0.0';
  const noisePct = total > 0 ? ((noise / total) * 100).toFixed(1) : '0.0';
  const hotspotLocation = topLocations?.[0]?.name || '—';

  const metrics = [
    {
      label: 'Total Tweets',
      value: (total ?? 0).toLocaleString(),
      sub: 'Processed dataset',
      valColor: 'text-zinc-900',
    },
    {
      label: 'Relevant Signal',
      value: (relevant ?? 0).toLocaleString(),
      sub: `${relevantPct}% of total`,
      valColor: 'text-emerald-700',
    },
    {
      label: 'Noise Filtered',
      value: (noise ?? 0).toLocaleString(),
      sub: `${noisePct}% excluded`,
      valColor: 'text-amber-700',
    },
    {
      label: 'Mapped Ground Points',
      value: (withLocation ?? 0).toLocaleString(),
      sub: hotspotLocation,
      valColor: 'text-blue-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-200 h-full">
      {metrics.map((m) => (
        <div key={m.label} className="p-2 sm:px-3 sm:py-1.5 flex flex-col justify-center">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono font-medium truncate leading-tight">
            {m.label}
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-base sm:text-lg font-bold font-mono tabular-nums ${m.valColor} leading-none`}>
              {m.value}
            </span>
            {m.sub && (
              <span className="text-[10px] text-zinc-400 font-mono tabular-nums truncate">
                {m.sub}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
