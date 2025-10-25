/**
 * Quick Build Script for Testing
 * Builds and packages without running tests
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('\n=== QUICK BUILD FOR TESTING ===\n');

try {
  // 1. Clean
  console.log('1. Cleaning...');
  fs.removeSync('dist');
  fs.removeSync('dist-app');
  fs.removeSync('app/dist-app');
  console.log('   ✅ Clean complete');

  // 2. Build React
  console.log('\n2. Building React app...');
  execSync('npm run build:react', { stdio: 'inherit' });
  console.log('   ✅ React build complete');

  // 3. Build Electron
  console.log('\n3. Building Electron main...');
  execSync('npm run build:electron', { stdio: 'inherit' });
  console.log('   ✅ Electron build complete');

  // 4. Copy dist-app to app/dist-app for packaging
  console.log('\n4. Copying React build...');
  fs.copySync('dist-app', 'app/dist-app');
  console.log('   ✅ React build copied');

  // 5. Package with electron-builder (unpacked only for speed)
  console.log('\n5. Packaging with electron-builder...');
  execSync('npx electron-builder --win --x64 --dir', { stdio: 'inherit' });
  console.log('   ✅ Package complete');

  // 6. Copy resources
  console.log('\n6. Copying DLLs and Expert Advisors...');
  fs.ensureDirSync('dist/win-unpacked/resources/libs');
  fs.copySync('resources/libs', 'dist/win-unpacked/resources/libs');
  
  fs.ensureDirSync('dist/win-unpacked/resources/experts');
  fs.copySync('resources/experts', 'dist/win-unpacked/resources/experts');
  console.log('   ✅ Resources copied');

  console.log('\n=== BUILD COMPLETE ===');
  console.log('\n✅ Executable ready at: dist/win-unpacked/fx-platform-executor.exe\n');

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
