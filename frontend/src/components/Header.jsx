import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';

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
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand - Utilitarian GIS header */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" title="System Active" />
            <div>
              <h1 className="text-sm font-bold text-zinc-900 leading-none tracking-tight">
                The Living Flood Map
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 leading-none">
                CE Strategies Emergency Operations
              </p>
            </div>
          </div>

          {/* Data Actions - Clean, icon-free minimalist buttons */}
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
              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{isLoading ? 'Loading...' : 'Load Dataset'}</span>
            </button>

            {/* Upload Custom CSV */}
            <button
              id="btn-upload-csv"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload CSV
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
              className="px-3 py-1.5 rounded bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export GeoJSON (MapAki)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
