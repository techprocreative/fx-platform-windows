#!/usr/bin/env node

/**
 * Ensure ZeroMQ native modules are located in the Electron-friendly directory.
 */

const fs = require('fs-extra');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(PROJECT_ROOT, 'node_modules', 'zeromq', 'build');
const TARGET_DIR = path.join(BUILD_ROOT, 'Release');

function log(message) {
  console.log(`[fix-zeromq-path] ${message}`);
}

function findAddonNodes(startDir) {
  if (!fs.existsSync(startDir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const resolved = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAddonNodes(resolved));
    } else if (entry.isFile() && entry.name === 'addon.node') {
      results.push(resolved);
    }
  }

  return results;
}

function ensureTargetDirectory() {
  fs.ensureDirSync(TARGET_DIR);
}

function copyAddon(sourcePath) {
  const targetNode = path.join(TARGET_DIR, 'zeromq.node');
  const targetBackup = path.join(TARGET_DIR, 'addon.node');

  fs.copyFileSync(sourcePath, targetNode);
  fs.copyFileSync(sourcePath, targetBackup);
  log(`Copied native module -> ${targetNode}`);
}

function main() {
  log('Starting ZeroMQ native module path fix');

  if (!fs.existsSync(BUILD_ROOT)) {
    log('ZeroMQ build directory not found. Did you run npm install?');
    process.exit(1);
  }

  ensureTargetDirectory();

  const addonNodes = findAddonNodes(BUILD_ROOT);
  const x64Addon = addonNodes.find((file) => file.includes(path.join('win32', 'x64')));
  const fallbackAddon = addonNodes[0];

  if (!x64Addon && !fallbackAddon) {
    log('No addon.node files found. Run `npm run rebuild:native` first.');
    process.exit(1);
  }

  const selected = x64Addon || fallbackAddon;
  copyAddon(selected);

  log('ZeroMQ native module path fix completed successfully.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    log(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };
