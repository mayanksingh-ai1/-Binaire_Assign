/**
 * opencvHDR.js
 * Implements HDR Merge and Tonemapping using OpenCV.js
 */

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export async function mergeHDR(images, hdrAlgo, tonemapAlgo, gamma, saturation, setProgress) {
  return new Promise(async (resolve, reject) => {
    const cv = window.cv;
    const matsToFree = [];

    try {
      if (!cv || !cv.Mat) throw new Error("OpenCV.js not initialized");

      setProgress('Preparing WASM memory...');
      await new Promise(r => setTimeout(r, 100));

      // 1. Check for specific HDR classes
      const MergeClass = hdrAlgo === 'robertson' ? cv.MergeRobertson : cv.MergeDebevec;
      if (!MergeClass) {
        throw new Error("HDR not supported in this OpenCV build. Please use a full build of opencv.js.");
      }

      setProgress('Loading images...');
      
      const times = new cv.Mat(images.length, 1, cv.CV_32FC1);
      matsToFree.push(times);
      
      const matVector = new cv.MatVector();
      matsToFree.push(matVector);

      for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        const loadedImg = await loadImage(imgData.dataUrl);
        const mat = cv.imread(loadedImg);
        
        matVector.push_back(mat);
        matsToFree.push(mat); 

        // Corrected Assignment: floatPtr returns an array-like object in WASM
        times.floatPtr(i, 0) = imgData.exposure;
      }

      // Step 2: Merge HDR
      setProgress(`Merging images...`);
      const hdrDebevec = new cv.Mat();
      matsToFree.push(hdrDebevec);
      
      const response = new cv.Mat();
      matsToFree.push(response);
      
      const merger = new MergeClass();
      merger.process(matVector, hdrDebevec, times, response);
      merger.delete();

      // Step 3: Tonemapping
      setProgress(`Applying ${tonemapAlgo} tonemap...`);
      const ldr = new cv.Mat();
      matsToFree.push(ldr);
      
      const g = parseFloat(gamma) || 1.0;
      const s = parseFloat(saturation) || 1.0;

      let tonemap;
      switch (tonemapAlgo) {
        case 'reinhard':
          tonemap = new cv.TonemapReinhard(g, 0, 0, s);
          break;
        case 'mantiuk':
          tonemap = new cv.TonemapMantiuk(g, 1.0, 1.0, s);
          break;
        case 'drago':
        default:
          tonemap = new cv.TonemapDrago(g, 1.0, s);
          break;
      }

      tonemap.process(hdrDebevec, ldr);
      tonemap.delete();

      // Step 4: Final Conversion
      const finalImg = new cv.Mat();
      matsToFree.push(finalImg);
      
      // Scale from float (0-1) to 8-bit (0-255)
      ldr.convertTo(finalImg, cv.CV_8UC3, 255);
      
      const outCanvas = document.createElement('canvas');
      cv.imshow(outCanvas, finalImg);
      const resultDataUrl = outCanvas.toDataURL('image/png');

      setProgress('Merge Complete!');
      
      matsToFree.forEach(m => { if (m && !m.isDeleted()) m.delete(); });
      resolve(resultDataUrl);

    } catch (error) {
      console.error("HDR Error Detail:", error);
      matsToFree.forEach(m => { if (m && !m.isDeleted()) m.delete(); });
      reject(error);
    }
  });
}