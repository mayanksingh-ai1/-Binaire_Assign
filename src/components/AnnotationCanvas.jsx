/**
 * AnnotationCanvas.jsx
 * A transparent <canvas> overlay that sits on top of the image canvas.
 * Handles: freehand draw, rectangle, arrow, text annotations.
 * All drawing is done at the source image's native pixel dimensions
 * so annotations export correctly at full resolution.
 *
 * Props:
 *   annotations      — committed annotations array
 *   activeTool       — TOOLS.* constant
 *   strokeColor      — hex colour string
 *   strokeWidth      — number (pixels at 1x)
 *   fontSize         — number (px)
 *   drawingRef       — ref for in-progress shape
 *   addAnnotation    — fn(annotation) → void
 *   canvasRef        — image canvas ref (to match dimensions)
 *   zoom             — current zoom level
 *   panOffset        — { x, y }
 *   imageSize        — { width, height } of source image
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TOOLS } from '../hooks/useAnnotations';

export default function AnnotationCanvas({
  annotations,
  activeTool,
  strokeColor,
  strokeWidth,
  fontSize,
  drawingRef,
  addAnnotation,
  zoom,
  panOffset,
  imageSize,
}) {
  const annoCanvasRef = useRef(null);
  const isDrawingRef  = useRef(false);
  const startPosRef   = useRef({ x: 0, y: 0 });
  const currentPathRef = useRef([]);
  const [, forceUpdate] = useState(0);

  // Convert screen coords → image-space coords
  const screenToImage = useCallback((e) => {
    const canvas = annoCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Canvas element is sized to image pixels but displayed via CSS transform
    // So just map client coords relative to canvas bounds
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }, []);

  // ── Render all annotations + in-progress shape ────────────────
  const render = useCallback(() => {
    const canvas = annoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allShapes = [...annotations];
    if (drawingRef.current) allShapes.push(drawingRef.current);

    allShapes.forEach((shape) => drawShape(ctx, shape));
  }, [annotations, drawingRef]);

  useEffect(() => { render(); }, [render]);

  // Size the annotation canvas to match the image
  useEffect(() => {
    const canvas = annoCanvasRef.current;
    if (!canvas || !imageSize) return;
    canvas.width  = imageSize.width;
    canvas.height = imageSize.height;
    render();
  }, [imageSize, render]);

  // ── Mouse handlers ────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (activeTool === TOOLS.NONE) return;
    e.stopPropagation(); // prevent canvas panning
    isDrawingRef.current = true;
    const pos = screenToImage(e);
    startPosRef.current = pos;

    if (activeTool === TOOLS.FREEHAND) {
      currentPathRef.current = [pos];
      drawingRef.current = {
        type: TOOLS.FREEHAND,
        points: currentPathRef.current,
        color: strokeColor,
        width: strokeWidth,
      };
    } else if (activeTool === TOOLS.TEXT) {
      // Prompt for text immediately on click
      const text = window.prompt('Enter annotation text:');
      if (text) {
        addAnnotation({
          type: TOOLS.TEXT,
          x: pos.x,
          y: pos.y,
          text,
          color: strokeColor,
          size: fontSize,
        });
      }
      isDrawingRef.current = false;
      drawingRef.current = null;
    } else {
      drawingRef.current = {
        type: activeTool,
        x1: pos.x, y1: pos.y,
        x2: pos.x, y2: pos.y,
        color: strokeColor,
        width: strokeWidth,
      };
    }
    forceUpdate((n) => n + 1);
  }, [activeTool, strokeColor, strokeWidth, fontSize, screenToImage, addAnnotation, drawingRef]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current || activeTool === TOOLS.NONE) return;
    const pos = screenToImage(e);

    if (activeTool === TOOLS.FREEHAND) {
      currentPathRef.current.push(pos);
      drawingRef.current = {
        ...drawingRef.current,
        points: [...currentPathRef.current],
      };
    } else if (drawingRef.current) {
      drawingRef.current = { ...drawingRef.current, x2: pos.x, y2: pos.y };
    }
    render();
  }, [activeTool, screenToImage, render, drawingRef]);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (drawingRef.current) {
      addAnnotation({ ...drawingRef.current });
      drawingRef.current = null;
      currentPathRef.current = [];
    }
    render();
  }, [addAnnotation, render, drawingRef]);

  const cursor = activeTool === TOOLS.NONE ? 'default'
    : activeTool === TOOLS.TEXT ? 'text'
    : 'crosshair';

  return (
    <canvas
      ref={annoCanvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor,
        // Only capture pointer events when a tool is active
        pointerEvents: activeTool === TOOLS.NONE ? 'none' : 'all',
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

// ── Shape rendering ────────────────────────────────────────────────

function drawShape(ctx, shape) {
  ctx.save();
  ctx.strokeStyle = shape.color || '#ff3b30';
  ctx.fillStyle   = shape.color || '#ff3b30';
  ctx.lineWidth   = shape.width || 3;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  switch (shape.type) {
    case TOOLS.FREEHAND:
      if (!shape.points || shape.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      break;

    case TOOLS.RECTANGLE: {
      const x = Math.min(shape.x1, shape.x2);
      const y = Math.min(shape.y1, shape.y2);
      const w = Math.abs(shape.x2 - shape.x1);
      const h = Math.abs(shape.y2 - shape.y1);
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();
      break;
    }

    case TOOLS.ARROW: {
      const dx = shape.x2 - shape.x1;
      const dy = shape.y2 - shape.y1;
      const angle = Math.atan2(dy, dx);
      const len = Math.sqrt(dx * dx + dy * dy);
      const headLen = Math.min(30, len * 0.3);

      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(shape.x2, shape.y2);
      ctx.lineTo(
        shape.x2 - headLen * Math.cos(angle - Math.PI / 6),
        shape.y2 - headLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(shape.x2, shape.y2);
      ctx.lineTo(
        shape.x2 - headLen * Math.cos(angle + Math.PI / 6),
        shape.y2 - headLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.stroke();
      break;
    }

    case TOOLS.TEXT:
      ctx.font = `${shape.size || 18}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      // Shadow for legibility
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur  = 4;
      ctx.fillText(shape.text, shape.x, shape.y);
      break;

    default:
      break;
  }

  ctx.restore();
}

/**
 * Flatten all annotations onto a given canvas context.
 * Called by the export logic so annotations are baked into the export.
 */
export function renderAnnotationsOntoCtx(ctx, annotations) {
  annotations.forEach((shape) => drawShape(ctx, shape));
}