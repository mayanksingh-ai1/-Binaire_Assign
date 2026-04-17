/**
 * BgRemoverPanel.jsx
 * UI panel for AI background removal.
 *
 * FIXED:
 *  - Uses checkBgRemoverStatus() instead of isBgRemoverAvailable()
 *  - Button calls onRun(opts) — parent (App) owns sourceImage & removeBackground()
 *  - processing state managed by parent via isProcessing prop
 *  - Shows model file setup instructions when files are missing
 */
import React, { useState, useCallback, useEffect } from 'react';
import { checkBgRemoverStatus } from '../utils/backgroundRemover';

export default function BgRemoverPanel({ hasImage, isProcessing, progress, onRun, toast }) {
  const [threshold,   setThreshold]   = useState(0.7);
  const [bgMode,      setBgMode]      = useState('transparent');
  const [bgColor,     setBgColor]     = useState('#ffffff');
  const [bgImageUrl,  setBgImageUrl]  = useState(null);
  const [status,      setStatus]      = useState(null); // null | { available, reason, hasLibs, hasModel }

  // Check status once on mount
  useEffect(() => {
    checkBgRemoverStatus().then(setStatus).catch(() => {
      setStatus({ available: false, hasLibs: false, hasModel: false, reason: 'Status check failed' });
    });
  }, []);

  const handleBgImageDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBgImageUrl(ev.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleRun = useCallback(() => {
    onRun({ threshold, bgMode, bgColor, bgImageUrl });
  }, [onRun, threshold, bgMode, bgColor, bgImageUrl]);

  return (
    <div style={{ padding: '4px 0' }}>
      <div className="tool-section-title" style={{ padding: '4px 4px 10px' }}>
        AI Background Removal
      </div>

      {/* Status indicator */}
      {status && !status.available && (
        <div style={warnBoxStyle}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {!status.hasLibs ? '📦 Missing: TensorFlow.js' : '📁 Missing: Model files'}
          </div>
          <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
            {status.reason}
          </pre>
          {status.hasLibs && !status.hasModel && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--accent)' }}>
              Run: <code>node scripts/download-bodypix.js</code>
            </div>
          )}
        </div>
      )}

      {status?.available && (
        <div style={readyBoxStyle}>✓ Model ready — fully offline</div>
      )}

      {/* Threshold slider */}
      <div className="slider-row" style={{ marginTop: 10 }}>
        <div className="slider-label-row">
          <span className="slider-label">Threshold</span>
          <span className="slider-value">{threshold.toFixed(2)}</span>
        </div>
        <input
          type="range" min={0.3} max={0.95} step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          Higher = stricter subject detection
        </div>
      </div>

      {/* Background mode */}
      <div className="tool-section-title" style={{ marginTop: 14, marginBottom: 8 }}>
        Replace Background
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['transparent', 'color', 'image'].map((m) => (
          <button
            key={m}
            onClick={() => setBgMode(m)}
            style={{
              flex: 1, height: 28,
              border: `1px solid ${bgMode === m ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 5,
              background: bgMode === m ? 'var(--accent-dim)' : 'transparent',
              color: bgMode === m ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 11, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Color picker */}
      {bgMode === 'color' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>BG Color</span>
          <input
            type="color" value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            style={{ width: 40, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{bgColor}</span>
        </div>
      )}

      {/* BG image drop zone */}
      {bgMode === 'image' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleBgImageDrop}
          style={{
            marginTop: 10,
            border: `2px dashed ${bgImageUrl ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 6, padding: 12,
            textAlign: 'center', fontSize: 11,
            color: bgImageUrl ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {bgImageUrl ? (
            <>
              <img src={bgImageUrl} alt="bg" style={{ maxWidth: '100%', maxHeight: 60, borderRadius: 4, marginBottom: 6 }} />
              <div>Background image set</div>
              <button style={smallBtnStyle} onClick={() => setBgImageUrl(null)}>Remove</button>
            </>
          ) : 'Drop background image here'}
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--accent)', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 5 }}>
          ⚙ {progress}
        </div>
      )}

      {/* Info */}
      <div style={infoBoxStyle}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Uses local BodyPix model (~4 MB). Best results on people &amp; portraits.
          Falls back to pixel-math if model is unavailable.
        </span>
      </div>

      {/* Run button */}
      <button
        disabled={!hasImage || isProcessing}
        onClick={handleRun}
        style={{
          ...runBtnStyle,
          opacity: (!hasImage || isProcessing) ? 0.5 : 1,
          cursor:  (!hasImage || isProcessing) ? 'not-allowed' : 'pointer',
        }}
      >
        {isProcessing ? '⏳ Processing…' : '🎭 Remove Background'}
      </button>
    </div>
  );
}

const warnBoxStyle = {
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: 6, padding: '8px 10px',
  fontSize: 11, color: 'var(--red, #ef4444)',
  marginBottom: 10,
};
const readyBoxStyle = {
  background: 'rgba(34,197,94,0.08)',
  border: '1px solid rgba(34,197,94,0.3)',
  borderRadius: 5, padding: '5px 10px',
  fontSize: 11, color: 'var(--success, #22c55e)',
  marginBottom: 6,
};
const infoBoxStyle = {
  marginTop: 10, padding: '7px 10px',
  background: 'rgba(14,165,233,0.06)',
  borderRadius: 6, border: '1px solid rgba(14,165,233,0.15)',
};
const runBtnStyle = {
  width: '100%', height: 34, marginTop: 12,
  background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(14,165,233,0.3))',
  border: '1px solid rgba(14,165,233,0.5)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--accent)', fontSize: 13, fontWeight: 600,
  transition: 'all 0.15s',
};
const smallBtnStyle = {
  padding: '3px 10px', background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-secondary)',
  fontSize: 10, cursor: 'pointer', marginTop: 4,
};