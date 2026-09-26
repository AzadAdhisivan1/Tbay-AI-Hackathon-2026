import React, { useRef } from 'react';
import {
  Waves,
  Upload,
  Database,
  Download,
  Loader2,
} from 'lucide-react';

export default function Header({
  onLoadDataset,
  onUploadCSV,
  onExportGeoJSON,
  isLoading,
  hasData,
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCSV(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      onUploadCSV(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white leading-tight font-[Outfit]">
                The Living Flood Map
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight">
                CE Strategies Emergency Intelligence
              </p>
            </div>
          </div>

          {/* Data Input Actions */}
          <div
            className="flex items-center gap-2 flex-wrap justify-end"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* Load Provided Dataset */}
            <button
              id="btn-load-dataset"
              onClick={onLoadDataset}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Load Provided Dataset</span>
              <span className="sm:hidden">Load Data</span>
            </button>

            {/* Upload Custom CSV */}
            <button
              id="btn-upload-csv"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/40 text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Custom CSV</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Export GeoJSON */}
            <button
              id="btn-export-geojson"
              onClick={onExportGeoJSON}
              disabled={!hasData}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export to MapAki (GeoJSON)</span>
              <span className="md:hidden">Export</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
