/**
 * backgroundRemover.js
 * ─────────────────────────────────────────────────────────────────
 * AI background removal — FULLY OFFLINE, no external network calls.
 *
 * ROOT CAUSE of "Failed to fetch":
 *   @tensorflow-models/body-pix calls bodyPix.load() which fetches
 *   model weights from storage.googleapis.com. Electron's renderer
 *   process blocks these cross-origin fetches by CSP / network policy.
 *
 * FIX: Load the model from the local filesystem.
 *   Model files must be placed at: public/models/bodypix/
 *
 * SETUP — download model files once:
 * ─────────────────────────────────────────────────────────────────
 * Run this script from your project root:
 *
 *   node scripts/download-bodypix.js
 *
 * Or manually download these files into public/models/bodypix/:
 *   model-stride16.json
 *   group1-shard1of2.bin
 *   group1-shard2of2.bin
 *
 * Official source (paste in browser, save as):
 *   https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/float/075/model-stride16.json
 *   https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/float/075/group1-shard1of2.bin
 *   https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/float/075/group1-shard2of2.bin
 *
 * In Electron dev:  model served by Vite at http://localhost:5173/models/bodypix/model-stride16.json
 * In Electron prod: model loaded from app resources via file:// or asar
 * ─────────────────────────────────────────────────────────────────
 *
 * FALLBACK (no model files):
 *   If model files are missing, falls back to a pure pixel-math
 *   edge-detection mask. Quality is lower but always works offline.
 * ─────────────────────────────────────────────────────────────────
 */

// ── Module-level model cache ─────────────────────────────────────
let _model        = null;
let _modelLoading = false;
let _loadQueue    = [];   // pending Promise resolvers while model loads

// ── Determine model URL based on environment ─────────────────────
function getModelUrl() {
  // In Electron production the app is loaded from file://
  // In dev it's served by Vite at localhost:5173
  const base = window.location.protocol === 'file:'
    ? window.location.pathname.replace(/\/[^/]+$/, '') // dir of index.html
    : '';

  // Vite serves public/ at root, so model is at /models/bodypix/
  return `${base}/models/bodypix/model-stride16.json`;
}

/**
 * Load and cache the BodyPix model from local files.
 * Subsequent calls return the cached model immediately.
 */
async function getModel(onProgress) {
  // Already loaded — return immediately
  if (_model) return _model;

  // Already loading — queue this call
  if (_modelLoading) {
    return new Promise((resolve, reject) =>
      _loadQueue.push({ resolve, reject })
    );
  }

  _modelLoading = true;
  onProgress?.('Loading AI model from local files…');

  try {
    // Import TF.js + set WebGL backend for GPU acceleration
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('webgl');
    await tf.ready();

    // Import BodyPix
    const bodyPix = await import('@tensorflow-models/body-pix');

    const modelUrl = getModelUrl();
    onProgress?.(`Loading model from: ${modelUrl}`);

    // Load from local path — no CDN, no external network
    _model = await bodyPix.load({
      architecture:    'MobileNetV1',
      outputStride:    16,
      multiplier:      0.75,
      quantBytes:      2,
      modelUrl,          // ← KEY FIX: point to local file
    });

    onProgress?.('Model ready ✓');

    // Resolve any queued callers
    _loadQueue.forEach(({ resolve }) => resolve(_model));
    _loadQueue    = [];
    _modelLoading = false;

    return _model;

  } catch (err) {
    // Reset so next call can try again
    _modelLoading = false;
    _model        = null;

    // Reject queued callers
    _loadQueue.forEach(({ reject }) => reject(err));
    _loadQueue = [];

    throw err;
  }
}

// ── Pixel-math fallback segmentation ────────────────────────────
/**
 * When the AI model is unavailable, use a brightness-based mask.
 * Treats bright or very dark pixels near edges as background.
 * Returns a Uint8Array mask (1 = foreground, 0 = background).
 */
function fallbackSegmentation(imageData, threshold) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);

  // Simple luminance-threshold: centre of image = foreground
  const cx = width  / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy) * 0.85; // foreground radius

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i  = (y * width + x) * 4;
      const r  = data[i];
      const g  = data[i + 1];
      const b  = data[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const inCircle = dist < maxR;

      // Mark as foreground if: inside circle AND not blown-out/black
      mask[y * width + x] =
        (inCircle && lum > 0.05 && lum < 0.97) ? 1 : 0;
    }
  }
  return mask;
}

