/**
 * After Pack Script for Electron Builder
 * Ensures all required resources are properly bundled in the installer
 */

const path = require('path');
const fs = require('fs-extra');

module.exports = async function (context) {
  const { appOutDir, packager, electronPlatformName } = context;

  console.log('\n========================================');
  console.log('Running afterPack script...');
  console.log('========================================\n');

  console.log(`Platform: ${electronPlatformName}`);
  console.log(`Output directory: ${appOutDir}`);

  if (electronPlatformName !== 'win32') {
    console.log('Not Windows platform, skipping Windows-specific bundling');
    return;
  }

  try {
    // Define resources directory in the output
    const resourcesDir = path.join(appOutDir, 'resources');
    const appResourcesDir = path.join(resourcesDir, 'resources');

    console.log('\n1. Checking resources directory...');
    console.log(`Resources directory: ${appResourcesDir}`);

    if (!fs.existsSync(appResourcesDir)) {
      console.log('⚠️  Resources directory not found, creating...');
      fs.ensureDirSync(appResourcesDir);
    }

    // Ensure libs directory exists
    const libsDir = path.join(appResourcesDir, 'libs');
    if (!fs.existsSync(libsDir)) {
      console.log('Creating libs directory...');
      fs.ensureDirSync(libsDir);
    }

    // Check for libzmq DLLs
    console.log('\n2. Checking LibZMQ DLLs...');
    const libzmqX64 = path.join(libsDir, 'libzmq-x64.dll');
    const libzmqX86 = path.join(libsDir, 'libzmq-x86.dll');

    if (fs.existsSync(libzmqX64)) {
      const stats = fs.statSync(libzmqX64);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✓ libzmq-x64.dll found (${sizeMB} MB)`);
    } else {
      console.log('⚠️  libzmq-x64.dll not found!');
      // Copy from source if exists
      const sourceDll = path.join(process.cwd(), 'resources', 'libs', 'libzmq-x64.dll');
      if (fs.existsSync(sourceDll)) {
        console.log('   Copying from source...');
        fs.copyFileSync(sourceDll, libzmqX64);
        console.log('   ✓ Copied successfully');
      }
    }

    if (fs.existsSync(libzmqX86)) {
      const stats = fs.statSync(libzmqX86);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✓ libzmq-x86.dll found (${sizeMB} MB)`);
    } else {
      console.log('⚠️  libzmq-x86.dll not found (optional)');
    }

    // Check for MT5 Expert Advisors
    console.log('\n3. Checking MT5 Expert Advisors...');
    const expertsDir = path.join(appResourcesDir, 'experts');
    if (!fs.existsSync(expertsDir)) {
      console.log('Creating experts directory...');
      fs.ensureDirSync(expertsDir);
    }

    // Copy EA files from source
    const sourceExpertsDir = path.join(process.cwd(), 'resources', 'experts');
    if (fs.existsSync(sourceExpertsDir)) {
      const eaFiles = fs.readdirSync(sourceExpertsDir);
      console.log(`Found ${eaFiles.length} file(s) in source experts directory`);

      eaFiles.forEach(file => {
        const sourcePath = path.join(sourceExpertsDir, file);
        const destPath = path.join(expertsDir, file);

        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`✓ Copied: ${file}`);
        }
      });
    } else {
      console.log('⚠️  Source experts directory not found');
    }

    // Check for icons
    console.log('\n4. Checking icons...');
    const iconsDir = path.join(appResourcesDir, 'icons');
    if (!fs.existsSync(iconsDir)) {
      console.log('Creating icons directory...');
      fs.ensureDirSync(iconsDir);
    }

    const sourceIconsDir = path.join(process.cwd(), 'resources', 'icons');
    if (fs.existsSync(sourceIconsDir)) {
      const iconFiles = fs.readdirSync(sourceIconsDir);
      console.log(`Found ${iconFiles.length} icon file(s)`);

      iconFiles.forEach(file => {
        const sourcePath = path.join(sourceIconsDir, file);
        const destPath = path.join(iconsDir, file);

        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`✓ Copied: ${file}`);
        }
      });
    }

    // Check ZeroMQ native modules
    console.log('\n5. Checking ZeroMQ native modules...');
    const zeromqBuildDir = path.join(resourcesDir, 'zeromq-build');
    if (fs.existsSync(zeromqBuildDir)) {
      console.log(`✓ ZeroMQ build directory found: ${zeromqBuildDir}`);

      // Count .node files
      const nodeFiles = [];
      const walkSync = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkSync(filePath);
          } else if (file.endsWith('.node')) {
            nodeFiles.push(filePath);
          }
        });
      };
      walkSync(zeromqBuildDir);
      console.log(`   Found ${nodeFiles.length} .node file(s)`);
    } else {
      console.log('⚠️  ZeroMQ build directory not found');
    }

    // Check better-sqlite3
    console.log('\n6. Checking better-sqlite3...');
    const sqliteModulePath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3');
    if (fs.existsSync(sqliteModulePath)) {
      console.log('✓ better-sqlite3 unpacked successfully');
    } else {
      console.log('⚠️  better-sqlite3 not found in unpacked modules');
    }

    // Create manifest file
    console.log('\n7. Creating resource manifest...');
    const manifest = {
      timestamp: new Date().toISOString(),
      platform: electronPlatformName,
      appVersion: packager.appInfo.version,
      resources: {
        libzmq: {
          x64: fs.existsSync(libzmqX64),
          x86: fs.existsSync(libzmqX86),
        },
        experts: fs.existsSync(expertsDir),
        icons: fs.existsSync(iconsDir),
        zeromq: fs.existsSync(zeromqBuildDir),
      },
    };

    const manifestPath = path.join(appResourcesDir, 'bundle-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Manifest created: ${manifestPath}`);

    // Summary
    console.log('\n========================================');
    console.log('AfterPack Summary:');
    console.log('========================================');
    console.log(`✓ Resources directory: ${appResourcesDir}`);
    console.log(`✓ LibZMQ x64: ${fs.existsSync(libzmqX64) ? 'Yes' : 'No'}`);
    console.log(`✓ LibZMQ x86: ${fs.existsSync(libzmqX86) ? 'Yes (optional)' : 'No (optional)'}`);
    console.log(`✓ MT5 Experts: ${fs.existsSync(expertsDir) ? 'Yes' : 'No'}`);
    console.log(`✓ Icons: ${fs.existsSync(iconsDir) ? 'Yes' : 'No'}`);
    console.log(`✓ ZeroMQ native: ${fs.existsSync(zeromqBuildDir) ? 'Yes' : 'No'}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error in afterPack script:', error);
    throw error;
  }
};
