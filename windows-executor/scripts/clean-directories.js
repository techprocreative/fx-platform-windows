const path = require('path');
const fs = require('fs/promises');
const { execSync } = require('child_process');

const targets = [
  '../dist-app',
  '../dist',
  '../dist-build',
  '../dist-electron',
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function forceRemoveWindows(targetPath) {
  try {
    // Try using Windows rmdir with force flag
    execSync(`rmdir /s /q "${targetPath}"`, { 
      stdio: 'ignore',
      windowsHide: true 
    });
    console.log(`Force removed ${targetPath} using Windows command`);
    return true;
  } catch (error) {
    return false;
  }
}

async function renameToOld(targetPath) {
  try {
    const timestamp = new Date().getTime();
    const oldPath = `${targetPath}_locked_${timestamp}`;
    await fs.rename(targetPath, oldPath);
    console.log(`⚠️  Renamed locked directory ${targetPath} to ${oldPath}`);
    console.log(`   You can manually delete it later when the lock is released.`);
    return true;
  } catch (error) {
    return false;
  }
}

async function removeDirWithRetry(relativePath, maxRetries = 3, delayMs = 1000) {
  const targetPath = path.resolve(__dirname, relativePath);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // First check if directory exists
      try {
        await fs.access(targetPath);
      } catch {
        // Directory doesn't exist, nothing to remove
        return;
      }

      // Try normal deletion
      await fs.rm(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      console.log(`Removed ${targetPath}`);
      return;
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY') {
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt}/${maxRetries} failed for ${targetPath}, retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          
          // On last retry, try Windows force delete
          if (attempt === maxRetries - 1 && process.platform === 'win32') {
            console.log(`Trying Windows force delete for ${targetPath}...`);
            const success = await forceRemoveWindows(targetPath);
            if (success) {
              return;
            }
          }
        } else {
          // Last resort: try to rename the directory
          console.log(`Attempting to rename locked directory...`);
          const renamed = await renameToOld(targetPath);
          if (!renamed) {
            console.warn(`⚠️  Failed to remove ${targetPath} after ${maxRetries} attempts.`);
            console.warn(`   Locked file: ${error.path || 'unknown'}`);
            console.warn(`   Please close all applications using files in this directory and run clean again.`);
            console.warn(`   Or manually delete the directory and retry.`);
          }
        }
      } else if (error.code !== 'ENOENT') {
        // For other errors, log but continue
        console.error(`Error removing ${targetPath}:`, error.message);
      }
    }
  }
}

async function killRelatedProcesses() {
  if (process.platform !== 'win32') return;
  
  try {
    // Kill any remaining electron processes for this project
    execSync('taskkill /F /IM "FX Platform Executor.exe" /T 2>nul', { 
      stdio: 'ignore',
      windowsHide: true 
    });
    console.log('Killed FX Platform Executor processes');
  } catch {
    // Process not found or already killed
  }
  
  try {
    execSync('taskkill /F /IM "electron.exe" /T 2>nul', { 
      stdio: 'ignore',
      windowsHide: true 
    });
    console.log('Killed electron processes');
  } catch {
    // Process not found
  }
  
  // Wait a bit for processes to fully terminate
  await sleep(500);
}

(async () => {
  console.log('Starting cleanup process...');
  
  // First, try to kill any related processes
  await killRelatedProcesses();
  
  // Then remove directories
  for (const target of targets) {
    await removeDirWithRetry(target);
  }
  
  console.log('Cleanup complete!');
})();
