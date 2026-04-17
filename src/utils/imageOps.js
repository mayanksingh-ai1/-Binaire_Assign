/**
 * imageOps.js
 * Utility functions for image operations.
 * Canvas-based image processing helpers.
 */

/**
 * Apply CSS filter string from adjustments object.
 * Used by ImageCanvas for rendering.
 */
export function buildFilterString(adj) {
  const filters = [
    `brightness(${adj.brightness / 100})`,
    `contrast(${adj.contrast / 100})`,
    `saturate(${adj.saturation / 100})`,
    `hue-rotate(${adj.hue}deg)`,
  ];
  if (adj.blur > 0) filters.push(`blur(${adj.blur}px)`);
  if (adj.grayscale) filters.push('grayscale(1)');
  if (adj.sepia) filters.push('sepia(1)');
  return filters.join(' ');
}

/**
 * Apply all adjustments to a canvas element.
 * Returns a new canvas with the result.
 */
export function applyAdjustments(sourceCanvas, adjustments) {
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext('2d');
  ctx.filter = buildFilterString(adjustments);

  const cx = out.width / 2;
  const cy = out.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (adjustments.rotation) {
    ctx.rotate((adjustments.rotation * Math.PI) / 180);
  }
  ctx.scale(adjustments.flipH ? -1 : 1, adjustments.flipV ? -1 : 1);
  ctx.translate(-cx, -cy);
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return out;
}

/**
 * Load a dataUrl into an HTMLImageElement (Promise-based).
 */
export function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Draw an image element to an offscreen canvas and return the canvas.
 */
export function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Get ImageData from a canvas.
 */
export function getImageData(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}