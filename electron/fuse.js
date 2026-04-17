/**
 * electron/fuse.js
 * Run AFTER electron-builder packages the app.
 * Applies electron-fuse to fuse the ASAR archive.
 * Usage: node electron/fuse.js
 */

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, '..', 'dist-electron');

// Find the electron executable inside win-unpacked
function findElectronExe() {
  const unpacked = path.join(DIST, 'win-unpacked');
  if (!fs.existsSync(unpacked)) {
    console.error('❌ win-unpacked folder not found. Run electron-builder first.');
    process.exit(1);
  }
  const exe = fs.readdirSync(unpacked).find((f) => f.endsWith('.exe'));
  if (!exe) {
    console.error('❌ No .exe found in win-unpacked.');
    process.exit(1);
  }
  return path.join(unpacked, exe);
}

async function main() {
  const exePath = findElectronExe();
  console.log(`🔒 Fusing: ${exePath}`);

  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,          // disable NODE_OPTIONS overrides
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,  // enforce ASAR-only loading
  });

  console.log('✅ Electron fuses applied successfully!');
}

main().catch((err) => {
  console.error('Fuse error:', err);
  process.exit(1);
});