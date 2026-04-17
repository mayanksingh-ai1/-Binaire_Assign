/**
 * BeforeAfterSlider.jsx — FIXED
 * ─────────────────────────────────────────────────────────────────
 * Root cause of the blank BEFORE side:
 *   The old code used clipPath on separate <div> wrappers containing
 *   two independently-sized canvas elements. The origCanvas was sized
 *   to image pixel dimensions but had no knowledge of the display
 *   container, so object-fit/maxWidth clipping misaligned both sides.
 *
 * Fix architecture:
 *   - One single <canvas> for BEFORE (draws original image)
 *   - One single <canvas> for AFTER  (mirrors edited canvas via RAF)
 *   - Both canvases are position:absolute, inset:0, width:100%, height:100%
 *     → they fill the container identically using CSS contain/object-fit
 *   - clipPath is applied to the AFTER canvas wrapper only
 *   - The BEFORE canvas shows through underneath on the left
 *   - A CSS clip rect on the AFTER wrapper reveals only the right portion
 *
 *   This guarantees pixel-perfect alignment because both sides occupy
 *   identical DOM space and use the same CSS display rules.
 *
 * Props:
 *   originalDataUrl  — the raw imported image dataUrl (never edited)
 *   editedCanvasRef  — ref to the live edited <canvas>
 *   active           — boolean
 *   onClose          — fn()
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';

export default function BeforeAfterSlider({
  originalDataUrl,
  editedCanvasRef,
  active,
  onClose,
}) {
  const containerRef   = useRef(null);
  const beforeCanvasRef = useRef(null);
  const afterCanvasRef  = useRef(null);
  const [splitPct, setSplitPct]   = useState(50);
  const isDraggingRef  = useRef(false);
  const rafRef         = useRef(null);

  // ── Draw BEFORE: original image ───────────────────────────────
  useEffect(() => {
    if (!active || !originalDataUrl || !beforeCanvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const c   = beforeCanvasRef.current;
      if (!c) return;
      c.width   = img.width;
      c.height  = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
    };
    img.src = originalDataUrl;
  }, [active, originalDataUrl]);

  // ── Mirror AFTER: copy edited canvas each frame ───────────────
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const src  = editedCanvasRef.current;
      const dest = afterCanvasRef.current;
      if (src && dest && src.width > 0 && src.height > 0) {
        if (dest.width !== src.width || dest.height !== src.height) {
          dest.width  = src.width;
          dest.height = src.height;
        }
        dest.getContext('2d').drawImage(src, 0, 0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, editedCanvasRef]);

  // ── Divider drag ─────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    isDraggingRef.current = true;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct  = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    setSplitPct(pct);
  }, []);

  const onMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);

  // Touch support
  const onTouchMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect  = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const pct   = Math.min(98, Math.max(2, ((touch.clientX - rect.left) / rect.width) * 100));
    setSplitPct(pct);
  }, []);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onMouseUp}
    >
      {/* ── BEFORE canvas (left, full width, base layer) ───────── */}
      <canvas
        ref={beforeCanvasRef}
        style={canvasBaseStyle}
      />

      {/* ── AFTER canvas (right, clipped to reveal right portion) ─ */}
      <div
        style={{
          ...clipWrapperStyle,
          clipPath: `inset(0 0 0 ${splitPct}%)`,
          WebkitClipPath: `inset(0 0 0 ${splitPct}%)`,
        }}
      >
        <canvas
          ref={afterCanvasRef}
          style={canvasBaseStyle}
        />
      </div>

      {/* ── BEFORE label ────────────────────────────────────────── */}
      <div style={{ ...badgeStyle, left: 12 }}>BEFORE</div>

      {/* ── AFTER label ─────────────────────────────────────────── */}
      <div style={{ ...badgeStyle, right: 12 }}>AFTER</div>

      {/* ── Divider line ─────────────────────────────────────────── */}
      <div
        style={{ ...dividerLineStyle, left: `${splitPct}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={(e) => { isDraggingRef.current = true; e.preventDefault(); }}
      >
        {/* Scrubber handle */}
        <div style={scrubHandleStyle}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M6 10 L2 6 L2 14 Z" fill="#333"/>
            <path d="M14 10 L18 6 L18 14 Z" fill="#333"/>
            <line x1="10" y1="0" x2="10" y2="20" stroke="#333" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>

      {/* ── Close button ─────────────────────────────────────────── */}
      <button style={closeBtnStyle} onClick={onClose}>
        ✕ Exit Compare
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const containerStyle = {
  position:   'absolute',
  inset:       0,
  zIndex:      50,
  overflow:   'hidden',
  background: '#111',
  userSelect: 'none',
};

/**
 * Both canvases use the same CSS:
 *   - position absolute, inset 0
 *   - width/height 100% to fill container
 *   - object-fit contain to keep aspect ratio
 *
 * Canvas pixel dimensions are set in JS (matching the image).
 * CSS `width:100%, height:100%` + `object-fit:contain` ensures
 * the rendered image always fills the space identically on both
 * sides regardless of container size.
 */
const canvasBaseStyle = {
  position:   'absolute',
  inset:       0,
  width:      '100%',
  height:     '100%',
  objectFit:  'contain',
  display:    'block',
};

const clipWrapperStyle = {
  position:   'absolute',
  inset:       0,
  transition: 'clip-path 0s',
};

const dividerLineStyle = {
  position:  'absolute',
  top:        0,
  bottom:     0,
  width:      2,
  background: 'rgba(255,255,255,0.95)',
  transform: 'translateX(-50%)',
  zIndex:     10,
  display:   'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor:    'col-resize',
};

const scrubHandleStyle = {
  width:         32,
  height:        32,
  background:   'white',
  borderRadius: '50%',
  display:      'flex',
  alignItems:   'center',
  justifyContent: 'center',
  boxShadow:    '0 2px 12px rgba(0,0,0,0.5)',
  cursor:       'col-resize',
  flexShrink:    0,
};

const badgeStyle = {
  position:    'absolute',
  top:          12,
  zIndex:       20,
  padding:     '3px 12px',
  background:  'rgba(0,0,0,0.65)',
  borderRadius: 4,
  color:       'rgba(255,255,255,0.85)',
  fontSize:     11,
  fontWeight:   700,
  letterSpacing: '0.1em',
  pointerEvents: 'none',
  backdropFilter: 'blur(4px)',
};

const closeBtnStyle = {
  position:      'absolute',
  top:            12,
  left:          '50%',
  transform:     'translateX(-50%)',
  zIndex:         20,
  padding:       '6px 18px',
  background:    'rgba(0,0,0,0.75)',
  border:        '1px solid rgba(255,255,255,0.25)',
  borderRadius:   20,
  color:         'white',
  fontSize:       12,
  fontWeight:     500,
  cursor:        'pointer',
  backdropFilter: 'blur(8px)',
  whiteSpace:    'nowrap',
};