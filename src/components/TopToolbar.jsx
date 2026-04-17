import React from 'react';

export default function TopToolbar({
  hasImage, canUndo, canRedo,
  onImport, onExport, onUndo, onRedo, onHDRMerge,
  compareActive, onToggleCompare,
}) {
  return (
    <div className="top-toolbar">
      {/* Import */}
      <button className="tb-btn primary" onClick={onImport}>
        <span>📂</span> Import
      </button>

      <div className="toolbar-divider" />

      {/* Export — opens the advanced modal */}
      <button className="tb-btn" disabled={!hasImage} onClick={onExport}>
        <span>💾</span> Export
      </button>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <button className="tb-btn" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
      <button className="tb-btn" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Y)">↪ Redo</button>

      <div className="toolbar-divider" />

      {/* Before/After compare */}
      <button
        className="tb-btn"
        disabled={!hasImage}
        onClick={onToggleCompare}
        style={compareActive ? { background: 'var(--accent)', color: 'white' } : {}}
        title="Before/After compare"
      >
        ◧ Compare
      </button>

      <div className="toolbar-divider" />

      {/* HDR Merge */}
      <button className="tb-btn hdr" onClick={onHDRMerge}>✦ HDR Merge</button>

      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ImageForge v2.0 · Binaire</span>
    </div>
  );
}