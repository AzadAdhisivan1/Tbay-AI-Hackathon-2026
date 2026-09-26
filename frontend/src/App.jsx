import React, { useState } from 'react';
import Navbar from './components/Navbar';
import InputPanel from './components/InputPanel';
import KPICards from './components/KPICards';
import ChartSection from './components/ChartSection';
import InsightsCard from './components/InsightsCard';
import { runAIAnalysis, MOCK_ANALYSIS_RESULT } from './api';
import { Sparkles, Terminal, Code2, AlertCircle } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState(
    'Analyze cloud infrastructure costs and identify top 3 GPU bottleneck areas.'
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(MOCK_ANALYSIS_RESULT);
  const [sourceInfo, setSourceInfo] = useState({
    source: 'Demo Mode (Mock Data)',
    isFallback: false,
  });
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleRunAnalysis = async () => {
    if (!prompt.trim() && !selectedFile) {
      showToast({ type: 'warning', text: 'Please enter a prompt or attach a file to analyze.' });
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await runAIAnalysis({
        prompt,
        file: selectedFile,
        isLiveApi,
      });

      if (response.success && response.data) {
        setResult(response.data);
        setSourceInfo({
          source: response.source,
          isFallback: response.isFallback,
        });

        if (response.isFallback) {
          showToast({
            type: 'warning',
            text: 'Live backend offline (localhost:8000). Loaded verified demo data so demo continues smoothly!',
          });
        } else {
          showToast({
            type: 'success',
            text: `Analysis complete via ${isLiveApi ? 'Live Backend API' : 'Demo Engine'}!`,
          });
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
      showToast({ type: 'error', text: 'Encountered unexpected error running analysis.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setPrompt('Analyze cloud infrastructure costs and identify top 3 GPU bottleneck areas.');
    setSelectedFile(null);
    setResult(MOCK_ANALYSIS_RESULT);
    setSourceInfo({
      source: isLiveApi ? 'Live API (Selected)' : 'Demo Mode (Mock Data)',
      isFallback: false,
    });
    showToast({ type: 'info', text: 'Reset dashboard to initial benchmark state.' });
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isLiveApi={isLiveApi}
        setIsLiveApi={(mode) => {
          setIsLiveApi(mode);
          showToast({
            type: 'info',
            text: mode
              ? 'Switched to Live API mode (targeting http://localhost:8000/api/analyze)'
              : 'Switched to Demo Mode (instant high-fidelity mock data)',
          });
        }}
        onReset={handleReset}
        isAnalyzing={isAnalyzing}
      />

      {/* Floating Status Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 transition-all transform animate-bounce-short">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-medium backdrop-blur-xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toastMessage.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 sm:py-8 flex flex-col gap-6">
        {/* Banner with Backend Contract for Teammates */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong className="text-slate-300">Teammate Integration Contract:</strong> Backend should listen at{' '}
              <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono">
                POST http://localhost:8000/api/analyze
              </code>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">Zero-crash presentation insurance active</span>
          </div>
        </div>

        {/* Dashboard 2-Column Layout: Left Input Panel + Right Insights Grid */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Left Panel: Inputs, presets, upload dropzone, CTA button */}
          <InputPanel
            prompt={prompt}
            setPrompt={setPrompt}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            onRunAnalysis={handleRunAnalysis}
            isAnalyzing={isAnalyzing}
            isLiveApi={isLiveApi}
          />

          {/* Right Area: KPIs, Recharts Visualization, AI Insights */}
          <section className="flex-1 w-full flex flex-col gap-6 overflow-hidden">
            {/* 3 KPI Summary Cards */}
            <KPICards kpis={result.kpis} />

            {/* AI Insights Output Card */}
            <InsightsCard
              insights={result.insights}
              source={sourceInfo.source}
              isFallback={sourceInfo.isFallback}
            />

            {/* Recharts Analytics Visualization */}
            <ChartSection data={result.chartData} />
          </section>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; 2026 ThunderBay AI Hackathon Team &bull; Frontend Workspace</p>
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Built with React 19 + Vite + Tailwind CSS + Recharts
          </p>
        </div>
      </footer>
    </div>
  );
}
