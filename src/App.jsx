/**
 * App.jsx
 * ─────────────────────────────────────────────────────────────────
 * Root component. Owns all state, wires every feature together.
 *
 * Features:
 *   ✅ Image import (file dialog + drag & drop)
 *   ✅ Non-destructive edit stack (original never mutated)
 *   ✅ Before/After compare (originalDataUrl preserved separately)
 *   ✅ Adjustments (brightness, contrast, saturation, hue, blur…)
 *   ✅ Auto enhance (histogram analysis)
 *   ✅ Filter presets
 *   ✅ Undo / redo (image + adjustments)
 *   ✅ Edit history panel
 *   ✅ Drawing annotations (freehand, rect, arrow, text)
 *   ✅ Text overlays (drag, resize, rotate, font, color)
 *   ✅ AI background removal (TensorFlow.js BodyPix)
 *   ✅ HDR merge (OpenCV.js pure-JS pipeline)
 *   ✅ Advanced export (PNG/JPEG/WebP, quality, bake layers)
 *   ✅ Live RGB histogram
 *   ✅ Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Escape)
 * ─────────────────────────────────────────────────────────────────
 */
import React, {
  useState, useCallback, useRef, useEffect, useDeferredValue,
} from 'react';

import TopToolbar    from './components/TopToolbar';
import ImageCanvas   from './components/ImageCanvas';
import RightPanel    from './components/RightPanel';
import HistoryPanel  from './components/HistoryPanel';
import HDRMergeModal from './components/HDRMergeModal';
import ExportModal   from './components/ExportModal';

import { useImageHistory }                    from './hooks/useImageHistory';
import { useAnnotations }                     from './hooks/useAnnotations';
import { useEditStack }                       from './hooks/useEditStack';
import { useTextTool }                        from './hooks/useTextTool';
import { computeAutoEnhance, buildHistogramData } from './hooks/useAutoEnhance';
import { applyPreset }                        from './utils/presets';
import { removeBackground }                   from './utils/backgroundRemover';

// ── Toast notification ───────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ── Full-screen loading overlay ──────────────────────────────────
function LoadingOverlay({ message }) {
  return (
    <div style={overlayStyle}>
      <div style={spinnerStyle} />
      <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>
        {message}
      </span>
    </div>
  );
}

// ── Default adjustments ──────────────────────────────────────────
function defaultAdjustments() {
  return {
    brightness: 100, contrast:  100, saturation: 100,
    sharpness:  0,   exposure:  0,   hue:        0,
    blur:       0,   grayscale: false, sepia:    false,
    flipH:      false, flipV:   false, rotation: 0,
  };
}

