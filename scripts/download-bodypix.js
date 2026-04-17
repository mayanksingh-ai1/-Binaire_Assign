/**
 * scripts/download-bodypix.js
 * ─────────────────────────────────────────────────────────────────
 * Downloads BodyPix model files to public/models/bodypix/
 * Run once before building:
 *
 *   node scripts/download-bodypix.js
 *
 * Files downloaded (~4MB total):
 *   model-stride16.json
 *   group1-shard1of2.bin
 *   group1-shard2of2.bin
 * ─────────────────────────────────────────────────────────────────
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE_URL  = 'https://storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/float/075';
const OUT_DIR   = path.join(__dirname, '..', 'public', 'models', 'bodypix');

const FILES = [
  'model-stride16.json',
  'group1-shard1of2.bin',
  'group1-shard2of2.bin',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already exists: ${path.basename(dest)}`);
      return resolve();
    }

    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = (fs.statSync(dest).size / 1024).toFixed(1);
        console.log(`  ↓ ${path.basename(dest)} (${size} KB)`);
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n📦 ImageForge — BodyPix Model Downloader');
  console.log(`   Output: ${OUT_DIR}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    await download(`${BASE_URL}/${file}`, path.join(OUT_DIR, file));
  }

  console.log('\n✅ Model files ready. App will load them offline.\n');
}

main().catch((err) => {
  console.error('\n❌ Download failed:', err.message);
  console.error('   Check your internet connection and try again.\n');
  process.exit(1);
});