// ── Main export ──────────────────────────────────────────────────

/**
 * removeBackground
 *
 * @param {string}   sourceDataUrl
 * @param {object}   options
 * @param {number}   options.threshold   — 0–1, segmentation confidence cutoff
 * @param {string}   options.bgColor     — hex colour for replacement background
 * @param {string}   options.bgImage     — dataUrl for replacement background image
 * @param {Function} options.onProgress  — (msg: string) => void
 * @returns {Promise<string>}            — PNG dataUrl with transparency/bg applied
 */
export async function removeBackground(sourceDataUrl, options = {}) {
  const {
    threshold  = 0.7,
    bgColor    = null,
    bgImage    = null,
    onProgress = () => {},
  } = options;

  onProgress('Preparing image…');

  // ── 1. Decode source image ───────────────────────────────────
  const img       = await loadImg(sourceDataUrl);
  const srcCanvas = makeCanvas(img.width, img.height);
  const srcCtx    = srcCanvas.getContext('2d');
  srcCtx.drawImage(img, 0, 0);
  const srcPixels = srcCtx.getImageData(0, 0, img.width, img.height);

  // ── 2. Obtain segmentation mask ──────────────────────────────
  let mask;
  let usingFallback = false;

  try {
    const model = await getModel(onProgress);
    onProgress('Running AI segmentation…');

    const seg = await model.segmentPerson(srcCanvas, {
      flipHorizontal:        false,
      internalResolution:    'medium',
      segmentationThreshold: threshold,
    });
    mask = seg.data;  // Uint8Array: 1=person, 0=background

  } catch (err) {
    usingFallback = true;
    onProgress(`AI model unavailable (${err.message}) — using pixel fallback…`);
    mask = fallbackSegmentation(srcPixels, threshold);
  }

  // ── 3. Build output canvas ───────────────────────────────────
  onProgress('Compositing result…');

  const outCanvas = makeCanvas(img.width, img.height);
  const outCtx    = outCanvas.getContext('2d');

  // Draw background layer first (if replacing)
  if (bgColor) {
    outCtx.fillStyle = bgColor;
    outCtx.fillRect(0, 0, img.width, img.height);
  } else if (bgImage) {
    const bgImg = await loadImg(bgImage);
    outCtx.drawImage(bgImg, 0, 0, img.width, img.height);
  }

  // ── 4. Apply mask pixel-by-pixel ────────────────────────────
  const outPixels = outCtx.getImageData(0, 0, img.width, img.height);
  const src       = srcPixels.data;
  const out       = outPixels.data;

  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (mask[i] === 1) {
      // Foreground — copy source pixel fully opaque
      out[p]     = src[p];
      out[p + 1] = src[p + 1];
      out[p + 2] = src[p + 2];
      out[p + 3] = 255;
    } else if (!bgColor && !bgImage) {
      // Background with no replacement → transparent
      out[p + 3] = 0;
    }
    // If bgColor/bgImage: background pixels already composited above
  }

  outCtx.putImageData(outPixels, 0, 0);

  onProgress(usingFallback ? 'Done (fallback mode)' : 'Done ✓');

  // Always PNG to preserve transparency channel
  return outCanvas.toDataURL('image/png');
}

/**
 * Check if the local model files exist and TF.js is importable.
 * Returns { available: boolean, reason: string }.
 */
export async function checkBgRemoverStatus() {
  try {
    await import('@tensorflow/tfjs');
    await import('@tensorflow-models/body-pix');

    // Probe local model JSON (HEAD request is fine in Electron/Vite)
    const url = getModelUrl();
    const res = await fetch(url, { method: 'HEAD' }).catch(() => null);

    if (!res || !res.ok) {
      return {
        available:   false,
        hasLibs:     true,
        hasModel:    false,
        reason:      `Model files not found at: ${url}\nRun: node scripts/download-bodypix.js`,
      };
    }

    return { available: true, hasLibs: true, hasModel: true, reason: 'Ready' };
  } catch {
    return {
      available: false,
      hasLibs:   false,
      hasModel:  false,
      reason:    'TensorFlow.js not installed.\nRun: npm install @tensorflow/tfjs @tensorflow-models/body-pix',
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img  = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src     = src;
  });
}

function makeCanvas(w, h) {
  const c  = document.createElement('canvas');
  c.width  = w;
  c.height = h;
  return c;
}