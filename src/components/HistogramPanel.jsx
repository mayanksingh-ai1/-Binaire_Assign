/**
 * HistogramPanel.jsx
 * Draws a real-time RGB histogram using a <canvas> element.
 * Receives pre-computed histogram data (normalised 0–1 arrays, 256 bins).
 * Updates whenever histData prop changes (debounced in parent).
 */
import React, { useEffect, useRef } from 'react';

const W = 256;
const H = 80;

export default function HistogramPanel({ histData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (!histData) {
      // Draw placeholder grid
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.fillStyle = '#333';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No image loaded', W / 2, H / 2 + 4);
      return;
    }

    const { r, g, b } = histData;

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(0, 0, W, H);

    // ── Grid lines ──────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    [64, 128, 192].forEach((x) => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    });
    [H * 0.25, H * 0.5, H * 0.75].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });

    // ── Draw each channel ───────────────────────────────────────
    const channels = [
      { data: r, color: 'rgba(239,68,68,0.6)' },
      { data: g, color: 'rgba(34,197,94,0.6)' },
      { data: b, color: 'rgba(59,130,246,0.6)' },
    ];

    channels.forEach(({ data, color }) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * W;
        const y = H - data[i] * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });

    // ── Luminance overlay (white) ────────────────────────────────
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W;
      const lum = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i];
      const y = H - lum * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [histData]);

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Histogram</div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={canvasStyle}
      />
      <div style={legendStyle}>
        <span style={{ color: '#ef4444' }}>■ R</span>
        <span style={{ color: '#22c55e' }}>■ G</span>
        <span style={{ color: '#3b82f6' }}>■ B</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>— Lum</span>
      </div>
    </div>
  );
}

const containerStyle = {
  padding: '8px 4px 4px',
  borderTop: '1px solid var(--border)',
  marginTop: 8,
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: 6,
};

const canvasStyle = {
  width: '100%',
  height: 80,
  borderRadius: 6,
  display: 'block',
  border: '1px solid var(--border)',
};

const legendStyle = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
  fontSize: 10,
  color: 'var(--text-muted)',
};