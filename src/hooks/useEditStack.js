/**
 * useEditStack.js
 * ─────────────────────────────────────────────────────────────────
 * Non-destructive editing system.
 *
 * Architecture:
 *   - originalImage  (dataUrl) — NEVER mutated after import
 *   - editStack      — ordered array of edit operations
 *   - Rendering: base image → apply all enabled edits → canvas
 *
 * Each edit entry:
 * {
 *   id:       string   (uuid)
 *   type:     string   ('brightness' | 'contrast' | 'filter' | etc.)
 *   label:    string   (display label)
 *   value:    any      (numeric, boolean, or object)
 *   enabled:  boolean  (toggle without removing)
 * }
 *
 * The hook integrates with the existing adjustments system:
 *   applyEdits(baseDataUrl, editStack) → renders to an offscreen
 *   canvas and resolves with the resulting dataUrl.
 *
 * This is intentionally kept simple and additive — it does NOT replace
 * the current adjustments/history system. Instead it wraps it with
 * proper non-destructive semantics (original always preserved).
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useCallback, useRef } from 'react';

// ─── Edit type registry ──────────────────────────────────────────
// Maps edit.type → CSS filter fragment builder
const FILTER_BUILDERS = {
  brightness:  (v) => `brightness(${v / 100})`,
  contrast:    (v) => `contrast(${v / 100})`,
  saturation:  (v) => `saturate(${v / 100})`,
  hue:         (v) => `hue-rotate(${v}deg)`,
  blur:        (v) => v > 0 ? `blur(${v}px)` : '',
  grayscale:   (v) => v ? 'grayscale(1)' : '',
  sepia:       (v) => v ? 'sepia(1)' : '',
  invert:      (v) => v ? 'invert(1)' : '',
};

// Canvas-level transforms (applied via ctx transforms)
const TRANSFORM_TYPES = new Set(['flipH', 'flipV', 'rotation']);

// ─── Render pipeline ─────────────────────────────────────────────

/**
 * Apply an edit stack to a base image dataUrl.
 * Returns a Promise<string> of the resulting dataUrl.
 *
 * @param {string}  baseDataUrl  — original untouched image dataUrl
 * @param {Array}   editStack    — array of edit entries
 * @returns {Promise<string>}
 */
export function applyEdits(baseDataUrl, editStack) {
  return new Promise((resolve, reject) => {
    if (!baseDataUrl) { reject(new Error('No base image')); return; }

    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx     = canvas.getContext('2d');

      // ── 1. Collect enabled edits ──────────────────────────────
      const enabled = editStack.filter((e) => e.enabled);

      // ── 2. Build CSS filter string ────────────────────────────
      const filterParts = [];
      enabled.forEach((edit) => {
        const builder = FILTER_BUILDERS[edit.type];
        if (builder) {
          const frag = builder(edit.value);
          if (frag) filterParts.push(frag);
        }
      });
      ctx.filter = filterParts.length ? filterParts.join(' ') : 'none';

      // ── 3. Apply canvas transforms ────────────────────────────
      const transforms = {};
      enabled.forEach((edit) => {
        if (TRANSFORM_TYPES.has(edit.type)) transforms[edit.type] = edit.value;
      });

      const cx = img.width  / 2;
      const cy = img.height / 2;
      ctx.save();
      ctx.translate(cx, cy);
      if (transforms.rotation) {
        ctx.rotate((transforms.rotation * Math.PI) / 180);
      }
      ctx.scale(transforms.flipH ? -1 : 1, transforms.flipV ? -1 : 1);
      ctx.translate(-cx, -cy);

      ctx.drawImage(img, 0, 0);
      ctx.restore();

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load base image'));
    img.src = baseDataUrl;
  });
}

// ─── Tiny ID generator ────────────────────────────────────────────
let _id = 0;
function uid() { return `edit_${++_id}_${Date.now()}`; }

// ─── Hook ────────────────────────────────────────────────────────

export function useEditStack() {
  const [originalImage, setOriginalImage] = useState(null); // dataUrl, frozen
  const [editStack, setEditStack]         = useState([]);
  const [isRendering, setIsRendering]     = useState(false);
  const renderTimerRef                    = useRef(null);

  /**
   * Set the base image. Called once per import.
   * Resets edit stack.
   */
  const setBase = useCallback((dataUrl) => {
    setOriginalImage(dataUrl);
    setEditStack([]);
  }, []);

  /**
   * Add a new edit to the top of the stack.
   */
  const addEdit = useCallback((type, value, label) => {
    const entry = {
      id:      uid(),
      type,
      label:   label || type,
      value,
      enabled: true,
    };
    setEditStack((prev) => [...prev, entry]);
    return entry.id;
  }, []);

  /**
   * Update value of an existing edit by id.
   */
  const updateEdit = useCallback((id, value) => {
    setEditStack((prev) => prev.map((e) => e.id === id ? { ...e, value } : e));
  }, []);

  /**
   * Toggle enabled/disabled for a specific edit.
   */
  const toggleEdit = useCallback((id) => {
    setEditStack((prev) => prev.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e));
  }, []);

  /**
   * Remove an edit from the stack by id.
   */
  const removeEdit = useCallback((id) => {
    setEditStack((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /**
   * Reorder edit stack (move item from oldIndex to newIndex).
   */
  const reorderEdit = useCallback((oldIndex, newIndex) => {
    setEditStack((prev) => {
      const next  = [...prev];
      const [item] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, item);
      return next;
    });
  }, []);

  /**
   * Sync the edit stack from current adjustments object.
   * Call this when user adjusts sliders — converts adj → editStack entries.
   */
  const syncFromAdjustments = useCallback((adjustments) => {
    const entries = [
      { type: 'brightness',  value: adjustments.brightness,  label: 'Brightness'  },
      { type: 'contrast',    value: adjustments.contrast,    label: 'Contrast'    },
      { type: 'saturation',  value: adjustments.saturation,  label: 'Saturation'  },
      { type: 'hue',         value: adjustments.hue,         label: 'Hue'         },
      { type: 'blur',        value: adjustments.blur,        label: 'Blur'        },
      { type: 'grayscale',   value: adjustments.grayscale,   label: 'Grayscale'   },
      { type: 'sepia',       value: adjustments.sepia,       label: 'Sepia'       },
      { type: 'flipH',       value: adjustments.flipH,       label: 'Flip H'      },
      { type: 'flipV',       value: adjustments.flipV,       label: 'Flip V'      },
      { type: 'rotation',    value: adjustments.rotation,    label: 'Rotation'    },
    ].map((e) => ({ ...e, id: uid(), enabled: true }));
    setEditStack(entries);
  }, []);

  /**
   * Clear all edits.
   */
  const clearEdits = useCallback(() => setEditStack([]), []);

  /**
   * Render original + edit stack → returns Promise<dataUrl>.
   * Uses the base image if available, otherwise no-ops.
   */
  const render = useCallback((baseOverride) => {
    const base = baseOverride || originalImage;
    if (!base) return Promise.resolve(null);
    return applyEdits(base, editStack);
  }, [originalImage, editStack]);

  return {
    originalImage,
    editStack,
    isRendering,
    setBase,
    addEdit,
    updateEdit,
    toggleEdit,
    removeEdit,
    reorderEdit,
    syncFromAdjustments,
    clearEdits,
    render,
  };
}