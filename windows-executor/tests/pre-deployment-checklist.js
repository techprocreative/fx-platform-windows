#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');

const checks = [
  {
    name: 'libzmq-x64.dll exists',
    run: () => fs.existsSync(path.join(projectRoot, 'resources', 'libs', 'libzmq-x64.dll'))
  },
  {
    name: 'libzmq export verification passes',
    run: () => {
      execSync('npm run verify:dll', { stdio: 'ignore', cwd: projectRoot });
      return true;
    }
  },
  {
    name: 'zeromq native module present',
    run: () => fs.existsSync(path.join(projectRoot, 'node_modules', 'zeromq', 'build', 'Release', 'zeromq.node'))
  },
  {
    name: 'ZeroMQ module can be required',
    run: () => {
      require(path.join(projectRoot, 'node_modules', 'zeromq'));
      return true;
    }
  },
  {
    name: 'Expert advisor files present',
    run: () => {
      const expertsDir = path.join(projectRoot, 'resources', 'experts');
      return fs.existsSync(path.join(expertsDir, 'FX_Platform_Bridge.mq5')) &&
        fs.existsSync(path.join(expertsDir, 'FX_Platform_Bridge.ex5'));
    }
  },
  {
    name: 'Build configuration present',
    run: () => fs.existsSync(path.join(projectRoot, 'electron-builder.config.js'))
  }
];

function main() {
  console.log('Pre-deployment checklist');
  let passed = true;

  checks.forEach((check) => {
    try {
      if (check.run()) {
        console.log(`✓ ${check.name}`);
      } else {
        console.log(`✗ ${check.name}`);
        passed = false;
      }
    } catch (error) {
      console.log(`✗ ${check.name} (${error.message})`);
      passed = false;
    }
  });

  if (!passed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { checks };
