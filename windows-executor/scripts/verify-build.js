#!/usr/bin/env node

/**
 * Build Verification Script
 * Checks if all required build artifacts are present
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('BUILD VERIFICATION');
console.log('='.repeat(70) + '\n');

const PROJECT_ROOT = path.join(__dirname, '..');

const checks = [
  {
    name: 'React build exists (dist-app)',
    check: () => fs.existsSync(path.join(PROJECT_ROOT, 'dist-app', 'index.html'))
  },
  {
    name: 'Electron build exists (dist/electron)',
    check: () => fs.existsSync(path.join(PROJECT_ROOT, 'dist', 'electron', 'electron', 'main.js'))
  },
  {
    name: 'ZeroMQ native module in correct location',
    check: () => {
      const expected = path.join(PROJECT_ROOT, 'node_modules', 'zeromq', 'build', 'Release', 'zeromq.node');
      return fs.existsSync(expected);
    }
  },
  {
    name: 'libzmq-x64.dll exists',
    check: () => fs.existsSync(path.join(PROJECT_ROOT, 'resources', 'libs', 'libzmq-x64.dll'))
  },
  {
    name: 'Expert Advisors exist',
    check: () => {
      const mq5 = fs.existsSync(path.join(PROJECT_ROOT, 'resources', 'experts', 'FX_Platform_Bridge.mq5'));
      const ex5 = fs.existsSync(path.join(PROJECT_ROOT, 'resources', 'experts', 'FX_Platform_Bridge.ex5'));
      const testMq5 = fs.existsSync(path.join(PROJECT_ROOT, 'resources', 'experts', 'FX_Platform_Bridge_Test.mq5'));
      return mq5 || ex5 || testMq5;
    }
  },
  {
    name: 'package.json valid',
    check: () => {
      try {
        const pkg = require(path.join(PROJECT_ROOT, 'package.json'));
        return pkg.name && pkg.version && pkg.scripts;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'Electron builder config valid',
    check: () => {
      try {
        const config = require(path.join(PROJECT_ROOT, 'electron-builder.config.js'));
        return config.asarUnpack && config.asarUnpack.length > 0;
      } catch {
        return false;
      }
    }
  },
  {
    name: 'No duplicate build configs',
    check: () => {
      // electron-builder.json should NOT exist (we use .js only)
      return !fs.existsSync(path.join(PROJECT_ROOT, 'electron-builder.json'));
    }
  },
  {
    name: 'Required scripts exist',
    check: () => {
      const scripts = [
        'scripts/verify-libzmq-enhanced.js',
        'scripts/download-libzmq-auto.js',
        'scripts/fix-zeromq-path.js',
        'scripts/post-install-comprehensive.js'
      ];
      
      return scripts.every(script => 
        fs.existsSync(path.join(PROJECT_ROOT, script))
      );
    }
  },
  {
    name: 'TypeScript config exists',
    check: () => {
      return fs.existsSync(path.join(PROJECT_ROOT, 'tsconfig.json'));
    }
  }
];

let allPassed = true;
let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  try {
    const result = check();
    
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${name} (error: ${error.message})`);
    failed++;
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

if (allPassed) {
  console.log('\n✅ BUILD VERIFICATION PASSED');
  console.log('   All required components are present');
  console.log('   Ready for packaging!');
} else {
  console.log('\n❌ BUILD VERIFICATION FAILED');
  console.log('   Some components are missing or invalid');
  console.log();
  console.log('Troubleshooting:');
  console.log('  1. React build missing? Run: npm run build:react');
  console.log('  2. Electron build missing? Run: npm run build:electron');
  console.log('  3. libzmq.dll missing? Run: npm run fix:libzmq');
  console.log('  4. Native modules issue? Run: npm run rebuild');
  console.log('  5. Scripts missing? Check git repository');
}

console.log('\n');

process.exit(allPassed ? 0 : 1);
