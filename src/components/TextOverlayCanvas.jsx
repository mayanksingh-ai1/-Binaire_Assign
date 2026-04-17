/**
 * TextOverlayCanvas.jsx
 * ─────────────────────────────────────────────────────────────────
 * Transparent SVG + canvas overlay for interactive text objects.
 *
 * Uses SVG (not canvas) for text interaction because:
 *   - SVG text is selectable, rotatable, resizable natively
 *   - DOM-level pointer events are precise
 *   - No need to hit-test pixel buffers
 *
 * Each text object is rendered as a <foreignObject> (or <text>)
 * with drag handles for move, a corner handle for resize, and
 * a rotation handle above the box.
 *
 * When text mode is inactive, overlay is pointer-events:none.
 *
 * Props:
 *   textObjects   — from useTextTool
 *   selectedId    — currently selected text id
 *   isTextMode    — boolean
 *   imageSize     — { width, height } in canvas px
 *   onAdd         — (x, y) => void  (click on blank area)
 *   onSelect      — (id) => void
 *   onDeselect    — () => void
 *   onMove        — (id, dx, dy) => void
 *   onUpdate      — (id, patch) => void
 *   onDelete      — (id) => void
 */
import React, { useRef, useCallback, useState } from 'react';

const HANDLE_R    = 7;   // handle circle radius
const MIN_SIZE    = 8;
const ROT_OFFSET  = 28;  // px above box for rotation handle

