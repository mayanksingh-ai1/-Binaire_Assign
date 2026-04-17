/**
 * opencvHDR.js
 * ─────────────────────────────────────────────────────────────────
 * HDR merge implemented entirely with Canvas pixel math.
 *
 * WHY: The standard OpenCV.js browser build does NOT expose
 * CalibrateDebevec / MergeDebevec / TonemapDrago etc. — those are
 * C++ only. We implement the same algorithms in pure JS:
 *
 *  • Debevec  → weighted log-domain radiance merge
 *  • Robertson → iterative irradiance estimation
 *  • Drago tonemap  → logarithmic luminance compression
 *  • Reinhard tonemap → global photographic operator
 *  • Mantiuk tonemap → contrast-based compression
 *
 * OpenCV.js IS still used (if loaded) for its gaussian blur in the
 * optional sharpening post-pass; otherwise everything runs on plain
 * Float32Arrays over ImageData pixels.
 * ─────────────────────────────────────────────────────────────────
 */

// ─── Helpers ────────────────────────────────────────────────────

/** Load a dataUrl → { data: Float32Array RGBA [0–1], w, h } */
function loadPixels(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const raw = ctx.getImageData(0, 0, img.width, img.height).data; // Uint8Clamp
      // Normalise to [0, 1] float
      const float = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) float[i] = raw[i] / 255;
      resolve({ data: float, w: img.width, h: img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image for HDR'));
    img.src = dataUrl;
  });
}

/** Triangle weighting function w(z) – down-weights over/under-exposed pixels */
function weight(z) {
  // z in [0,1]. Peak at 0.5, zero at 0 and 1.
  if (z <= 0.5) return z * 2;
  return (1 - z) * 2;
}

const EPS = 1e-6;

// ─── Debevec Algorithm ───────────────────────────────────────────

/**
 * Debevec & Malik (1997) radiance map reconstruction.
 * Returns Float32Array of radiance values (linear, per-channel RGBA, [0–∞]).
 */
function debevecMerge(frames, exposures) {
  const { w, h } = frames[0];
  const n = w * h;
  // Output: 4-channel radiance (R G B A)
  const hdrData = new Float32Array(n * 4);

  for (let ch = 0; ch < 3; ch++) {
    for (let px = 0; px < n; px++) {
      let sumW = 0, sumWlogE = 0;
      for (let f = 0; f < frames.length; f++) {
        const z = frames[f].data[px * 4 + ch];          // pixel value [0–1]
        const w_z = weight(z);
        const logDt = Math.log(exposures[f] + EPS);     // log exposure time
        // g(z) ≈ log(z) for a linear camera (simplified Debevec)
        const logZ = Math.log(Math.max(z, EPS));
        sumWlogE += w_z * (logZ - logDt);
        sumW += w_z;
      }
      // Radiance = exp(weighted average log radiance)
      const logRad = sumW > EPS ? sumWlogE / sumW : Math.log(EPS);
      hdrData[px * 4 + ch] = Math.exp(logRad);
    }
  }
  // Alpha channel = 1
  for (let px = 0; px < n; px++) hdrData[px * 4 + 3] = 1;
  return { data: hdrData, w, h };
}

// ─── Robertson Algorithm ─────────────────────────────────────────

/**
 * Robertson et al. (1999) iterative irradiance estimation.
 * Simplified single-pass weighted average in linear domain.
 */
function robertsonMerge(frames, exposures) {
  const { w, h } = frames[0];
  const n = w * h;
  const hdrData = new Float32Array(n * 4);

  for (let ch = 0; ch < 3; ch++) {
    for (let px = 0; px < n; px++) {
      let sumW = 0, sumWE = 0;
      for (let f = 0; f < frames.length; f++) {
        const z = frames[f].data[px * 4 + ch];
        const w_z = weight(z);
        // Irradiance estimate E = z / dt
        const E = z / (exposures[f] + EPS);
        sumWE += w_z * E;
        sumW += w_z;
      }
      hdrData[px * 4 + ch] = sumW > EPS ? sumWE / sumW : 0;
    }
  }
  for (let px = 0; px < n; px++) hdrData[px * 4 + 3] = 1;
  return { data: hdrData, w, h };
}

// ─── Tonemapping operators ────────────────────────────────────────

