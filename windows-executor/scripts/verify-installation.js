#!/usr/bin/env node

/**
 * Installation Verification Script for FX Platform Windows Executor
 * Verifies that all components are properly installed and configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
    projectDir: path.join(__dirname, '..'),
    resourcesDir: path.join(__dirname, '..', 'resources'),
    distDir: path.join(__dirname, '..', 'dist'),
    version: require('../package.json').version
};

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
    const exists = fs.existsSync(filePath);
    if (exists) {
        const stats = fs.statSync(filePath);
        const size = stats.size;
        const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` :
                       size > 1024 ? `${(size / 1024).toFixed(2)} KB` : `${size} bytes`;
        log(`✓ ${description}: ${sizeStr}`, 'green');
        return true;
    } else {
        log(`✗ ${description}: NOT FOUND`, 'red');
        return false;
    }
}

function checkDirectory(dirPath, description) {
    const exists = fs.existsSync(dirPath);
    if (exists) {
        const files = fs.readdirSync(dirPath);
        log(`✓ ${description}: ${files.length} files`, 'green');
        return true;
    } else {
        log(`✗ ${description}: NOT FOUND`, 'red');
        return false;
    }
}

function verifyResources() {
    log('\n📦 Verifying Resources...', 'cyan');

    let resourceScore = 0;
    let totalResourceChecks = 0;

    // Check resources directory structure
    totalResourceChecks++;
    if (checkDirectory(CONFIG.resourcesDir, 'Resources directory')) resourceScore++;

    // Check libraries
    const libsDir = path.join(CONFIG.resourcesDir, 'libs');
    totalResourceChecks++;
    if (checkDirectory(libsDir, 'Libraries directory')) resourceScore++;

    // Check ZeroMQ libraries
    totalResourceChecks++;
    if (checkFile(path.join(libsDir, 'libzmq-x64.dll'), '64-bit ZeroMQ library')) resourceScore++;

    totalResourceChecks++;
    if (checkFile(path.join(libsDir, 'libzmq-x86.dll'), '32-bit ZeroMQ library')) resourceScore++;

    // Check Expert Advisors
    const expertsDir = path.join(CONFIG.resourcesDir, 'experts');
    totalResourceChecks++;
    if (checkDirectory(expertsDir, 'Expert Advisors directory')) resourceScore++;

    totalResourceChecks++;
    if (checkFile(path.join(expertsDir, 'ZeroMQBridge.mq5'), 'Expert Advisor source')) resourceScore++;

    totalResourceChecks++;
    if (checkFile(path.join(expertsDir, 'ZeroMQBridge.ex5'), 'Expert Advisor compiled')) resourceScore++;

    // Check icons
    const iconsDir = path.join(CONFIG.resourcesDir, 'icons');
    totalResourceChecks++;
    if (checkDirectory(iconsDir, 'Icons directory')) resourceScore++;

    totalResourceChecks++;
    if (checkFile(path.join(iconsDir, 'icon.ico'), 'Application icon')) resourceScore++;

    const resourcePercentage = Math.round((resourceScore / totalResourceChecks) * 100);
    log(`\nResources Score: ${resourceScore}/${totalResourceChecks} (${resourcePercentage}%)`,
        resourcePercentage >= 80 ? 'green' : 'yellow');

    return { score: resourceScore, total: totalResourceChecks, percentage: resourcePercentage };
}

function verifyBuildFiles() {
    log('\n🔨 Verifying Build Files...', 'cyan');

    let buildScore = 0;
    let totalBuildChecks = 0;

    // Check main build output
    totalBuildChecks++;
    if (checkDirectory(CONFIG.distDir, 'Build output directory')) buildScore++;

    // Check essential build files
    const essentialFiles = [
        'dist/electron/main.js',
        'dist/index.html',
        'dist/assets/index.js',
        'dist/assets/index.css'
    ];

    essentialFiles.forEach(file => {
        totalBuildChecks++;
        const filePath = path.join(CONFIG.projectDir, file);
        if (checkFile(filePath, `Build file: ${file}`)) buildScore++;
    });

    const buildPercentage = Math.round((buildScore / totalBuildChecks) * 100);
    log(`\nBuild Files Score: ${buildScore}/${totalBuildChecks} (${buildPercentage}%)`,
        buildPercentage >= 80 ? 'green' : 'yellow');

    return { score: buildScore, total: totalBuildChecks, percentage: buildPercentage };
}

function verifyPackageFiles() {
    log('\n📋 Verifying Package Files...', 'cyan');

    let packageScore = 0;
    let totalPackageChecks = 0;

    // Check essential package files
    const packageFiles = [
        'package.json',
        'electron-builder.json',
        'tsconfig.json',
        'vite.config.ts',
        'tailwind.config.ts'
    ];

    packageFiles.forEach(file => {
        totalPackageChecks++;
        const filePath = path.join(CONFIG.projectDir, file);
        if (checkFile(filePath, `Package file: ${file}`)) packageScore++;
    });

    // Check source code structure
    const sourceDirs = [
        'src',
        'src/app',
        'src/components',
        'src/services',
        'src/utils',
        'src/types'
    ];

    sourceDirs.forEach(dir => {
        totalPackageChecks++;
        const dirPath = path.join(CONFIG.projectDir, dir);
        if (checkDirectory(dirPath, `Source directory: ${dir}`)) packageScore++;
    });

    const packagePercentage = Math.round((packageScore / totalPackageChecks) * 100);
    log(`\nPackage Files Score: ${packageScore}/${totalPackageChecks} (${packagePercentage}%)`,
        packagePercentage >= 80 ? 'green' : 'yellow');

    return { score: packageScore, total: totalPackageChecks, percentage: packagePercentage };
}

function verifyInstallerFiles() {
    log('\n💿 Verifying Installer Files...', 'cyan');

    let installerScore = 0;
    let totalInstallerChecks = 0;

    if (fs.existsSync(CONFIG.distDir)) {
        const distFiles = fs.readdirSync(CONFIG.distDir);
        const installerFiles = distFiles.filter(file =>
            file.endsWith('.exe') || file.endsWith('.msi')
        );

        if (installerFiles.length > 0) {
            log(`✓ Found ${installerFiles.length} installer file(s)`, 'green');
            installerScore++;

            installerFiles.forEach(file => {
                totalInstallerChecks++;
                const filePath = path.join(CONFIG.distDir, file);
                const stats = fs.statSync(filePath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                log(`✓ ${file}: ${sizeMB} MB`, 'green');
                totalInstallerChecks++;
            });
        } else {
            log('✗ No installer files found', 'red');
            totalInstallerChecks++;
        }
    } else {
        log('✗ Distribution directory not found', 'red');
        totalInstallerChecks++;
    }

    const installerPercentage = totalInstallerChecks > 0 ?
        Math.round((installerScore / totalInstallerChecks) * 100) : 0;

    log(`\nInstaller Files Score: ${installerScore}/${totalInstallerChecks} (${installerPercentage}%)`,
        installerPercentage >= 80 ? 'green' : installerPercentage < 50 ? 'red' : 'yellow');

    return { score: installerScore, total: totalInstallerChecks, percentage: installerPercentage };
}

function verifyDependencies() {
    log('\n🔗 Verifying Dependencies...', 'cyan');

    let depsScore = 0;
    let totalDepsChecks = 0;

    // Check node_modules exists
    totalDepsChecks++;
    if (checkDirectory(path.join(CONFIG.projectDir, 'node_modules'), 'Dependencies directory')) {
        depsScore++;

        // Check critical dependencies
        const criticalDeps = [
            'electron',
            'react',
            'react-dom',
            'zeromq',
            'pusher-js',
            'better-sqlite3'
        ];

        criticalDeps.forEach(dep => {
            totalDepsChecks++;
            const depPath = path.join(CONFIG.projectDir, 'node_modules', dep);
            if (checkDirectory(depPath, `Dependency: ${dep}`)) depsScore++;
        });
    }

    const depsPercentage = Math.round((depsScore / totalDepsChecks) * 100);
    log(`\nDependencies Score: ${depsScore}/${totalDepsChecks} (${depsPercentage}%)`,
        depsPercentage >= 80 ? 'green' : 'yellow');

    return { score: depsScore, total: totalDepsChecks, percentage: depsPercentage };
}

function checkMT5Compatibility() {
    log('\n🖥️  Checking MT5 Compatibility...', 'cyan');

    // Check if ZeroMQ libraries are the correct versions
    const lib64Path = path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x64.dll');
    const lib86Path = path.join(CONFIG.resourcesDir, 'libs', 'libzmq-x86.dll');

    let mt5Score = 0;
    let totalMt5Checks = 0;

    // Check 64-bit library
    totalMt5Checks++;
    if (fs.existsSync(lib64Path)) {
        const stats = fs.statSync(lib64Path);
        // ZeroMQ DLL should be around 1-2 MB
        if (stats.size > 500000 && stats.size < 5000000) {
            log('✓ 64-bit ZeroMQ library size is reasonable', 'green');
            mt5Score++;
        } else {
            log(`⚠️ 64-bit ZeroMQ library size seems unusual: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'yellow');
        }
    } else {
        log('✗ 64-bit ZeroMQ library not found', 'red');
    }

    // Check 32-bit library
    totalMt5Checks++;
    if (fs.existsSync(lib86Path)) {
        const stats = fs.statSync(lib86Path);
        if (stats.size > 500000 && stats.size < 5000000) {
            log('✓ 32-bit ZeroMQ library size is reasonable', 'green');
            mt5Score++;
        } else {
            log(`⚠️ 32-bit ZeroMQ library size seems unusual: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'yellow');
        }
    } else {
        log('✗ 32-bit ZeroMQ library not found', 'red');
    }

    // Check Expert Advisor
    totalMt5Checks++;
    const eaPath = path.join(CONFIG.resourcesDir, 'experts', 'ZeroMQBridge.mq5');
    if (fs.existsSync(eaPath)) {
        const content = fs.readFileSync(eaPath, 'utf8');
        if (content.includes('zmq_socket') && content.includes('libzmq.dll')) {
            log('✓ Expert Advisor contains ZeroMQ imports', 'green');
            mt5Score++;
        } else {
            log('⚠️ Expert Advisor may not have proper ZeroMQ integration', 'yellow');
        }
    } else {
        log('✗ Expert Advisor source not found', 'red');
    }

    const mt5Percentage = Math.round((mt5Score / totalMt5Checks) * 100);
    log(`\nMT5 Compatibility Score: ${mt5Score}/${totalMt5Checks} (${mt5Percentage}%)`,
        mt5Percentage >= 80 ? 'green' : mt5Percentage >= 60 ? 'yellow' : 'red');

    return { score: mt5Score, total: totalMt5Checks, percentage: mt5Percentage };
}

function generateReport(results) {
    log('\n📊 Generating Verification Report...', 'cyan');

    const overallScore = Object.values(results).reduce((sum, result) => sum + result.score, 0);
    const overallTotal = Object.values(results).reduce((sum, result) => sum + result.total, 0);
    const overallPercentage = Math.round((overallScore / overallTotal) * 100);

    log('\n' + '='.repeat(60), 'blue');
    log('🎯 FX PLATFORM EXECUTOR - INSTALLATION VERIFICATION REPORT', 'blue');
    log('='.repeat(60), 'blue');
    log(`Version: ${CONFIG.version}`, 'white');
    log(`Timestamp: ${new Date().toISOString()}`, 'white');
    log(`Platform: ${process.platform}-${process.arch}`, 'white');
    log('', 'white');

    // Detailed results
    Object.entries(results).forEach(([category, result]) => {
        log(`${category.toUpperCase()}: ${result.score}/${result.total} (${result.percentage}%)`,
            result.percentage >= 80 ? 'green' : result.percentage >= 60 ? 'yellow' : 'red');
    });

    log('', 'white');
    log('='.repeat(60), 'blue');
    log(`OVERALL SCORE: ${overallScore}/${overallTotal} (${overallPercentage}%)`,
        overallPercentage >= 80 ? 'green' : overallPercentage >= 60 ? 'yellow' : 'red');
    log('='.repeat(60), 'blue');

    // Recommendations
    log('\n📋 Recommendations:', 'cyan');

    if (results.resources.percentage < 100) {
        log('• Complete the resources folder with missing DLL/EA files', 'yellow');
    }

    if (results.installer.percentage < 100) {
        log('• Build the application installer using: npm run build:production', 'yellow');
    }

    if (results.build.percentage < 100) {
        log('• Complete the build process with: npm run build', 'yellow');
    }

    if (overallPercentage >= 90) {
        log('🎉 Installation is ready for distribution!', 'green');
    } else if (overallPercentage >= 70) {
        log('⚠️  Installation is mostly ready, address remaining issues', 'yellow');
    } else {
        log('❌ Installation has significant issues that need to be resolved', 'red');
    }

    // Save report to file
    const report = {
        timestamp: new Date().toISOString(),
        version: CONFIG.version,
        platform: process.platform,
        arch: process.arch,
        results,
        overall: {
            score: overallScore,
            total: overallTotal,
            percentage: overallPercentage
        }
    };

    const reportPath = path.join(CONFIG.projectDir, 'installation-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Detailed report saved to: ${reportPath}`, 'blue');

    return overallPercentage;
}

function main() {
    log('🔍 FX Platform Windows Executor - Installation Verification', 'cyan');
    log(`Version: ${CONFIG.version}`, 'white');
    log(`Node.js: ${process.version}`, 'white');
    log(`Platform: ${process.platform}-${process.arch}`, 'white');

    try {
        // Run all verification checks
        const results = {
            resources: verifyResources(),
            build: verifyBuildFiles(),
            package: verifyPackageFiles(),
            installer: verifyInstallerFiles(),
            dependencies: verifyDependencies(),
            mt5: checkMT5Compatibility()
        };

        // Generate final report
        const overallScore = generateReport(results);

        // Exit with appropriate code
        process.exit(overallScore >= 80 ? 0 : 1);

    } catch (error) {
        log(`\n❌ Verification failed: ${error.message}`, 'red');
        process.exit(2);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    log('\n👋 Verification cancelled by user', 'yellow');
    process.exit(0);
});

// Run the verification
if (require.main === module) {
    main();
}

module.exports = { main, CONFIG };
