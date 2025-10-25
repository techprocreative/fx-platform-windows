#!/usr/bin/env node

/**
 * Comprehensive Post-Install Script
 * Runs all necessary setup steps after npm install
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('POST-INSTALL COMPREHENSIVE SETUP');
console.log('='.repeat(70) + '\n');

const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Check if we're in CI environment
 */
function isCIEnvironment() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.TRAVIS ||
    process.env.CIRCLECI
  );
}

/**
 * Execute command with error handling
 */
function runCommand(command, options = {}) {
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      ...options
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Setup steps
 */
const steps = [
  {
    name: 'Create required directories',
    fn: async () => {
      const dirs = [
        path.join(PROJECT_ROOT, 'logs'),
        path.join(PROJECT_ROOT, 'database'),
        path.join(PROJECT_ROOT, 'resources', 'libs'),
        path.join(PROJECT_ROOT, 'resources', 'experts'),
        path.join(PROJECT_ROOT, 'dist'),
        path.join(PROJECT_ROOT, 'dist-app'),
        path.join(PROJECT_ROOT, 'dist-build'),
      ];
      
      for (const dir of dirs) {
        await fs.ensureDir(dir);
      }
      
      console.log('  ✅ Directories created');
    },
    critical: true,
    skipInCI: false
  },
  {
    name: 'Rebuild native modules for Electron',
    command: 'npx electron-rebuild -f -w zeromq,better-sqlite3',
    critical: true,
    skipInCI: false // Needed even in CI for proper builds
  },
  {
    name: 'Fix ZeroMQ native module paths',
    fn: async () => {
      const fixScript = path.join(PROJECT_ROOT, 'scripts', 'fix-zeromq-path.js');
      if (fs.existsSync(fixScript)) {
        return runCommand(`node "${fixScript}"`);
      } else {
        console.log('  ⚠️  fix-zeromq-path.js not found, skipping');
        return true;
      }
    },
    critical: true,
    skipInCI: false
  },
  {
    name: 'Verify libzmq.dll (if exists)',
    fn: async () => {
      const dllPath = path.join(PROJECT_ROOT, 'resources', 'libs', 'libzmq-x64.dll');
      const verifyScript = path.join(PROJECT_ROOT, 'scripts', 'verify-libzmq-enhanced.js');
      
      if (!fs.existsSync(dllPath)) {
        console.log('  ℹ️  libzmq-x64.dll not found (run npm run fix:libzmq to download)');
        return true; // Not critical if DLL not yet downloaded
      }
      
      if (!fs.existsSync(verifyScript)) {
        console.log('  ⚠️  Verification script not found, skipping');
        return true;
      }
      
      try {
        const result = execSync(`node "${verifyScript}" --dll "${dllPath}"`, {
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: PROJECT_ROOT
        });
        
        if (result.includes('VERIFICATION PASSED')) {
          console.log('  ✅ libzmq.dll verification passed');
          return true;
        } else {
          console.log('  ⚠️  libzmq.dll verification has warnings');
          console.log('     Run: npm run fix:libzmq to download correct version');
          return true; // Don't fail post-install
        }
      } catch (error) {
        console.log('  ⚠️  Verification failed (may need correct DLL)');
        console.log('     Run: npm run fix:libzmq to fix');
        return true; // Don't fail post-install
      }
    },
    critical: false,
    skipInCI: true // Skip verification in CI
  },
  {
    name: 'Verify ZeroMQ module can be loaded',
    fn: async () => {
      try {
        // Try to require zeromq
        const testScript = `
          try {
            const zmq = require('zeromq');
            console.log('  ✅ ZeroMQ module loaded successfully');
            console.log('     Version:', zmq.version);
            process.exit(0);
          } catch (error) {
            console.error('  ❌ ZeroMQ module load failed:', error.message);
            process.exit(1);
          }
        `;
        
        execSync(`node -e "${testScript}"`, {
          stdio: 'inherit',
          cwd: PROJECT_ROOT
        });
        
        return true;
      } catch (error) {
        console.log('  ❌ ZeroMQ module cannot be loaded');
        console.log('     Try: npm run rebuild');
        return false;
      }
    },
    critical: true,
    skipInCI: false
  }
];

/**
 * Main execution
 */
async function main() {
  const isCI = isCIEnvironment();
  
  if (isCI) {
    console.log('ℹ️  Detected CI environment\n');
  }
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const step of steps) {
    if (isCI && step.skipInCI) {
      console.log(`\n⏭️  ${step.name} (skipped in CI)`);
      skipped++;
      continue;
    }
    
    console.log(`\n📦 ${step.name}...`);
    
    try {
      let success = false;
      
      if (step.command) {
        success = runCommand(step.command);
      } else if (step.fn) {
        success = await step.fn();
      }
      
      if (success) {
        console.log(`  ✅ ${step.name} - SUCCESS`);
        passed++;
      } else {
        console.error(`  ❌ ${step.name} - FAILED`);
        failed++;
        
        if (step.critical) {
          console.error('\n❌ Critical step failed - stopping');
          break;
        }
      }
      
    } catch (error) {
      console.error(`  ❌ ${step.name} - ERROR: ${error.message}`);
      failed++;
      
      if (step.critical) {
        console.error('\n❌ Critical step failed - stopping');
        break;
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('='.repeat(70));
  
  if (failed === 0) {
    console.log('\n✅ POST-INSTALL COMPLETED SUCCESSFULLY');
    
    // Check if libzmq.dll needs to be downloaded
    const dllPath = path.join(PROJECT_ROOT, 'resources', 'libs', 'libzmq-x64.dll');
    if (!fs.existsSync(dllPath)) {
      console.log('\n⚠️  IMPORTANT: libzmq-x64.dll not found!');
      console.log('   Run: npm run fix:libzmq');
      console.log('   This will download the correct DLL for MT5 compatibility');
    }
    
    console.log('\nNext steps:');
    console.log('  1. If libzmq.dll missing: npm run fix:libzmq');
    console.log('  2. Verify DLL: npm run verify:dll');
    console.log('  3. Run tests: npm test');
    console.log('  4. Start development: npm run dev');
    console.log();
    
    process.exit(0);
  } else if (failed > 0 && passed > 0) {
    console.log('\n⚠️  POST-INSTALL COMPLETED WITH ERRORS');
    console.log('\nSome non-critical steps failed. You can continue but may need to:');
    console.log('  1. Run: npm run rebuild');
    console.log('  2. Run: npm run fix:paths');
    console.log('  3. Run: npm run fix:libzmq');
    console.log();
    
    // Exit with 0 to not block npm install completely
    process.exit(0);
  } else {
    console.log('\n❌ POST-INSTALL FAILED');
    console.log('\nTroubleshooting:');
    console.log('  1. Ensure Node.js v18+ is installed');
    console.log('  2. Ensure you have build tools (Visual Studio Build Tools)');
    console.log('  3. Try: npm ci (clean install)');
    console.log('  4. Check error messages above for specific issues');
    console.log();
    
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
