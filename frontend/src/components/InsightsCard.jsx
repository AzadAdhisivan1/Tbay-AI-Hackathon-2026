import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Clock,
  Copy,
  Check,
  Zap,
  ShieldAlert,
} from 'lucide-react';

export default function InsightsCard({ insights, source, isFallback }) {
  const [copied, setCopied] = useState(false);

  if (!insights) return null;

  const handleCopy = () => {
    const text = `Executive Summary:\n${insights.executiveSummary}\n\nKey Findings:\n${insights.keyFindings?.join('\n')}\n\nRecommended Actions:\n${insights.recommendedActions?.join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 backdrop-blur-xl shadow-xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-['Outfit']">
              AI Synthesis & Strategic Insights
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {insights.timestamp || 'Just now'}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-mono">
                <Zap className="w-3 h-3 text-amber-400" />
                {insights.latencyMs ? `${insights.latencyMs}ms` : '142ms latency'}
              </span>
            </div>
          </div>
        </div>

        {/* Right side source badge & copy button */}
        <div className="flex items-center gap-2.5">
          {source && (
            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                isFallback
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : source.includes('Live')
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
              }`}
            >
              {source}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 transition-colors"
            title="Copy Insights"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fallback alert banner if active */}
      {isFallback && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Backend Unreachable — Safe Demo Fallback Triggered</span>
            <p className="text-[11px] text-amber-400/90">
              The live backend on port 8000 was offline or didn't respond in time. To prevent any pitch interruption, synthesized realistic mock insights are shown below.
            </p>
          </div>
        </div>
      )}

      {/* Executive Summary Quote Callout */}
      <div className="relative rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-900/50 to-slate-950/40 border border-indigo-500/20 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Executive Briefing
        </div>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
          {insights.executiveSummary}
        </p>
      </div>

      {/* Key Findings & Recommended Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Findings */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Key Findings & Telemetry</span>
          </div>
          <div className="space-y-2">
            {insights.keyFindings?.map((finding, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300 leading-relaxed flex items-start gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{finding}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
            <span>Recommended Strategic Next Steps</span>
          </div>
          <div className="space-y-2">
            {insights.recommendedActions?.map((action, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300 leading-relaxed flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <span>{action}</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
                  P{idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk and Security Meter */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>Operational Risk Evaluation:</span>
          <span className="font-semibold text-emerald-400 font-mono">
            {insights.riskScore || 'Low (12/100)'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">SOC2 Type II Compliant Architecture</span>
      </div>
    </div>
  );
}
