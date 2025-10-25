const fs = require('fs-extra');
const path = require('path');

console.log('📦 Post-build: Copying resources to packaged app...');

const baseDir = path.join(__dirname, '..');
const distDir = path.join(baseDir, 'dist/win-unpacked/resources');

try {
  // 1. Copy DLLs
  console.log('\n📚 Copying DLLs...');
  const dllSourceDir = path.join(baseDir, 'resources/libs');
  const dllDestDir = path.join(distDir, 'libs');
  fs.ensureDirSync(dllDestDir);
  
  const dllFiles = ['libzmq.dll', 'libsodium.dll'];
  dllFiles.forEach(file => {
    const src = path.join(dllSourceDir, file);
    const dest = path.join(dllDestDir, file);
    
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      const stats = fs.statSync(dest);
      console.log(`  ✅ ${file} (${Math.round(stats.size/1024)}KB)`);
    } else {
      console.warn(`  ⚠️  ${file} not found`);
    }
  });
  
  // 2. Copy MT5 Expert Advisors
  console.log('\n🤖 Copying MT5 Expert Advisors...');
  const eaSourceDir = path.join(baseDir, 'resources/experts');
  const eaDestDir = path.join(distDir, 'experts');
  fs.ensureDirSync(eaDestDir);
  
  if (fs.existsSync(eaSourceDir)) {
    const eaFiles = fs.readdirSync(eaSourceDir).filter(f => 
      f.endsWith('.mq5') || f.endsWith('.ex5')
    );
    
    eaFiles.forEach(file => {
      const src = path.join(eaSourceDir, file);
      const dest = path.join(eaDestDir, file);
      fs.copyFileSync(src, dest);
      const stats = fs.statSync(dest);
      console.log(`  ✅ ${file} (${Math.round(stats.size/1024)}KB)`);
    });
    
    if (eaFiles.length === 0) {
      console.warn('  ⚠️  No EA files found');
    }
  } else {
    console.warn('  ⚠️  EA source directory not found');
  }
  
  // 3. Copy icons (optional but good to have)
  console.log('\n🎨 Copying icons...');
  const iconSourceDir = path.join(baseDir, 'resources/icons');
  const iconDestDir = path.join(distDir, 'icons');
  
  if (fs.existsSync(iconSourceDir)) {
    fs.ensureDirSync(iconDestDir);
    const iconFiles = fs.readdirSync(iconSourceDir).filter(f => 
      f.endsWith('.ico') || f.endsWith('.png')
    );
    
    iconFiles.forEach(file => {
      const src = path.join(iconSourceDir, file);
      const dest = path.join(iconDestDir, file);
      fs.copyFileSync(src, dest);
      console.log(`  ✅ ${file}`);
    });
  }
  
  console.log('\n✅ All resources copied successfully!');
} catch (error) {
  console.error('\n❌ Failed to copy resources:', error);
  process.exit(1);
}
