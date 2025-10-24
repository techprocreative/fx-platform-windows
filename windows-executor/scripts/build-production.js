#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, '..');
const distDir = path.join(projectDir, 'dist-build');

const steps = [
  {
    name: 'Clean previous builds',
    command: 'npm run clean'
  },
  {
    name: 'Install dependencies',
    command: 'npm ci'
  },
  {
    name: 'Rebuild native modules',
    command: 'npm run rebuild:native'
  },
  {
    name: 'Fix ZeroMQ native paths',
    command: 'npm run fix:paths'
  },
  {
    name: 'Verify libzmq exports',
    command: 'npm run verify:dll'
  },
  {
    name: 'Run unit tests',
    command: 'npm test'
  },
  {
    name: 'Build renderer',
    command: 'npm run build:react'
  },
  {
    name: 'Build electron process',
    command: 'npm run build:electron'
  },
  {
    name: 'Package Windows build',
    command: 'npm run package:win'
  }
];

function runStep(step) {
  console.log('\n' + '='.repeat(60));
  console.log(`▶ ${step.name}`);
  console.log('='.repeat(60));
  execSync(step.command, { stdio: 'inherit', cwd: projectDir });
}

function listArtifacts() {
  if (!fs.existsSync(distDir)) {
    console.log('No dist-build directory found.');
    return;
  }

  const files = fs.readdirSync(distDir);
  if (files.length === 0) {
    console.log('dist-build directory is empty.');
    return;
  }

  console.log('\nArtifacts:');
  files.forEach((file) => {
    const filePath = path.join(distDir, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      console.log(`- ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  });
}

function main() {
  console.log('FX Platform Windows Executor - Production Build');

  for (const step of steps) {
    runStep(step);
  }

  console.log('\nBuild pipeline completed successfully.');
  listArtifacts();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('\nBuild pipeline failed:', error.message);
    process.exit(1);
  }
}

module.exports = { main };
