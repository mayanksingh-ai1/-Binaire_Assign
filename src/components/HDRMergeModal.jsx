import React, { useState, useCallback } from 'react';
import { mergeHDR } from '../utils/opencvHDR';

const HDR_ALGORITHMS = [
  { value: 'debevec', label: 'Debevec' },
  { value: 'robertson', label: 'Robertson' },
];

const TONEMAP_ALGORITHMS = [
  { value: 'drago', label: 'Drago' },
  { value: 'reinhard', label: 'Reinhard' },
  { value: 'mantiuk', label: 'Mantiuk' },
];

export default function HDRMergeModal({ onClose, onResult, toast }) {
  const [images, setImages] = useState([]);
  const [hdrAlgo, setHdrAlgo] = useState('debevec');
  const [tonemapAlgo, setTonemapAlgo] = useState('drago');
  const [gamma, setGamma] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  const handleAddImages = useCallback(async () => {
    const files = await window.electronAPI.openImage(true);
    if (!files || files.length === 0) return;
    const newImgs = files.map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      dataUrl: f.dataUrl,
      exposure: 1 / Math.pow(2, i), // default exposure times
    }));
    setImages((prev) => [...prev, ...newImgs].slice(0, 9)); // max 9
  }, []);

  const handleRemove = useCallback((id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleExposureChange = useCallback((id, val) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, exposure: parseFloat(val) || 0 } : img));
  }, []);

  const handleMerge = useCallback(async () => {
    if (images.length < 2) {
      toast('Add at least 2 images for HDR merge', 'error');
      return;
    }
    const badExp = images.some((img) => !(parseFloat(img.exposure) > 0));
    if (badExp) {
      toast('All exposure times must be positive numbers > 0', 'error');
      return;
    }
    setProcessing(true);
    setProgress('Starting HDR merge...');
    try {
      const resultDataUrl = await mergeHDR(images, hdrAlgo, tonemapAlgo, gamma, saturation, setProgress);
      onResult(resultDataUrl);
      onClose();
    } catch (err) {
      toast(`HDR merge failed: ${err.message}`, 'error');
      setProgress(`\u274C ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, [images, hdrAlgo, tonemapAlgo, gamma, saturation, onResult, onClose, toast]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">✦ HDR Merge</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Image list */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Source Images ({images.length}/9)
              </span>
              <button className="action-btn" onClick={handleAddImages} disabled={images.length >= 9}>
                + Add Images
              </button>
            </div>

            {images.length === 0 ? (
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
                onClick={handleAddImages}
              >
                Click to add images (minimum 2, maximum 9)
              </div>
            ) : (
              <div className="hdr-image-list">
                {images.map((img) => (
                  <div key={img.id} className="hdr-image-item">
                    <img src={img.dataUrl} className="hdr-thumb" alt={img.name} />
                    <span className="hdr-filename">{img.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Exp (s):</span>
                      <input
                        type="number"
                        className="hdr-exposure-input"
                        value={img.exposure}
                        step="0.001"
                        min="0.00001"
                        max="30"
                        onChange={(e) => handleExposureChange(img.id, e.target.value)}
                      />
                    </div>
                    <button className="hdr-remove-btn" onClick={() => handleRemove(img.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HDR Options */}
          <div className="hdr-options">
            <div className="hdr-option-group">
              <div className="hdr-option-label">HDR Algorithm</div>
              <select value={hdrAlgo} onChange={(e) => setHdrAlgo(e.target.value)}>
                {HDR_ALGORITHMS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="hdr-option-group">
              <div className="hdr-option-label">Tonemap</div>
              <select value={tonemapAlgo} onChange={(e) => setTonemapAlgo(e.target.value)}>
                {TONEMAP_ALGORITHMS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sliders */}
          <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="hdr-option-label" style={{ marginBottom: 6 }}>Gamma: {gamma.toFixed(1)}</div>
              <input
                type="range" min="0.5" max="3.0" step="0.1"
                value={gamma} onChange={(e) => setGamma(parseFloat(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="hdr-option-label" style={{ marginBottom: 6 }}>Saturation: {saturation.toFixed(1)}</div>
              <input
                type="range" min="0" max="3.0" step="0.1"
                value={saturation} onChange={(e) => setSaturation(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              background: progress.startsWith('❌') ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
              border: progress.startsWith('❌') ? '1px solid rgba(239,68,68,0.3)' : 'none',
              borderRadius: 6,
              fontSize: 12,
              color: progress.startsWith('❌') ? 'var(--red)' : 'var(--accent)',
              wordBreak: 'break-word',
            }}>
              {progress.startsWith('❌') ? progress : `⚙ ${progress}`}
            </div>
          )}

          {/* Info box */}
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(14,165,233,0.06)', borderRadius: 6, border: '1px solid rgba(14,165,233,0.2)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent)' }}>Tip:</strong> Use images of the same scene taken at different exposures.
            Set accurate exposure times (in seconds) per image for best results. All images must be the same resolution.
          </div>
        </div>

        <div className="modal-footer">
          <button className="tb-btn" onClick={onClose} disabled={processing}>Cancel</button>
          <button
            className="tb-btn hdr"
            onClick={handleMerge}
            disabled={processing || images.length < 2}
          >
            {processing ? '⚙ Processing...' : '✦ Apply HDR Merge'}
          </button>
        </div>
      </div>
    </div>
  );
}