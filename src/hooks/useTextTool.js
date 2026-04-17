/**
 * useTextTool.js
 * ─────────────────────────────────────────────────────────────────
 * Manages a collection of text overlay objects on the canvas.
 *
 * Each text object:
 * {
 *   id:        string
 *   text:      string
 *   x:         number   (canvas pixels, left edge)
 *   y:         number   (canvas pixels, top edge)
 *   fontSize:  number   (px)
 *   fontFamily:string
 *   color:     string   (hex)
 *   bold:      boolean
 *   italic:    boolean
 *   rotation:  number   (degrees)
 *   opacity:   number   (0–1)
 *   selected:  boolean
 * }
 *
 * The hook returns the text objects and mutation functions.
 * Rendering is handled by TextOverlayCanvas (separate component).
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useCallback } from 'react';

let _tid = 0;
const tuid = () => `text_${++_tid}_${Date.now()}`;

export const FONT_FAMILIES = [
  'Arial',
  'Georgia',
  'Impact',
  'Courier New',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS',
];

export function useTextTool() {
  const [textObjects, setTextObjects]   = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [isTextMode, setIsTextMode]     = useState(false);

  // ── Default text properties ────────────────────────────────────
  const [defaultProps, setDefaultProps] = useState({
    fontSize:   28,
    fontFamily: 'Arial',
    color:      '#ffffff',
    bold:       false,
    italic:     false,
    opacity:    1,
  });

  // ── Add text at position ────────────────────────────────────────
  const addText = useCallback((x, y, text = 'Text') => {
    const obj = {
      id:        tuid(),
      text,
      x,
      y,
      rotation:  0,
      selected:  true,
      ...defaultProps,
    };
    setTextObjects((prev) => [
      ...prev.map((t) => ({ ...t, selected: false })),
      obj,
    ]);
    setSelectedId(obj.id);
    return obj.id;
  }, [defaultProps]);

  // ── Update text object by id (partial patch) ────────────────────
  const updateText = useCallback((id, patch) => {
    setTextObjects((prev) =>
      prev.map((t) => t.id === id ? { ...t, ...patch } : t)
    );
  }, []);

  // ── Select a text object ────────────────────────────────────────
  const selectText = useCallback((id) => {
    setSelectedId(id);
    setTextObjects((prev) => prev.map((t) => ({ ...t, selected: t.id === id })));
  }, []);

  // ── Deselect all ────────────────────────────────────────────────
  const deselectAll = useCallback(() => {
    setSelectedId(null);
    setTextObjects((prev) => prev.map((t) => ({ ...t, selected: false })));
  }, []);

  // ── Delete a text object ────────────────────────────────────────
  const deleteText = useCallback((id) => {
    setTextObjects((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((prev) => prev === id ? null : prev);
  }, []);

  // ── Delete selected ─────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    deleteText(selectedId);
  }, [selectedId, deleteText]);

  // ── Move text object ────────────────────────────────────────────
  const moveText = useCallback((id, dx, dy) => {
    setTextObjects((prev) =>
      prev.map((t) => t.id === id ? { ...t, x: t.x + dx, y: t.y + dy } : t)
    );
  }, []);

  // ── Clear all text ──────────────────────────────────────────────
  const clearTextObjects = useCallback(() => {
    setTextObjects([]);
    setSelectedId(null);
  }, []);

  // ── Reset (on new image load) ───────────────────────────────────
  const resetTextTool = useCallback(() => {
    setTextObjects([]);
    setSelectedId(null);
    setIsTextMode(false);
  }, []);

  // ── Get selected object ─────────────────────────────────────────
  const selectedObject = textObjects.find((t) => t.id === selectedId) || null;

  return {
    textObjects,
    selectedId,
    selectedObject,
    isTextMode,
    defaultProps,
    setIsTextMode,
    setDefaultProps,
    addText,
    updateText,
    selectText,
    deselectAll,
    deleteText,
    deleteSelected,
    moveText,
    clearTextObjects,
    resetTextTool,
  };
}