// ════════════════════════════════════════════════════════════════
export default function App() {

  // ── Core image state ─────────────────────────────────────────
  /**
   * sourceImage: { dataUrl, name, width, height }
   *   dataUrl here is the LIVE version (may be replaced by bg-removal etc.)
   *
   * originalDataUrl: the very first dataUrl after import, NEVER changed.
   *   Used exclusively for the Before side of the compare slider.
   */
  const [sourceImage,     setSourceImage]     = useState(null);
  const [originalDataUrl, setOriginalDataUrl] = useState(null);
  const [adjustments,     setAdjustments]     = useState(defaultAdjustments());
  const [zoom,            setZoom]            = useState(1);
  const [activeTab,       setActiveTab]       = useState('adjust');

  // ── Modal / overlay state ────────────────────────────────────
  const [showHDR,       setShowHDR]       = useState(false);
  const [showExport,    setShowExport]    = useState(false);
  const [loadingMsg,    setLoadingMsg]    = useState('');   // '' = hidden
  const [bgProcessing,  setBgProcessing]  = useState(false);
  const [bgProgress,    setBgProgress]    = useState('');

  // ── Feature flags ────────────────────────────────────────────
  const [compareActive,   setCompareActive]   = useState(false);
  const [autoEnhancing,   setAutoEnhancing]   = useState(false);
  const [histData,        setHistData]        = useState(null);

  // ── Toasts ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  // ── Refs ─────────────────────────────────────────────────────
  const canvasRef = useRef(null);

  // ── Hooks ────────────────────────────────────────────────────
  const {
    history, currentIndex,
    pushHistory, undo, redo,
    canUndo, canRedo, goToIndex,
  } = useImageHistory();

  const {
    annotations, activeTool, strokeColor, strokeWidth, fontSize,
    drawingRef, addAnnotation,
    setActiveTool, setStrokeColor, setStrokeWidth, setFontSize,
    canUndoAnno, canRedoAnno,
    undoAnnotation, redoAnnotation,
    clearAnnotations, resetAnnotations,
  } = useAnnotations();

  const {
    editStack, setBase: setEditBase,
    toggleEdit, removeEdit, clearEdits, syncFromAdjustments,
  } = useEditStack();

  const {
    textObjects, selectedId: selectedTextId,
    selectedObject: selectedTextObject,
    isTextMode, defaultProps: defaultTextProps,
    setIsTextMode, setDefaultProps: setDefaultTextProps,
    addText, updateText, selectText, deselectAll,
    moveText, deleteText, deleteSelected: deleteSelectedText,
    resetTextTool,
  } = useTextTool();

  // ────────────────────────────────────────────────────────────
  // Toast
  // ────────────────────────────────────────────────────────────
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  // ────────────────────────────────────────────────────────────
  // Live histogram (debounced via useDeferredValue)
  // ────────────────────────────────────────────────────────────
  const deferredAdj = useDeferredValue(adjustments);
  useEffect(() => {
    if (!canvasRef.current || !sourceImage) { setHistData(null); return; }
    const t = setTimeout(() => {
      const c = canvasRef.current;
      if (!c || c.width === 0) return;
      buildHistogramData(c.toDataURL('image/png'))
        .then(setHistData)
        .catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [sourceImage, deferredAdj]);

  // ────────────────────────────────────────────────────────────
  // Load image (internal helper)
  // ────────────────────────────────────────────────────────────
  const loadImage = useCallback((dataUrl, name, historyType = 'Import', keepOriginal = false) => {
    const img = new Image();
    img.onload = () => {
      const imageData = { dataUrl, name, width: img.width, height: img.height };
      setSourceImage(imageData);

      // Preserve original only on fresh import, not on bg-remove results etc.
      if (!keepOriginal) {
        setOriginalDataUrl(dataUrl);
        setEditBase(dataUrl);  // anchor edit stack to this base
      }

      const initial = defaultAdjustments();
      setAdjustments(initial);
      syncFromAdjustments(initial);
      pushHistory({ type: historyType, imageData, adjustments: initial });
      setZoom(1);
      setCompareActive(false);
      resetAnnotations();
      resetTextTool();
    };
    img.src = dataUrl;
  }, [pushHistory, resetAnnotations, resetTextTool, setEditBase, syncFromAdjustments]);

  // ────────────────────────────────────────────────────────────
  // Import (file dialog)
  // ────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    try {
      const file = await window.electronAPI.openImage(false);
      if (!file) return;
      loadImage(file.dataUrl, file.name, 'Import');
      toast(`Imported: ${file.name}`, 'success');
    } catch {
      toast('Failed to import image', 'error');
    }
  }, [loadImage, toast]);

  // ────────────────────────────────────────────────────────────
  // Drag & drop
  // ────────────────────────────────────────────────────────────
  const handleDrop = useCallback(({ dataUrl, name }) => {
    loadImage(dataUrl, name, 'Drop Import');
    toast(`Opened: ${name}`, 'success');
  }, [loadImage, toast]);

  // ────────────────────────────────────────────────────────────
  // Export (open modal)
  // ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!sourceImage) { toast('No image to export', 'error'); return; }
    setShowExport(true);
  }, [sourceImage, toast]);

  // ────────────────────────────────────────────────────────────
  // Adjustments — push to edit stack on every change
  // ────────────────────────────────────────────────────────────
  const handleAdjust = useCallback((key, value) => {
    setAdjustments((prev) => {
      const next = { ...prev, [key]: value };
      pushHistory({ type: `Adjust ${key}`, imageData: sourceImage, adjustments: next });
      syncFromAdjustments(next);   // keep edit stack in sync
      return next;
    });
  }, [sourceImage, pushHistory, syncFromAdjustments]);

  const handleToggle = useCallback((key) => {
    setAdjustments((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      pushHistory({ type: key, imageData: sourceImage, adjustments: next });
      syncFromAdjustments(next);
      return next;
    });
  }, [sourceImage, pushHistory, syncFromAdjustments]);

  const handleTransform = useCallback((type) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      if (type === 'flipH')     next.flipH    = !prev.flipH;
      if (type === 'flipV')     next.flipV    = !prev.flipV;
      if (type === 'rotateCW')  next.rotation = ((prev.rotation || 0) + 90)  % 360;
      if (type === 'rotateCCW') next.rotation = ((prev.rotation || 0) - 90 + 360) % 360;
      pushHistory({ type, imageData: sourceImage, adjustments: next });
      syncFromAdjustments(next);
      return next;
    });
  }, [sourceImage, pushHistory, syncFromAdjustments]);

  const handleReset = useCallback(() => {
    const initial = defaultAdjustments();
    setAdjustments(initial);
    syncFromAdjustments(initial);
    pushHistory({ type: 'Reset', imageData: sourceImage, adjustments: initial });
    toast('Adjustments reset', 'info');
  }, [sourceImage, pushHistory, syncFromAdjustments, toast]);

  // ────────────────────────────────────────────────────────────
  // Auto Enhance
  // ────────────────────────────────────────────────────────────
  const handleAutoEnhance = useCallback(async () => {
    if (!sourceImage) return;
    setAutoEnhancing(true);
    try {
      const patch = await computeAutoEnhance(sourceImage.dataUrl);
      const { _histograms, ...adjPatch } = patch;
      const next = { ...adjustments, ...adjPatch };
      setAdjustments(next);
      syncFromAdjustments(next);
      pushHistory({ type: 'Auto Enhance', imageData: sourceImage, adjustments: next });
      toast('Auto enhance applied ✨', 'success');
    } catch (err) {
      toast(`Auto enhance failed: ${err.message}`, 'error');
    } finally {
      setAutoEnhancing(false);
    }
  }, [sourceImage, adjustments, pushHistory, syncFromAdjustments, toast]);

  // ────────────────────────────────────────────────────────────
  // Preset filter
  // ────────────────────────────────────────────────────────────
  const handleApplyPreset = useCallback((preset) => {
    const next = applyPreset(adjustments, preset);
    setAdjustments(next);
    syncFromAdjustments(next);
    pushHistory({ type: `Preset: ${preset.label}`, imageData: sourceImage, adjustments: next });
    toast(`Applied: ${preset.label}`, 'success');
  }, [adjustments, sourceImage, pushHistory, syncFromAdjustments, toast]);

  // ────────────────────────────────────────────────────────────
  // Undo / Redo
  // ────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const entry = undo();
    if (entry) {
      setSourceImage(entry.imageData);
      setAdjustments(entry.adjustments);
      syncFromAdjustments(entry.adjustments);
    }
  }, [undo, syncFromAdjustments]);

  const handleRedo = useCallback(() => {
    const entry = redo();
    if (entry) {
      setSourceImage(entry.imageData);
      setAdjustments(entry.adjustments);
      syncFromAdjustments(entry.adjustments);
    }
  }, [redo, syncFromAdjustments]);

  const handleHistoryJump = useCallback((index) => {
    const entry = goToIndex(index);
    if (entry) {
      setSourceImage(entry.imageData);
      setAdjustments(entry.adjustments);
      syncFromAdjustments(entry.adjustments);
    }
  }, [goToIndex, syncFromAdjustments]);

  // ────────────────────────────────────────────────────────────
  // HDR Merge
  // ────────────────────────────────────────────────────────────
  const handleHDRResult = useCallback((dataUrl) => {
    setLoadingMsg('');
    loadImage(dataUrl, 'hdr-merge.jpg', 'HDR Merge');
    toast('HDR merge complete!', 'success');
  }, [loadImage, toast]);

  // ────────────────────────────────────────────────────────────
  // Background Removal
  // Called by BgRemoverPanel with opts = { threshold, bgMode, bgColor, bgImageUrl }
  // ────────────────────────────────────────────────────────────
  const handleBgRemoveRun = useCallback(async (opts) => {
    if (!sourceImage) return;
    setBgProcessing(true);
    setBgProgress('Starting…');
    try {
      const result = await removeBackground(sourceImage.dataUrl, {
        threshold:  opts.threshold,
        bgColor:    opts.bgMode === 'color' ? opts.bgColor    : null,
        bgImage:    opts.bgMode === 'image' ? opts.bgImageUrl : null,
        onProgress: (msg) => setBgProgress(msg),
      });
      const img = new Image();
      img.onload = () => {
        const imageData = {
          dataUrl: result,
          name:    'bg-removed.png',
          width:   img.width,
          height:  img.height,
        };
        setSourceImage(imageData);
        pushHistory({ type: 'BG Removal', imageData, adjustments });
        setBgProcessing(false);
        setBgProgress('');
        toast('Background removed ✓', 'success');
      };
      img.src = result;
    } catch (err) {
      toast(`BG removal failed: ${err.message}`, 'error');
      setBgProcessing(false);
      setBgProgress('');
    }
  }, [sourceImage, adjustments, pushHistory, toast]);

  // ────────────────────────────────────────────────────────────
  // Text tool handlers
  // ────────────────────────────────────────────────────────────
  const handleToggleTextMode = useCallback(() => {
    setIsTextMode((prev) => !prev);
    deselectAll();
  }, [setIsTextMode, deselectAll]);

  const handleAddText = useCallback((x, y) => {
    const text = window.prompt('Enter text:');
    if (text) addText(x, y, text);
  }, [addText]);

  // ────────────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
      if (mod && e.key === 'e') { e.preventDefault(); handleExport(); return; }
      if (e.key === 'Escape') {
        setCompareActive(false);
        setShowExport(false);
        setShowHDR(false);
        setIsTextMode(false);
        deselectAll();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTextId) deleteSelectedText();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, handleExport, selectedTextId, deleteSelectedText, setIsTextMode, deselectAll]);

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      {/* ── Custom frameless titlebar ─────────────────────── */}
      <div className="app-titlebar">
        <div className="titlebar-left">
          <div className="app-logo">IF</div>
          <span className="titlebar-title">ImageForge</span>
          {sourceImage && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              — {sourceImage.name}
            </span>
          )}
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.electronAPI.minimize()}>─</button>
          <button className="titlebar-btn" onClick={() => window.electronAPI.maximize()}>□</button>
          <button className="titlebar-btn close" onClick={() => window.electronAPI.close()}>✕</button>
        </div>
      </div>

      <div className="app-body">

        {/* ── Top toolbar ──────────────────────────────────── */}
        <TopToolbar
          hasImage={!!sourceImage}
          canUndo={canUndo}
          canRedo={canRedo}
          onImport={handleImport}
          onExport={handleExport}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onHDRMerge={() => setShowHDR(true)}
          compareActive={compareActive}
          onToggleCompare={() => setCompareActive((p) => !p)}
        />

        <div className="app-main">

          {/* ── History panel ─────────────────────────────── */}
          <HistoryPanel
            history={history}
            currentIndex={currentIndex}
            onJump={handleHistoryJump}
          />

          {/* ── Central canvas ────────────────────────────── */}
          <ImageCanvas
            sourceImage={sourceImage}
            adjustments={adjustments}
            canvasRef={canvasRef}
            zoom={zoom}
            onZoomChange={setZoom}
            originalDataUrl={originalDataUrl}
            // Annotations
            annotations={annotations}
            activeTool={activeTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            fontSize={fontSize}
            drawingRef={drawingRef}
            addAnnotation={addAnnotation}
            setActiveTool={setActiveTool}
            setStrokeColor={setStrokeColor}
            setStrokeWidth={setStrokeWidth}
            setFontSize={setFontSize}
            canUndoAnno={canUndoAnno}
            canRedoAnno={canRedoAnno}
            onUndoAnno={undoAnnotation}
            onRedoAnno={redoAnnotation}
            onClearAnnotations={clearAnnotations}
            // Compare
            compareActive={compareActive}
            onCloseCompare={() => setCompareActive(false)}
            // Drop
            onDrop={handleDrop}
            // Text tool
            textObjects={textObjects}
            selectedTextId={selectedTextId}
            isTextMode={isTextMode}
            onAddText={handleAddText}
            onSelectText={selectText}
            onDeselectText={deselectAll}
            onMoveText={moveText}
            onUpdateText={updateText}
            onDeleteText={deleteText}
            onToggleTextMode={handleToggleTextMode}
            defaultTextProps={defaultTextProps}
            onUpdateDefaultTextProps={setDefaultTextProps}
            selectedTextObject={selectedTextObject}
            onDeleteSelectedText={deleteSelectedText}
          />

          {/* ── Right panel ───────────────────────────────── */}
          <RightPanel
            adjustments={adjustments}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAdjust={handleAdjust}
            onToggle={handleToggle}
            onTransform={handleTransform}
            onReset={handleReset}
            onAutoEnhance={handleAutoEnhance}
            autoEnhancing={autoEnhancing}
            onApplyPreset={handleApplyPreset}
            histData={histData}
            hasImage={!!sourceImage}
            editStack={editStack}
            onToggleEdit={toggleEdit}
            onRemoveEdit={removeEdit}
            onClearEdits={clearEdits}
            onBgRemoveRun={handleBgRemoveRun}
            bgProcessing={bgProcessing}
            bgProgress={bgProgress}
            toast={toast}
          />
        </div>

        {/* ── Status bar ───────────────────────────────────── */}
        <div className="status-bar">
          <div className="status-item">
            <div className="status-dot" />
            <span>
              {bgProcessing
                ? `🎭 ${bgProgress || 'Removing background…'}`
                : loadingMsg
                ? `⚙ ${loadingMsg}`
                : compareActive
                ? '◧ Compare Mode'
                : isTextMode
                ? 'T Text Tool — click canvas to place text'
                : activeTool !== 'none'
                ? `✏ Draw: ${activeTool}`
                : 'Ready'}
            </span>
          </div>
          {sourceImage && (
            <>
              <span>|</span>
              <span>{sourceImage.width} × {sourceImage.height}px</span>
              <span>|</span>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
              {annotations.length > 0 && (
                <><span>|</span><span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span></>
              )}
              {textObjects.length > 0 && (
                <><span>|</span><span>{textObjects.length} text object{textObjects.length !== 1 ? 's' : ''}</span></>
              )}
              {editStack.length > 0 && (
                <><span>|</span><span>{editStack.filter(e => e.enabled).length}/{editStack.length} edits active</span></>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      {showHDR && (
        <HDRMergeModal
          onClose={() => setShowHDR(false)}
          onResult={handleHDRResult}
          toast={toast}
        />
      )}

      {showExport && (
        <ExportModal
          canvasRef={canvasRef}
          sourceImage={sourceImage}
          annotations={annotations}
          textObjects={textObjects}
          onClose={() => setShowExport(false)}
          toast={toast}
        />
      )}

      {/* ── Global loading overlay ──────────────────────────── */}
      {loadingMsg && <LoadingOverlay message={loadingMsg} />}

      {/* ── Toast notifications ──────────────────────────────── */}
      <Toast toasts={toasts} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.68)',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  zIndex: 2000, backdropFilter: 'blur(6px)', gap: 16,
  animation: 'fadeIn 0.2s ease',
};

const spinnerStyle = {
  width: 42, height: 42,
  border: '3px solid rgba(14,165,233,0.2)',
  borderTop: '3px solid var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.75s linear infinite',
};