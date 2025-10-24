const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function flattenDist() {
  console.log('Flattening dist structure for packaging...');

  // Copy dist contents to project root for electron-builder
  // electron-builder will pick files from root
  
  // Copy main.js, preload.js, auto-installer.js from dist/electron/electron/ to root
  const electronSubDir = path.join(distDir, 'electron', 'electron');
  if (await fs.pathExists(electronSubDir)) {
    const jsFiles = ['main.js', 'preload.js', 'auto-installer.js'];
    for (const file of jsFiles) {
      const src = path.join(electronSubDir, file);
      if (await fs.pathExists(src)) {
        const dest = path.join(rootDir, file);
        
        // For main.js, fix the require paths from ../src to ./src
        if (file === 'main.js') {
          let content = await fs.readFile(src, 'utf8');
          content = content.replace(/require\(["']\.\.\/src\//g, 'require("./src/');
          await fs.writeFile(dest, content, 'utf8');
          console.log(`✓ Copied and fixed paths in ${file}`);
        } else {
          await fs.copy(src, dest, { overwrite: true });
          console.log(`✓ Copied ${file} to project root`);
        }
      }
    }
  }

  // Copy dist/electron/src to root/src (maintain structure for imports)
  const srcDir = path.join(distDir, 'electron', 'src');
  if (await fs.pathExists(srcDir)) {
    const destSrcDir = path.join(rootDir, 'src');
    await fs.copy(srcDir, destSrcDir, { overwrite: true });
    console.log('✓ Copied src to project root/src');
  }

  // Copy assets to root
  const assetsDir = path.join(distDir, 'assets');
  if (await fs.pathExists(assetsDir)) {
    const destAssetsDir = path.join(rootDir, 'assets');
    await fs.copy(assetsDir, destAssetsDir, { overwrite: true });
    console.log('✓ Copied assets to project root');
  }

  // Copy index.html to root
  const indexHtml = path.join(distDir, 'index.html');
  if (await fs.pathExists(indexHtml)) {
    await fs.copy(indexHtml, path.join(rootDir, 'index.html'), { overwrite: true });
    console.log('✓ Copied index.html to project root');
  }

  console.log('✓ Files copied to project root for packaging');
}

flattenDist().catch(err => {
  console.error('Error flattening dist:', err);
  process.exit(1);
});
