import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, X, Sparkles, Loader2, ArrowRight, Lightbulb, CheckCircle2 } from 'lucide-react';

const PRESET_PROMPTS = [
  'Analyze cloud infrastructure costs and identify top 3 GPU bottleneck areas.',
  'Evaluate customer churn signals across Q3 telemetry and recommend retention steps.',
  'Benchmark API throughput latency and calculate engineering hours saved by caching.',
];

export default function InputPanel({
  prompt,
  setPrompt,
  selectedFile,
  setSelectedFile,
  onRunAnalysis,
  isAnalyzing,
  isLiveApi,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <aside className="w-full lg:w-96 flex flex-col gap-5">
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 shadow-xl backdrop-blur-xl flex flex-col gap-5">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white tracking-wide">Analysis Parameters</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-md">
            v1.0-alpha
          </span>
        </div>

        {/* Text Input Area */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="analysis-prompt-input" className="text-xs font-medium text-slate-300">
              Problem Statement or Query
            </label>
            <span className="text-[10px] text-slate-400">{prompt.length}/500</span>
          </div>
          <textarea
            id="analysis-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what workflow, data, or metrics you want the AI to analyze..."
            rows={4}
            className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
          />
        </div>

        {/* Quick Presets for Demo */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Preset Quick Prompts (Click to load):</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {PRESET_PROMPTS.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(preset)}
                className="text-left text-[11px] text-slate-400 hover:text-indigo-300 p-2 rounded-lg bg-slate-950/40 hover:bg-indigo-950/30 border border-slate-800/60 hover:border-indigo-800/50 transition-all flex items-start gap-1.5 group"
              >
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 mt-0.5 shrink-0 transition-colors" />
                <span className="line-clamp-1">{preset}</span>
              </button>
            ))}
          </div>
        </div>

        {/* File Upload Dropzone */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Supplementary Dataset or File</span>
            <span className="text-[10px] text-slate-400">Optional</span>
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".csv,.json,.pdf,.txt,.xlsx,.docx"
            id="file-upload-input"
          />

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <div className="p-2.5 rounded-full bg-slate-800/80 text-slate-400 group-hover:text-indigo-400">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Drag & drop files here, or <span className="text-indigo-400 underline">browse</span>
              </div>
              <p className="text-[10px] text-slate-400">Supports CSV, JSON, PDF, TXT (up to 25MB)</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/90 border border-indigo-500/30">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-slate-200 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Attached
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Remove attached file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Execution Mode Notice */}
        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
          isLiveApi 
            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' 
            : 'bg-indigo-950/20 border-indigo-800/40 text-indigo-300'
        }`}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] leading-tight">
            {isLiveApi ? (
              <>Running live mode &rarr; <span className="font-mono">localhost:8000</span> (auto-fallback enabled)</>
            ) : (
              <>Running demo mode with instant realistic synthetic data</>
            )}
          </span>
        </div>

        {/* Primary CTA Button */}
        <button
          type="button"
          id="run-analysis-btn"
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 p-[1px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="h-full w-full bg-transparent px-4 py-3 rounded-[11px] flex items-center justify-center gap-2 transition-all group-hover:bg-black/10">
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span className="text-sm">Synthesizing AI Engine...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
                <span className="text-sm font-semibold tracking-wide">Run AI Analysis</span>
              </>
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}
