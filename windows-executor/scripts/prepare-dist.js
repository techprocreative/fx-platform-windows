const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function prepareDist() {
  console.log('Preparing dist folder for packaging...');

  // Copy package.json to dist
  const packageJson = require('../package.json');
  await fs.writeJson(path.join(distDir, 'package.json'), packageJson, { spaces: 2 });
  console.log('✓ Copied package.json to dist');

  // Copy index.html to dist if not exists
  const indexHtmlSrc = path.join(distDir, 'index.html');
  if (await fs.pathExists(indexHtmlSrc)) {
    console.log('✓ index.html already in dist');
  }

  console.log('✓ Dist folder ready for packaging');
}

prepareDist().catch(err => {
  console.error('Error preparing dist:', err);
  process.exit(1);
});
