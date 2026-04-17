/**
 * ExportModal.jsx
 * Advanced export: file name, format (JPEG/PNG/WebP),
 * quality slider, bake annotations, bake text objects.
 */
import React, { useState, useCallback } from 'react';
import { renderAnnotationsOntoCtx } from './AnnotationCanvas';
import { renderTextOntoCtx }        from './TextOverlayCanvas';

const FORMATS = [
  { value: 'jpeg', label: 'JPEG', ext: 'jpg',  supportsQuality: true  },
  { value: 'png',  label: 'PNG',  ext: 'png',  supportsQuality: false },
  { value: 'webp', label: 'WebP', ext: 'webp', supportsQuality: true  },
];

export default function ExportModal({
  canvasRef,
  sourceImage,
  annotations,
  textObjects,
  onClose,
  toast,
}) {
  const defaultName = (sourceImage?.name || 'image').replace(/\.[^.]+$/, '');

  const [fileName,        setFileName]   = useState(defaultName);
  const [format,          setFormat]     = useState('jpeg');
  const [quality,         setQuality]    = useState(92);
  const [bakeAnnotations, setBakeAnno]   = useState(true);
  const [bakeText,        setBakeText]   = useState(true);
  const [exporting,       setExporting]  = useState(false);

  const selectedFmt = FORMATS.find((f) => f.value === format);

  const handleExport = useCallback(async () => {
    const src = canvasRef.current;
    if (!src || src.width === 0) { toast('No image to export', 'error'); return; }

    setExporting(true);
    try {
      // 1. Copy edited canvas to an export canvas
      const ec    = document.createElement('canvas');
      ec.width    = src.width;
      ec.height   = src.height;
      const ctx   = ec.getContext('2d');
      ctx.drawImage(src, 0, 0);

      // 2. Optionally bake drawing annotations
      if (bakeAnnotations && annotations.length > 0) {
        renderAnnotationsOntoCtx(ctx, annotations);
      }

      // 3. Optionally bake text overlays
      if (bakeText && textObjects && textObjects.length > 0) {
        renderTextOntoCtx(ctx, textObjects);
      }

      // 4. Encode
      const mime   = `image/${format}`;
      const q      = selectedFmt.supportsQuality ? quality / 100 : undefined;
      const dataUrl = ec.toDataURL(mime, q);

      // 5. Save via Electron IPC
      const safe   = (fileName.trim() || 'image').replace(/[<>:"/\\|?*]/g, '_');
      const result = await window.electronAPI.saveImage({
        dataUrl,
        defaultName: safe,
        format: selectedFmt.ext,
      });

      if (result?.success) {
        toast(`Exported: ${result.filePath}`, 'success');
        onClose();
      } else {
        toast('Export cancelled', 'info');
      }
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    } finally {
      setExporting(false);
    }
  }, [
    canvasRef, annotations, textObjects,
    bakeAnnotations, bakeText,
    fileName, format, quality, selectedFmt,
    toast, onClose,
  ]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ width: 440 }}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">💾 Export Image</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* File name */}
          <div>
            <div className="hdr-option-label" style={{ marginBottom: 6 }}>File Name</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                style={inputStyle}
                placeholder="filename"
                autoFocus
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                .{selectedFmt.ext}
              </span>
            </div>
          </div>

          {/* Format */}
          <div>
            <div className="hdr-option-label" style={{ marginBottom: 8 }}>Format</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  style={{
                    flex: 1, height: 36,
                    border: `1px solid ${format === f.value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: format === f.value ? 'var(--accent-dim)' : 'transparent',
                    color: format === f.value ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          {selectedFmt.supportsQuality && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="hdr-option-label">Quality</div>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{quality}%</span>
              </div>
              <input
                type="range" min={10} max={100} step={1}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <span>Smaller file</span><span>Best quality</span>
              </div>
            </div>
          )}

          {/* Bake options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="hdr-option-label">Bake into Export</div>

            {annotations.length > 0 && (
              <label style={checkRowStyle}>
                <input
                  type="checkbox" checked={bakeAnnotations}
                  onChange={(e) => setBakeAnno(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {annotations.length} drawing annotation{annotations.length !== 1 ? 's' : ''}
                </span>
              </label>
            )}

            {textObjects?.length > 0 && (
              <label style={checkRowStyle}>
                <input
                  type="checkbox" checked={bakeText}
                  onChange={(e) => setBakeText(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {textObjects.length} text overlay{textObjects.length !== 1 ? 's' : ''}
                </span>
              </label>
            )}

            {annotations.length === 0 && (!textObjects || textObjects.length === 0) && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No annotations or text added.</span>
            )}
          </div>

          {/* Format note */}
          <div style={infoBoxStyle}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {format === 'png'
                ? '📦 PNG is lossless — perfect quality, larger file.'
                : format === 'webp'
                ? '📦 WebP: best compression with excellent quality.'
                : `📦 JPEG at ${quality}% — good balance of size and quality.`}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="tb-btn" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            className="tb-btn primary"
            onClick={handleExport}
            disabled={exporting || !fileName.trim()}
          >
            {exporting ? '⏳ Exporting...' : '💾 Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

const closeBtnStyle = {
  background: 'none', border: 'none',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18,
};
const inputStyle = {
  flex: 1, padding: '7px 10px',
  background: 'var(--bg-app)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 13, outline: 'none',
};
const checkRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
};
const infoBoxStyle = {
  padding: '8px 12px',
  background: 'rgba(14,165,233,0.06)',
  borderRadius: 6,
  border: '1px solid rgba(14,165,233,0.15)',
};