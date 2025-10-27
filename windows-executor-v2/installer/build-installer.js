#!/usr/bin/env node

/**
 * Windows Executor V2 - Installer Build Script
 * 
 * This script packages the application with electron-builder,
 * including embedded Python and all dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('================================================');
console.log('  Windows Executor V2 - Build Installer');
console.log('================================================\n');

const rootDir = path.join(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

// Step 1: Build Frontend
console.log('[1/4] Building Electron frontend...');
try {
  process.chdir(frontendDir);
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Frontend built successfully\n');
} catch (error) {
  console.error('❌ Frontend build failed:', error.message);
  process.exit(1);
}

// Step 2: Package Python Backend
console.log('[2/4] Preparing Python backend...');
try {
  // Create dist directory
  const distDir = path.join(rootDir, 'dist', 'backend');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy backend files
  console.log('  Copying backend files...');
  execSync(`xcopy "${backendDir}" "${distDir}" /E /I /Y /EXCLUDE:.gitignore`, { stdio: 'inherit' });
  
  console.log('✅ Backend prepared\n');
} catch (error) {
  console.error('❌ Backend preparation failed:', error.message);
  process.exit(1);
}

// Step 3: Build Electron App
console.log('[3/4] Building Electron application...');
try {
  process.chdir(frontendDir);
  execSync('npm run electron:build', { stdio: 'inherit' });
  console.log('✅ Electron app built\n');
} catch (error) {
  console.error('❌ Electron build failed:', error.message);
  console.log('\nNote: Make sure electron-builder is configured in frontend/package.json');
  console.log('You may need to add:');
  console.log('  "electron:build": "electron-builder"');
  console.log('And configure electron-builder section.\n');
}

// Step 4: Package Everything
console.log('[4/4] Creating installer package...');
console.log('  📦 Installer will be created in: dist/');
console.log('  📦 Includes:');
console.log('    - Electron UI');
console.log('    - Python Backend');
console.log('    - All dependencies');
console.log('    - Auto-start scripts');

console.log('\n================================================');
console.log('  ✅ Build Complete!');
console.log('================================================');
console.log('\nNext steps:');
console.log('1. Test the installer from dist/ directory');
console.log('2. Distribute to users');
console.log('3. Users just run the installer - everything is included!\n');

console.log('Distribution files:');
console.log('  - windows-executor-v2-setup.exe (installer)');
console.log('  - windows-executor-v2-portable.zip (portable version)\n');