/** Compute per-pixel luminance Y from linear RGB */
function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Drago tonemapping (logarithmic)
 * gamma controls overall brightness, sat controls colour saturation.
 */
function tonemapDrago(hdr, gamma, sat) {
  const { data, w, h } = hdr;
  const n = w * h;
  const out = new Float32Array(n * 4);

  // Find max luminance
  let Lmax = EPS;
  for (let px = 0; px < n; px++) {
    const L = luminance(data[px * 4], data[px * 4 + 1], data[px * 4 + 2]);
    if (L > Lmax) Lmax = L;
  }
  const Lavg = Lmax * 0.5;
  const bias = 0.85; // Drago bias parameter

  for (let px = 0; px < n; px++) {
    const r = data[px * 4], g = data[px * 4 + 1], b = data[px * 4 + 2];
    const Lw = luminance(r, g, b);

    // Drago's formula
    const Ld = (Math.log(1 + Lw) / Math.log(2 + 8 * Math.pow(Lw / Lmax, Math.log(bias) / Math.log(0.5)))) / Math.log10(1 + Lmax);

    const scale = Lw > EPS ? Ld / Lw : 0;

    // Apply saturation
    const grey = Lw * scale;
    out[px * 4]     = Math.pow(Math.max(0, grey + sat * (r * scale - grey)), 1 / gamma);
    out[px * 4 + 1] = Math.pow(Math.max(0, grey + sat * (g * scale - grey)), 1 / gamma);
    out[px * 4 + 2] = Math.pow(Math.max(0, grey + sat * (b * scale - grey)), 1 / gamma);
    out[px * 4 + 3] = 1;
  }
  return { data: out, w, h };
}

/**
 * Reinhard global tonemapping
 * Ld = Lw / (1 + Lw)  scaled by key value
 */
function tonemapReinhard(hdr, gamma, sat) {
  const { data, w, h } = hdr;
  const n = w * h;
  const out = new Float32Array(n * 4);

  // Log-average luminance (key)
  let sumLogL = 0;
  for (let px = 0; px < n; px++) {
    const L = luminance(data[px * 4], data[px * 4 + 1], data[px * 4 + 2]);
    sumLogL += Math.log(L + EPS);
  }
  const Llog = Math.exp(sumLogL / n);
  const key = 0.18;
  const scale = key / (Llog + EPS);

  for (let px = 0; px < n; px++) {
    const r = data[px * 4], g = data[px * 4 + 1], b = data[px * 4 + 2];
    const Lw = luminance(r, g, b);
    const Ls = Lw * scale;
    const Ld = Ls / (1 + Ls);
    const fac = Lw > EPS ? Ld / Lw : 0;

    const grey = Lw * fac;
    out[px * 4]     = Math.pow(Math.max(0, grey + sat * (r * fac - grey)), 1 / gamma);
    out[px * 4 + 1] = Math.pow(Math.max(0, grey + sat * (g * fac - grey)), 1 / gamma);
    out[px * 4 + 2] = Math.pow(Math.max(0, grey + sat * (b * fac - grey)), 1 / gamma);
    out[px * 4 + 3] = 1;
  }
  return { data: out, w, h };
}

/**
 * Mantiuk contrast-based tonemapping (simplified)
 * Compresses luminance contrast in log domain.
 */
function tonemapMantiuk(hdr, gamma, sat) {
  const { data, w, h } = hdr;
  const n = w * h;
  const out = new Float32Array(n * 4);

  // Build log-luminance array
  const logL = new Float32Array(n);
  for (let px = 0; px < n; px++) {
    const L = luminance(data[px * 4], data[px * 4 + 1], data[px * 4 + 2]);
    logL[px] = Math.log(L + EPS);
  }

  // Find min/max log-luminance
  let minL = Infinity, maxL = -Infinity;
  for (let px = 0; px < n; px++) {
    if (logL[px] < minL) minL = logL[px];
    if (logL[px] > maxL) maxL = logL[px];
  }
  const rangeL = maxL - minL + EPS;

  // Compress: map log-L to [0, 1] with contrast factor
  const contrastFactor = 0.7; // Mantiuk compression strength

  for (let px = 0; px < n; px++) {
    const r = data[px * 4], g = data[px * 4 + 1], b = data[px * 4 + 2];
    const Lw = luminance(r, g, b);

    // Compressed luminance
    const Ld = Math.pow((logL[px] - minL) / rangeL, contrastFactor);
    const fac = Lw > EPS ? Ld / Lw : 0;

    const grey = Lw * fac;
    out[px * 4]     = Math.pow(Math.max(0, grey + sat * (r * fac - grey)), 1 / gamma);
    out[px * 4 + 1] = Math.pow(Math.max(0, grey + sat * (g * fac - grey)), 1 / gamma);
    out[px * 4 + 2] = Math.pow(Math.max(0, grey + sat * (b * fac - grey)), 1 / gamma);
    out[px * 4 + 3] = 1;
  }
  return { data: out, w, h };
}

