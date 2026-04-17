/**
 * obfuscate.js
 * Post-build script: obfuscates all JS files in dist/
 * excluding node_modules.
 * Run: node obfuscate.js
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
};

function getAllJsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function obfuscateAll() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/ folder not found. Run `vite build` first.');
    process.exit(1);
  }

  const jsFiles = getAllJsFiles(DIST_DIR);
  console.log(`🔐 Obfuscating ${jsFiles.length} JS files in dist/...\n`);

  let success = 0;
  let skipped = 0;

  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      // Skip very small files and sourcemaps
      if (code.length < 50) { skipped++; continue; }

      const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
      fs.writeFileSync(file, result.getObfuscatedCode(), 'utf8');
      console.log(`  ✅ ${path.relative(DIST_DIR, file)}`);
      success++;
    } catch (err) {
      console.warn(`  ⚠️  Skipped ${path.relative(DIST_DIR, file)}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n🎉 Done! ${success} obfuscated, ${skipped} skipped.`);
}

obfuscateAll();