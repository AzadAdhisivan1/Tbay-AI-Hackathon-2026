import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';

export default function Header({
  datasetId,
  datasets = [],
  onSelectDataset,
  onUploadCSV,
  onExportGeoJSON,
  onExportCSV,
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

  // Build clean list of datasets including built-ins
  const datasetOptions = [
    { id: 'sample', label: 'Alberta Floods 2013' },
    { id: 'bonus', label: 'World Disasters (Bonus)' },
  ];

  // Merge any dynamically registered / uploaded datasets from backend
  datasets.forEach((d) => {
    if (!datasetOptions.some((opt) => opt.id === d.id)) {
      datasetOptions.push({
        id: d.id,
        label: d.name || `Dataset: ${d.id}`,
        count: d.total,
      });
    }
  });

  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-50 shrink-0">
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
            {/* Dataset Switcher Dropdown */}
            <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1.5">
              <span className="text-[10px] uppercase font-mono font-semibold text-zinc-500">Dataset:</span>
              <select
                id="select-dataset"
                value={datasetId || 'sample'}
                onChange={(e) => onSelectDataset(e.target.value)}
                disabled={isLoading}
                className="bg-transparent text-xs font-semibold text-zinc-900 focus:outline-none cursor-pointer"
              >
                {datasetOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} {opt.count ? `(${opt.count.toLocaleString()})` : ''}
                  </option>
                ))}
              </select>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-500 ml-1" />}
            </div>

            {/* Upload Custom CSV */}
            <button
              id="btn-upload-csv"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

            {/* Export CSV */}
            <button
              id="btn-export-csv"
              type="button"
              onClick={onExportCSV}
              disabled={!hasData}
              className="px-3 py-1.5 rounded bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Download currently filtered tweets as CSV"
            >
              Export CSV
            </button>

            {/* Export GeoJSON */}
            <button
              id="btn-export-geojson"
              type="button"
              onClick={onExportGeoJSON}
              disabled={!hasData}
              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Download filtered ground points as GeoJSON for MapAki"
            >
              Export GeoJSON (MapAki)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
