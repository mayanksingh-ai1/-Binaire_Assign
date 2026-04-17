/**
 * ImageCanvas.jsx
 * Central canvas area: image rendering, pan/zoom, drag-drop,
 * annotation overlay, text overlay, before/after compare.
 *
 * FIXES:
 *  - Removed dead handleCanvasAreaClick (TextOverlayCanvas handles clicks)
 *  - Pan is disabled when isTextMode OR activeTool !== 'none'
 *  - TextOverlayCanvas rendered with all required props
 *  - canvas-wrapper position:relative so absolute children overlay correctly
 */
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import AnnotationCanvas   from './AnnotationCanvas';
import AnnotationToolbar  from './AnnotationToolbar';
import BeforeAfterSlider  from './BeforeAfterSlider';
import TextOverlayCanvas  from './TextOverlayCanvas';
import TextToolbar        from './TextToolbar';

const ImageCanvas = memo(function ImageCanvas({
  sourceImage,
  adjustments,
  canvasRef,
  zoom,
  onZoomChange,
  originalDataUrl,
  // Annotations
  annotations,
  activeTool,
  strokeColor,
  strokeWidth,
  fontSize,
  drawingRef,
  addAnnotation,
  setActiveTool,
  setStrokeColor,
  setStrokeWidth,
  setFontSize,
  canUndoAnno,
  canRedoAnno,
  onUndoAnno,
  onRedoAnno,
  onClearAnnotations,
  // Compare
  compareActive,
  onCloseCompare,
  // Drop
  onDrop,
  // Text tool
  textObjects,
  selectedTextId,
  isTextMode,
  onAddText,
  onSelectText,
  onDeselectText,
  onMoveText,
  onUpdateText,
  onDeleteText,
  onToggleTextMode,
  defaultTextProps,
  onUpdateDefaultTextProps,
  selectedTextObject,
  onDeleteSelectedText,
}) {
  const wrapperRef    = useRef(null);
  const isPanningRef  = useRef(false);
  const lastMouseRef  = useRef({ x: 0, y: 0 });
  const zoomTimerRef  = useRef(null);

  const [panOffset,  setPanOffset]  = useState({ x: 0, y: 0 });
  const [showZoom,   setShowZoom]   = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Draw image to canvas ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    const img = new Image();
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.save();
      const cx = img.width  / 2;
      const cy = img.height / 2;
      ctx.translate(cx, cy);
      if (adjustments.rotation) {
        ctx.rotate((adjustments.rotation * Math.PI) / 180);
      }
      ctx.scale(adjustments.flipH ? -1 : 1, adjustments.flipV ? -1 : 1);
      ctx.translate(-cx, -cy);
      ctx.filter = buildCSSFilter(adjustments);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };
    img.src = sourceImage.dataUrl;
  }, [sourceImage, adjustments, canvasRef]);

  // ── Scroll-wheel zoom ────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    onZoomChange((prev) => Math.min(Math.max(prev * factor, 0.05), 10));
    setShowZoom(true);
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoom(false), 1200);
  }, [onZoomChange]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Pan — disabled when text mode or draw tool is active ─────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Yield to text tool and annotation tools
    if (isTextMode || activeTool !== 'none') return;
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [activeTool, isTextMode]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const stopPan = useCallback(() => { isPanningRef.current = false; }, []);

  // Reset pan when a new image is loaded
  useEffect(() => { setPanOffset({ x: 0, y: 0 }); }, [sourceImage]);

  // ── Drag & Drop ──────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = (ev) => onDrop?.({ dataUrl: ev.target.result, name: file.name });
    reader.readAsDataURL(file);
  }, [onDrop]);

  // Cursor priority: text > draw tool > pan
  const cursor = isTextMode
    ? 'crosshair'
    : activeTool !== 'none'
    ? 'crosshair'
    : 'grab';

  return (
    <div
      className="canvas-area"
      ref={wrapperRef}
      style={{ position: 'relative', cursor, overflow: 'hidden' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // NOTE: No onClick handler here — TextOverlayCanvas handles canvas clicks
    >
      {/* Drag-over indicator */}
      {isDragOver && (
        <div style={dragOverlayStyle}>
          <div style={{ fontSize: 44 }}>📥</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>Drop to open image</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>JPEG · PNG · WebP</div>
        </div>
      )}

      {/* Empty state */}
      {!sourceImage && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">🖼️</div>
          <div className="canvas-empty-text">Import or drop an image to begin</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            JPEG · PNG · WebP — drag &amp; drop supported
          </div>
        </div>
      )}

      {/* Main canvas + overlays */}
      {sourceImage && (
        <>
          {/* Pan/zoom wrapper */}
          <div
            className="canvas-wrapper"
            style={{
              transform:       `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition:       isPanningRef.current ? 'none' : 'transform 0.04s ease-out',
              position:        'relative',   // ← required for absolute children
              display:         'inline-block', // shrink-wraps to canvas size
            }}
          >
            {/* Edited image canvas */}
            <canvas
              id="imageCanvas"
              ref={canvasRef}
              style={{ display: 'block' }}
            />

            {/* Drawing annotation overlay */}
            <AnnotationCanvas
              annotations={annotations}
              activeTool={activeTool}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              fontSize={fontSize}
              drawingRef={drawingRef}
              addAnnotation={addAnnotation}
              zoom={zoom}
              panOffset={panOffset}
              imageSize={{ width: sourceImage.width, height: sourceImage.height }}
            />

            {/*
              Text SVG overlay.
              Positioned absolute over the canvas (inset:0, w/h:100%).
              The SVG viewBox matches the source image pixel dimensions.
              Its transparent background rect captures all clicks.
            */}
            <TextOverlayCanvas
              textObjects={textObjects}
              selectedId={selectedTextId}
              isTextMode={isTextMode}
              imageSize={{ width: sourceImage.width, height: sourceImage.height }}
              onAdd={onAddText}
              onSelect={onSelectText}
              onDeselect={onDeselectText}
              onMove={onMoveText}
              onUpdate={onUpdateText}
              onDelete={onDeleteText}
            />
          </div>

          {/* Before/After compare overlay */}
          <BeforeAfterSlider
            originalDataUrl={originalDataUrl}
            editedCanvasRef={canvasRef}
            active={compareActive}
            onClose={onCloseCompare}
          />
        </>
      )}

      {/* Zoom indicator */}
      <div className={`zoom-indicator${showZoom ? ' visible' : ''}`}>
        {Math.round(zoom * 100)}%
      </div>

      {/* Annotation floating toolbar (bottom-center) */}
      <AnnotationToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fontSize={fontSize}
        setFontSize={setFontSize}
        canUndoAnno={canUndoAnno}
        canRedoAnno={canRedoAnno}
        onUndoAnno={onUndoAnno}
        onRedoAnno={onRedoAnno}
        onClear={onClearAnnotations}
        hasImage={!!sourceImage}
      />

      {/* Text tool toolbar (top-center) */}
      <TextToolbar
        isTextMode={isTextMode}
        selectedObject={selectedTextObject}
        defaultProps={defaultTextProps}
        onToggleMode={onToggleTextMode}
        onUpdateSelected={onUpdateText}
        onUpdateDefault={onUpdateDefaultTextProps}
        onDeleteSelected={onDeleteSelectedText}
        hasImage={!!sourceImage}
      />
    </div>
  );
});

export default ImageCanvas;

// ── CSS filter builder ───────────────────────────────────────────
function buildCSSFilter(adj) {
  const parts = [
    `brightness(${adj.brightness / 100})`,
    `contrast(${adj.contrast / 100})`,
    `saturate(${adj.saturation / 100})`,
    `hue-rotate(${adj.hue}deg)`,
    adj.blur      > 0 ? `blur(${adj.blur}px)` : '',
    adj.grayscale      ? 'grayscale(1)'        : '',
    adj.sepia          ? 'sepia(1)'            : '',
  ];
  return parts.filter(Boolean).join(' ') || 'none';
}

const dragOverlayStyle = {
  position:       'absolute',
  inset:           0,
  background:     'rgba(14,165,233,0.12)',
  border:         '3px dashed var(--accent)',
  borderRadius:    8,
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  color:          'var(--accent)',
  zIndex:          200,
  pointerEvents:  'none',
  animation:      'fadeIn 0.15s ease',
};