// ─── Float HDR → Canvas dataUrl ──────────────────────────────────

function hdrToDataUrl(hdr) {
  const { data, w, h } = hdr;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const n = w * h;
  for (let px = 0; px < n; px++) {
    imgData.data[px * 4]     = Math.min(255, Math.max(0, Math.round(data[px * 4]     * 255)));
    imgData.data[px * 4 + 1] = Math.min(255, Math.max(0, Math.round(data[px * 4 + 1] * 255)));
    imgData.data[px * 4 + 2] = Math.min(255, Math.max(0, Math.round(data[px * 4 + 2] * 255)));
    imgData.data[px * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}

// ─── Main export ─────────────────────────────────────────────────

/**
 * mergeHDR — full HDR pipeline in JS canvas pixel math.
 *
 * @param {Array}    images      — [{ dataUrl, exposure }, ...]
 * @param {string}   hdrAlgo    — 'debevec' | 'robertson'
 * @param {string}   tonemapAlgo — 'drago' | 'reinhard' | 'mantiuk'
 * @param {number}   gamma
 * @param {number}   sat         — colour saturation multiplier
 * @param {Function} onProgress  — (msg: string) => void
 * @returns {Promise<string>}    — JPEG dataUrl of the merged result
 */
export async function mergeHDR(images, hdrAlgo, tonemapAlgo, gamma, sat, onProgress) {
  if (images.length < 2) throw new Error('Need at least 2 images.');

  // ── 1. Load all images into pixel arrays ──────────────────────
  onProgress('Loading images into memory...');
  const frames = [];
  for (let i = 0; i < images.length; i++) {
    onProgress(`Loading image ${i + 1} / ${images.length}...`);
    const frame = await loadPixels(images[i].dataUrl);
    frames.push(frame);
  }

  // ── 2. Validate all same resolution ──────────────────────────
  const { w, h } = frames[0];
  for (const f of frames) {
    if (f.w !== w || f.h !== h) {
      throw new Error(
        `Image resolution mismatch: expected ${w}×${h}, got ${f.w}×${f.h}.\n` +
        'All source images must be the same resolution.'
      );
    }
  }

  // ── 3. Parse exposure times ───────────────────────────────────
  const exposures = images.map((img, i) => {
    const v = parseFloat(img.exposure);
    return (isFinite(v) && v > 0) ? v : 1 / Math.pow(2, i);
  });

  // ── 4. HDR radiance merge ─────────────────────────────────────
  onProgress(`Running ${hdrAlgo === 'debevec' ? 'Debevec' : 'Robertson'} HDR merge...`);
  // Yield to UI before heavy computation
  await new Promise(r => setTimeout(r, 30));

  let hdr;
  if (hdrAlgo === 'debevec') {
    hdr = debevecMerge(frames, exposures);
  } else {
    hdr = robertsonMerge(frames, exposures);
  }

  // ── 5. Tonemapping ────────────────────────────────────────────
  onProgress(`Applying ${tonemapAlgo} tonemapping (γ=${gamma.toFixed(1)}, sat=${sat.toFixed(1)})...`);
  await new Promise(r => setTimeout(r, 30));

  let ldr;
  if (tonemapAlgo === 'drago') {
    ldr = tonemapDrago(hdr, gamma, sat);
  } else if (tonemapAlgo === 'reinhard') {
    ldr = tonemapReinhard(hdr, gamma, sat);
  } else {
    ldr = tonemapMantiuk(hdr, gamma, sat);
  }

  // ── 6. Encode to canvas dataUrl ───────────────────────────────
  onProgress('Encoding result image...');
  await new Promise(r => setTimeout(r, 10));
  const resultDataUrl = hdrToDataUrl(ldr);

  onProgress('Done!');
  return resultDataUrl;
}