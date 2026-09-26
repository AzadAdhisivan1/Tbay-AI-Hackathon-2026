import React from 'react';
import { Clock, DollarSign, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';

export default function KPICards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      title: 'Time Saved / Week',
      value: kpis.timeSaved?.value || '42.8 hrs',
      change: kpis.timeSaved?.change || '+18.4%',
      period: 'vs manual baseline',
      icon: Clock,
      gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      progress: 78,
    },
    {
      title: 'Est. Cost Reduction',
      value: kpis.costReduction?.value || '$12,450',
      change: kpis.costReduction?.change || '+32.1%',
      period: 'projected annualized',
      icon: DollarSign,
      gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      progress: 86,
    },
    {
      title: 'Model Confidence',
      value: kpis.confidenceScore?.value || '98.4%',
      change: kpis.confidenceScore?.change || '+4.2%',
      period: 'accuracy benchmark',
      icon: ShieldCheck,
      gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      borderColor: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      progress: 98,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-b ${card.gradient} bg-slate-900/60 border ${card.borderColor} p-5 backdrop-blur-xl shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group hover:-translate-y-0.5`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{card.title}</span>
              <div className={`p-2 rounded-xl ${card.iconBg} ${card.iconColor} group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            {/* Metric Value */}
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white font-['Outfit']">
                {card.value}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <TrendingUp className="w-3 h-3" />
                {card.change}
              </span>
            </div>

            {/* Bottom info & mini progress */}
            <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{card.period}</span>
                <span className="font-mono text-slate-300">{card.progress}% index</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    idx === 0
                      ? 'bg-gradient-to-r from-indigo-500 to-blue-500'
                      : idx === 1
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-400'
                  }`}
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
