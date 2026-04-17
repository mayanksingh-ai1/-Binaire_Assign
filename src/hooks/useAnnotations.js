/**
 * useAnnotations.js
 * Manages annotation state: freehand paths, rectangles, arrows, text.
 * Integrates with the existing undo/redo history system.
 */
import { useState, useCallback, useRef } from 'react';

export const TOOLS = {
  NONE:      'none',
  FREEHAND:  'freehand',
  RECTANGLE: 'rectangle',
  ARROW:     'arrow',
  TEXT:      'text',
};

const MAX_ANNOTATION_HISTORY = 30;

export function useAnnotations() {
  // All committed annotations
  const [annotations, setAnnotations]       = useState([]);
  // Past annotation snapshots for undo
  const [annoHistory, setAnnoHistory]       = useState([[]]);
  const [annoHistIdx, setAnnoHistIdx]       = useState(0);
  // Active drawing tool
  const [activeTool, setActiveTool]         = useState(TOOLS.NONE);
  // Drawing options
  const [strokeColor, setStrokeColor]       = useState('#ff3b30');
  const [strokeWidth, setStrokeWidth]       = useState(3);
  const [fontSize, setFontSize]             = useState(18);
  // In-progress shape (while mouse is down)
  const drawingRef = useRef(null);

  // ── Push a new annotation snapshot ───────────────────────────
  const pushAnnoHistory = useCallback((newAnnotations) => {
    setAnnoHistory((prev) => {
      const truncated = prev.slice(0, annoHistIdx + 1);
      const next = [...truncated, newAnnotations].slice(-MAX_ANNOTATION_HISTORY);
      setAnnoHistIdx(next.length - 1);
      return next;
    });
  }, [annoHistIdx]);

  // ── Add a completed annotation ────────────────────────────────
  const addAnnotation = useCallback((annotation) => {
    setAnnotations((prev) => {
      const next = [...prev, annotation];
      pushAnnoHistory(next);
      return next;
    });
  }, [pushAnnoHistory]);

  // ── Undo last annotation ──────────────────────────────────────
  const undoAnnotation = useCallback(() => {
    if (annoHistIdx <= 0) return;
    const newIdx = annoHistIdx - 1;
    setAnnoHistIdx(newIdx);
    setAnnotations(annoHistory[newIdx]);
  }, [annoHistIdx, annoHistory]);

  // ── Redo annotation ────────────────────────────────────────────
  const redoAnnotation = useCallback(() => {
    if (annoHistIdx >= annoHistory.length - 1) return;
    const newIdx = annoHistIdx + 1;
    setAnnoHistIdx(newIdx);
    setAnnotations(annoHistory[newIdx]);
  }, [annoHistIdx, annoHistory]);

  // ── Clear all annotations ─────────────────────────────────────
  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    pushAnnoHistory([]);
  }, [pushAnnoHistory]);

  // ── Reset when new image is loaded ───────────────────────────
  const resetAnnotations = useCallback(() => {
    setAnnotations([]);
    setAnnoHistory([[]]);
    setAnnoHistIdx(0);
    drawingRef.current = null;
  }, []);

  return {
    annotations,
    activeTool, setActiveTool,
    strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth,
    fontSize, setFontSize,
    drawingRef,
    addAnnotation,
    undoAnnotation,
    redoAnnotation,
    clearAnnotations,
    resetAnnotations,
    canUndoAnno: annoHistIdx > 0,
    canRedoAnno: annoHistIdx < annoHistory.length - 1,
  };
}