export default function TextOverlayCanvas({
  textObjects,
  selectedId,
  isTextMode,
  imageSize,
  onAdd,
  onSelect,
  onDeselect,
  onMove,
  onUpdate,
  onDelete,
}) {
  const svgRef        = useRef(null);
  const dragging      = useRef(null); // { type, id, startX, startY, origX, origY, ... }

  const getSVGPoint = useCallback((e) => {
    const svg  = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (imageSize.width  / rect.width),
      y: (e.clientY - rect.top)  * (imageSize.height / rect.height),
    };
  }, [imageSize]);

  // ── Background click → add text or deselect ────────────────────
  const handleBgClick = useCallback((e) => {
    if (!isTextMode) return;
    if (e.target !== svgRef.current) return; // clicked a text object
    const pt = getSVGPoint(e);
    onAdd(pt.x, pt.y);
  }, [isTextMode, getSVGPoint, onAdd]);

  // ── Drag start ──────────────────────────────────────────────────
  const startDrag = useCallback((e, type, obj, extra = {}) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = getSVGPoint(e);
    dragging.current = {
      type,
      id:     obj.id,
      startX: pt.x,
      startY: pt.y,
      origX:  obj.x,
      origY:  obj.y,
      origFontSize: obj.fontSize,
      origRotation: obj.rotation,
      ...extra,
    };
    onSelect(obj.id);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup',   endDrag);
  }, [getSVGPoint, onSelect]);

  const handleDrag = useCallback((e) => {
    const d = dragging.current;
    if (!d) return;
    const pt = getSVGPoint(e);
    const dx = pt.x - d.startX;
    const dy = pt.y - d.startY;

    if (d.type === 'move') {
      onMove(d.id, dx - (d.lastDx || 0), dy - (d.lastDy || 0));
      dragging.current.lastDx = dx;
      dragging.current.lastDy = dy;
    } else if (d.type === 'resize') {
      const newSize = Math.max(MIN_SIZE, d.origFontSize + dx * 0.5);
      onUpdate(d.id, { fontSize: Math.round(newSize) });
    } else if (d.type === 'rotate') {
      // Angle from center of text box to current mouse
      const obj = d.objRef;
      if (!obj) return;
      const cx   = obj.x + 60; // approx center
      const cy   = obj.y + obj.fontSize / 2;
      const angle = Math.atan2(pt.y - cy, pt.x - cx) * (180 / Math.PI) + 90;
      onUpdate(d.id, { rotation: Math.round(angle) });
    }
  }, [getSVGPoint, onMove, onUpdate]);

  const endDrag = useCallback(() => {
    dragging.current = null;
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup',   endDrag);
  }, [handleDrag]);

  if (!imageSize) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        overflow:      'visible',
        pointerEvents: isTextMode ? 'all' : 'none',
        cursor:        isTextMode ? 'crosshair' : 'default',
        zIndex:        15,
      }}
      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
      preserveAspectRatio="none"
      onClick={handleBgClick}
    >
      {textObjects.map((obj) => {
        const isSelected = obj.id === selectedId;
        const fontStr    = `${obj.italic ? 'italic ' : ''}${obj.bold ? 'bold ' : ''}${obj.fontSize}px ${obj.fontFamily}`;

        // Rough measure: 0.55 * fontSize per char
        const estWidth  = Math.max(60, obj.text.length * obj.fontSize * 0.55);
        const estHeight = obj.fontSize * 1.3;

        return (
          <g
            key={obj.id}
            transform={`rotate(${obj.rotation || 0}, ${obj.x + estWidth / 2}, ${obj.y + estHeight / 2})`}
            style={{ cursor: 'move' }}
            onMouseDown={(e) => startDrag(e, 'move', obj)}
            onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
          >
            {/* Text element */}
            <text
              x={obj.x}
              y={obj.y + obj.fontSize}
              style={{
                font:         fontStr,
                fill:         obj.color,
                opacity:      obj.opacity,
                userSelect:   'none',
                paintOrder:   'stroke',
                stroke:       'rgba(0,0,0,0.4)',
                strokeWidth:  obj.fontSize * 0.04,
              }}
            >
              {obj.text}
            </text>

            {/* Selection box + handles */}
            {isSelected && (
              <>
                {/* Bounding rect */}
                <rect
                  x={obj.x - 4}
                  y={obj.y - 4}
                  width={estWidth + 8}
                  height={estHeight + 8}
                  fill="none"
                  stroke="var(--accent, #0ea5e9)"
                  strokeWidth={1.5 / (imageSize.width / 800)}
                  strokeDasharray="5 3"
                />

                {/* Move handle (top-left) */}
                <circle
                  cx={obj.x - 4}
                  cy={obj.y - 4}
                  r={HANDLE_R}
                  fill="white"
                  stroke="var(--accent, #0ea5e9)"
                  strokeWidth={1.5}
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => startDrag(e, 'move', obj)}
                />

                {/* Resize handle (bottom-right) */}
                <rect
                  x={obj.x + estWidth}
                  y={obj.y + estHeight}
                  width={HANDLE_R * 2}
                  height={HANDLE_R * 2}
                  fill="white"
                  stroke="var(--accent, #0ea5e9)"
                  strokeWidth={1.5}
                  style={{ cursor: 'se-resize' }}
                  onMouseDown={(e) => startDrag(e, 'resize', obj)}
                />

                {/* Rotation handle (top-center) */}
                <line
                  x1={obj.x + estWidth / 2}
                  y1={obj.y - 4}
                  x2={obj.x + estWidth / 2}
                  y2={obj.y - ROT_OFFSET}
                  stroke="var(--accent, #0ea5e9)"
                  strokeWidth={1.5}
                />
                <circle
                  cx={obj.x + estWidth / 2}
                  cy={obj.y - ROT_OFFSET}
                  r={HANDLE_R}
                  fill="white"
                  stroke="var(--accent, #0ea5e9)"
                  strokeWidth={1.5}
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => startDrag(e, 'rotate', { ...obj, objRef: obj })}
                />

                {/* Delete handle (top-right) */}
                <circle
                  cx={obj.x + estWidth + 4}
                  cy={obj.y - 4}
                  r={HANDLE_R}
                  fill="var(--danger, #ef4444)"
                  stroke="white"
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
                />
                <text
                  x={obj.x + estWidth + 4}
                  y={obj.y - 4 + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={HANDLE_R * 1.2}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >✕</text>

                {/* Inline text edit on double-click */}
                <rect
                  x={obj.x - 4}
                  y={obj.y - 4}
                  width={estWidth + 8}
                  height={estHeight + 8}
                  fill="transparent"
                  style={{ cursor: 'text' }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const newText = window.prompt('Edit text:', obj.text);
                    if (newText !== null) onUpdate(obj.id, { text: newText });
                  }}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Flatten all text objects onto a given 2D canvas context.
 * Called during export to bake text into the final image.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} textObjects
 */
export function renderTextOntoCtx(ctx, textObjects) {
  textObjects.forEach((obj) => {
    ctx.save();
    const estWidth  = Math.max(60, obj.text.length * obj.fontSize * 0.55);
    const estHeight = obj.fontSize * 1.3;
    const cx = obj.x + estWidth / 2;
    const cy = obj.y + estHeight / 2;

    ctx.translate(cx, cy);
    if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    ctx.globalAlpha = obj.opacity ?? 1;
    ctx.font        = `${obj.italic ? 'italic ' : ''}${obj.bold ? 'bold ' : ''}${obj.fontSize}px ${obj.fontFamily}`;
    ctx.fillStyle   = obj.color;
    ctx.textBaseline = 'top';

    // Shadow for legibility
    ctx.shadowColor  = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur   = obj.fontSize * 0.06;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(obj.text, obj.x, obj.y);
    ctx.restore();
  });
}