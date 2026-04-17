/**
 * useAutoEnhance.js
 * Analyzes the raw source image pixel data and computes optimal
 * brightness, contrast, saturation adjustments using histogram
 * analysis and contrast stretching.
 *
 * Returns a function: autoEnhance(sourceImageDataUrl) → adjustments patch
 */

/**
 * Build R, G, B histograms (256 bins) from ImageData pixels.
 */
function buildHistograms(pixels) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  for (let i = 0; i < pixels.length; i += 4) {
    r[pixels[i]]++;
    g[pixels[i + 1]]++;
    b[pixels[i + 2]]++;
  }
  return { r, g, b };
}

/**
 * Find the percentile value in a histogram.
 * @param {Uint32Array} hist
 * @param {number} total  — total pixel count
 * @param {number} pct    — percentile 0..1
 */
function histPercentile(hist, total, pct) {
  const target = Math.round(total * pct);
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += hist[i];
    if (cum >= target) return i;
  }
  return 255;
}

/**
 * Compute mean of a histogram.
 */
function histMean(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  return sum / total;
}

/**
 * Compute std-dev of a histogram.
 */
function histStd(hist, total, mean) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += hist[i] * (i - mean) ** 2;
  return Math.sqrt(sum / total);
}

/**
 * Main auto-enhance function.
 * Reads the image into an offscreen canvas, samples pixels, and
 * returns a partial adjustments object to merge into current state.
 *
 * @param {string} dataUrl   — source (unedited) image dataUrl
 * @returns {Promise<Object>} — partial adjustments patch
 */
export function computeAutoEnhance(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Work on a downscaled version for speed (max 400px wide)
      const scale = Math.min(1, 400 / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const total = w * h;

      const { r, g, b } = buildHistograms(data);

      // ── Contrast stretching (find black/white points) ─────────
      const clip = 0.01; // clip 1% on each end
      const rLow  = histPercentile(r, total, clip);
      const rHigh = histPercentile(r, total, 1 - clip);
      const gLow  = histPercentile(g, total, clip);
      const gHigh = histPercentile(g, total, 1 - clip);
      const bLow  = histPercentile(b, total, clip);
      const bHigh = histPercentile(b, total, 1 - clip);

      const avgLow  = (rLow  + gLow  + bLow)  / 3;
      const avgHigh = (rHigh + gHigh + bHigh) / 3;
      const dynRange = avgHigh - avgLow;

      // ── Mean luminance ─────────────────────────────────────────
      const rMean = histMean(r, total);
      const gMean = histMean(g, total);
      const bMean = histMean(b, total);
      const lumMean = 0.2126 * rMean + 0.7152 * gMean + 0.0722 * bMean;

      // ── Std dev (contrast indicator) ────────────────────────────
      const rStd = histStd(r, total, rMean);
      const gStd = histStd(g, total, gMean);
      const bStd = histStd(b, total, bMean);
      const avgStd = (rStd + gStd + bStd) / 3;

      // ── Compute target adjustments ─────────────────────────────

      // Brightness: shift toward mid-tone (128)
      // If mean lum is 80 → image is dark → boost brightness
      const targetLum = 128;
      const brightnessDelta = ((targetLum - lumMean) / 128) * 30; // max ±30
      const newBrightness = Math.round(Math.min(180, Math.max(60, 100 + brightnessDelta)));

      // Contrast: low std-dev → image is flat → boost contrast
      // Normal std-dev is around 50-70 for a well-exposed image
      const targetStd = 60;
      const contrastDelta = ((targetStd - avgStd) / targetStd) * 25; // max ±25
      const newContrast = Math.round(Math.min(180, Math.max(60, 100 + contrastDelta)));

      // Saturation: compute colour spread (max - min across RGB means)
      const maxChannel = Math.max(rMean, gMean, bMean);
      const minChannel = Math.min(rMean, gMean, bMean);
      const colourSpread = maxChannel - minChannel;
      // Very low spread = desaturated image → boost saturation
      const saturationDelta = colourSpread < 15 ? 20 : colourSpread > 40 ? -10 : 0;
      const newSaturation = Math.round(Math.min(180, Math.max(60, 100 + saturationDelta)));

      // Exposure: if dynamic range is compressed, compensate
      // dynRange = distance between 1st and 99th percentile (0–255)
      let newExposure = 0;
      if (avgLow > 40) newExposure = -Math.round((avgLow - 40) / 4); // clip shadows
      if (avgHigh < 220) newExposure = Math.round((220 - avgHigh) / 4); // lift highlights

      resolve({
        brightness:  newBrightness,
        contrast:    newContrast,
        saturation:  newSaturation,
        exposure:    Math.min(40, Math.max(-40, newExposure)),
        // Return histograms for the panel
        _histograms: { r, g, b, total },
      });
    };
    img.onerror = () => reject(new Error('Failed to read image for auto-enhance'));
    img.src = dataUrl;
  });
}

/**
 * Build histogram data suitable for the HistogramPanel canvas renderer.
 * Returns arrays of 256 normalised values (0–1) per channel.
 */
export function buildHistogramData(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const total = w * h;
      const { r, g, b } = buildHistograms(data);

      // Normalise to 0–1 (peak = 1)
      const maxR = Math.max(...r);
      const maxG = Math.max(...g);
      const maxB = Math.max(...b);
      const peak = Math.max(maxR, maxG, maxB) || 1;

      resolve({
        r: Array.from(r).map((v) => v / peak),
        g: Array.from(g).map((v) => v / peak),
        b: Array.from(b).map((v) => v / peak),
        total,
      });
    };
    img.onerror = () => reject(new Error('Histogram build failed'));
    img.src = dataUrl;
  });
}