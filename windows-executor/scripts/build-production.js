#!/usr/bin/env node

/**
 * Production Build Script for FX Platform Windows Executor
 * Handles resource preparation, building, and packaging for distribution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
    projectDir: path.join(__dirname, '..'),
    outputDir: path.join(__dirname, '..', 'dist'),
    resourcesDir: path.join(__dirname, '..', 'resources'),
    buildDir: path.join(__dirname, '..', 'build'),
    version: require('../package.json').version,
    productName: 'FX Platform Executor',
    executableName: 'FX-Platform-Executor.exe'
};

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

/**
 * Colored console logging
 */
function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Execute command with error handling
 */
function execCommand(command, options = {}) {
    try {
        log(`Executing: ${command}`, 'cyan');
        execSync(command, {
            stdio: 'inherit',
            cwd: CONFIG.projectDir,
            ...options
        });
        log(`✓ Command completed: ${command}`, 'green');
    } catch (error) {
        log(`✗ Command failed: ${command}`, 'red');
        log(`Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * Check if required dependencies are available
 */
function checkDependencies() {
    log('🔍 Checking dependencies...', 'yellow');

    const requiredFiles = [
        'package.json',
        'electron-builder.json',
        'src/main.tsx',
        'src/app/App.tsx'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(CONFIG.projectDir, file);
        if (!fs.existsSync(filePath)) {
            log(`✗ Required file missing: ${file}`, 'red');
            process.exit(1);
        }
    }

    // Check if node_modules exists
    if (!fs.existsSync(path.join(CONFIG.projectDir, 'node_modules'))) {
        log('📦 Installing dependencies...', 'yellow');
        execCommand('npm install');
    }

    log('✓ Dependencies check passed', 'green');
}

/**
 * Prepare resources for packaging
 */
function prepareResources() {
    log('📦 Preparing resources...', 'yellow');

    // Ensure resources directory exists
    if (!fs.existsSync(CONFIG.resourcesDir)) {
        fs.mkdirSync(CONFIG.resourcesDir, { recursive: true });
        log('✓ Created resources directory', 'green');
    }

    // Check required resource subdirectories
    const requiredDirs = ['libs', 'experts', 'icons'];
    for (const dir of requiredDirs) {
        const dirPath = path.join(CONFIG.resourcesDir, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            log(`✓ Created resources/${dir} directory`, 'green');
        }
    }

    // Download ZeroMQ libraries if they don't exist
    const lib64Path = path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x64.dll');
    const lib86Path = path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x86.dll');

    if (!fs.existsSync(lib64Path) || !fs.existsSync(lib86Path)) {
        log('⬇️  Downloading ZeroMQ libraries...', 'yellow');
        execCommand('node scripts/download-libzmq.js');
    } else {
        log('✓ ZeroMQ libraries already exist', 'green');
    }

    // Check Expert Advisor files
    const eaSourcePath = path.join(CONFIG.resourcesDir, 'experts', 'ZeroMQBridge.mq5');
    const eaCompiledPath = path.join(CONFIG.resourcesDir, 'experts', 'ZeroMQBridge.ex5');

    if (!fs.existsSync(eaSourcePath)) {
        log('⚠️  Warning: ZeroMQ Expert Advisor source file not found', 'yellow');
        log('   The EA will need to be compiled manually in MT5', 'yellow');
    }

    if (!fs.existsSync(eaCompiledPath)) {
        log('⚠️  Warning: ZeroMQ Expert Advisor compiled file not found', 'yellow');
        log('   The EA will need to be compiled in MT5 MetaEditor', 'yellow');
    }

    // Check application icon
    const iconPath = path.join(CONFIG.resourcesDir, 'icons', 'icon.ico');
    if (!fs.existsSync(iconPath)) {
        log('⚠️  Warning: Application icon not found', 'yellow');
        log('   Using default Electron icon', 'yellow');
    }

    log('✓ Resources preparation completed', 'green');
}

/**
 * Clean previous builds
 */
function cleanBuild() {
    log('🧹 Cleaning previous builds...', 'yellow');

    const dirsToClean = [CONFIG.outputDir, CONFIG.buildDir];

    for (const dir of dirsToClean) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            log(`✓ Cleaned ${path.basename(dir)}`, 'green');
        }
    }

    log('✓ Build cleanup completed', 'green');
}

/**
 * Build the application
 */
function buildApplication() {
    log('🔨 Building application...', 'yellow');

    // Build React app
    log('Building React frontend...', 'cyan');
    execCommand('npm run build:react');

    // Build Electron main process
    log('Building Electron main process...', 'cyan');
    execCommand('npm run build:electron');

    // Type checking
    log('Running type check...', 'cyan');
    execCommand('npm run type-check');

    // Linting
    log('Running linter...', 'cyan');
    execCommand('npm run lint');

    log('✓ Application build completed', 'green');
}

/**
 * Run tests
 */
function runTests() {
    log('🧪 Running tests...', 'yellow');

    try {
        execCommand('npm test', { stdio: 'pipe' });
        log('✓ All tests passed', 'green');
    } catch (error) {
        log('⚠️  Some tests failed, but continuing build', 'yellow');
    }
}

/**
 * Package for distribution
 */
function packageApplication() {
    log('📦 Packaging for distribution...', 'yellow');

    // Build Windows installer
    log('Building Windows installer...', 'cyan');
    execCommand('npm run package:win');

    // Check if installer was created
    const outputDir = path.join(CONFIG.projectDir, 'dist');
    const installerFiles = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.exe') || file.endsWith('.msi'));

    if (installerFiles.length === 0) {
        log('✗ No installer files found in dist directory', 'red');
        process.exit(1);
    }

    log('✓ Application packaged successfully', 'green');

    // List created files
    log('📋 Created installer files:', 'blue');
    installerFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        log(`  📦 ${file} (${sizeMB} MB)`, 'white');
    });
}

/**
 * Generate build information
 */
function generateBuildInfo() {
    log('📋 Generating build information...', 'yellow');

    const buildInfo = {
        version: CONFIG.version,
        buildDate: new Date().toISOString(),
        buildNumber: Date.now().toString(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        productName: CONFIG.productName,
        executableName: CONFIG.executableName,
        resources: {
            libzmq: {
                x64: fs.existsSync(path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x64.dll')),
                x86: fs.existsSync(path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x86.dll'))
            },
            expertAdvisor: {
                source: fs.existsSync(path.join(CONFIG.resourcesDir, 'experts', 'ZeroMQBridge.mq5')),
                compiled: fs.existsSync(path.join(CONFIG.resourcesDir, 'experts', 'ZeroMQBridge.ex5'))
            },
            icon: fs.existsSync(path.join(CONFIG.resourcesDir, 'icons', 'icon.ico'))
        }
    };

    const buildInfoPath = path.join(CONFIG.projectDir, 'build-info.json');
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

    log(`✓ Build info saved to ${buildInfoPath}`, 'green');
    log('📋 Build Summary:', 'blue');
    log(`  Version: ${buildInfo.version}`, 'white');
    log(`  Build Date: ${buildInfo.buildDate}`, 'white');
    log(`  Platform: ${buildInfo.platform}-${buildInfo.arch}`, 'white');
    log(`  Node.js: ${buildInfo.nodeVersion}`, 'white');
}

/**
 * Main build process
 */
function main() {
    log('🚀 FX Platform Windows Executor - Production Build', 'magenta');
    log(`Version: ${CONFIG.version}`, 'white');
    log(`Node.js: ${process.version}`, 'white');
    log(`Platform: ${process.platform}-${process.arch}`, 'white');
    log('', 'white');

    try {
        // Build steps
        checkDependencies();
        prepareResources();
        cleanBuild();
        buildApplication();
        runTests();
        packageApplication();
        generateBuildInfo();

        log('', 'white');
        log('🎉 Production build completed successfully!', 'green');
        log('📦 Check the dist/ directory for installer files', 'blue');
        log('', 'white');
        log('Next steps:', 'yellow');
        log('1. Test the installer on a clean Windows machine', 'white');
        log('2. Verify auto-installation to MT5 works correctly', 'white');
        log('3. Test ZeroMQ communication with MT5', 'white');
        log('4. Verify Pusher integration with the web platform', 'white');

    } catch (error) {
        log('', 'white');
        log(`❌ Build failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    log('\n👋 Build cancelled by user', 'yellow');
    process.exit(0);
});

// Run the build script
if (require.main === module) {
    main();
}

module.exports = { main, CONFIG };
