import React from 'react';
import { Sparkles, Server, Database, Activity, RefreshCw } from 'lucide-react';

export default function Navbar({ isLiveApi, setIsLiveApi, onReset, isAnalyzing }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 font-['Outfit']">
                ThunderBay <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI Engine</span>
              </h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Hackathon 2026
              </span>
            </div>
            <p className="text-xs text-slate-400">Intelligent SaaS Insights & Decision Platform</p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center flex-wrap gap-3 sm:gap-4">
          {/* Status Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-200">System Ready</span>
          </div>

          {/* Mode Switcher Toggle: Demo Mode vs Live API */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              id="toggle-demo-mode-btn"
              onClick={() => setIsLiveApi(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !isLiveApi
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
              <span className="text-[10px] opacity-80">(Mock)</span>
            </button>

            <button
              type="button"
              id="toggle-live-api-btn"
              onClick={() => setIsLiveApi(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isLiveApi
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Live API</span>
              <span className="text-[10px] opacity-80">(Port 8000)</span>
            </button>
          </div>

          {/* Reset action button */}
          <button
            type="button"
            id="reset-dashboard-btn"
            onClick={onReset}
            disabled={isAnalyzing}
            title="Reset to default mock state"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
