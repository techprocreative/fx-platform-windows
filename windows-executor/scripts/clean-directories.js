const path = require('path');
const fs = require('fs/promises');

const targets = [
  '../dist-app',
  '../dist',
  '../dist-build',
  '../dist-electron',
];

async function removeDir(relativePath) {
  const targetPath = path.resolve(__dirname, relativePath);

  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    console.log(`Removed ${targetPath}`);
  } catch (error) {
    if (error.code === 'EBUSY') {
      console.warn(`Skipped ${targetPath} because it is locked (${error.path ?? ''}). Close the packaged app if it is running and rerun if needed.`);
    } else if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

(async () => {
  for (const target of targets) {
    await removeDir(target);
  }
})();
