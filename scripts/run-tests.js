#!/usr/bin/env node

/**
 * Test Automation Script
 * 
 * This script provides a command-line interface for running different types of tests
 * for the FX Trading Platform. It supports running unit tests, integration tests,
 * end-to-end tests, load tests, and security tests.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = {};

// Parse options
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.substring(2);
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++;
    } else {
      options[key] = true;
    }
  }
}

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

// Helper function to print colored text
function printColor(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// Helper function to execute a command
function executeCommand(command, description) {
  printColor('blue', `Running: ${description}`);
  printColor('cyan', `Command: ${command}`);
  
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: options.verbose ? 'inherit' : 'pipe' });
    if (options.verbose) {
      console.log(output);
    }
    printColor('green', `✓ ${description} completed successfully`);
    return { success: true, output };
  } catch (error) {
    printColor('red', `✗ ${description} failed`);
    if (options.verbose || !options.continue) {
      console.error(error.stdout || error.message);
    }
    return { success: false, error: error.stdout || error.message };
  }
}

// Helper function to check if a directory exists
function directoryExists(dirPath) {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

// Helper function to create a directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
  if (!directoryExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    printColor('yellow', `Created directory: ${dirPath}`);
  }
}

// Helper function to generate a timestamp
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

// Helper function to generate a test report
function generateTestReport(testResults, reportPath) {
  const report = {
    timestamp: new Date().toISOString(),
    tests: testResults
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  printColor('green', `Test report generated: ${reportPath}`);
}

// Print usage information
function printUsage() {
  console.log(`
FX Trading Platform Test Automation

Usage: node run-tests.js <command> [options]

Commands:
  unit                    Run unit tests
  integration             Run integration tests
  e2e                     Run end-to-end tests
  load                    Run load tests
  security                Run security tests
  all                     Run all tests
  coverage                Generate code coverage report
  lint                    Run code linting
  clean                   Clean test artifacts

Options:
  --verbose               Show detailed output
  --watch                 Run tests in watch mode
  --continue              Continue running tests even if one fails
  --report                Generate test report
  --coverage              Generate coverage report
  --timeout <ms>          Set test timeout in milliseconds
  --parallel <num>        Run tests in parallel (default: CPU count)
  --grep <pattern>        Run tests matching the pattern
  --env <environment>     Set test environment (default: test)
  --config <path>         Path to test configuration file

Examples:
  node run-tests.js unit
  node run-tests.js integration --verbose
  node run-tests.js e2e --report --coverage
  node run-tests.js all --continue
  node run-tests.js load --timeout 60000
  node run-tests.js security --env staging
`);
}

// Run unit tests
function runUnitTests() {
  printColor('magenta', '=== Running Unit Tests ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.test.ts');
  const coverageDir = path.join(__dirname, '..', 'coverage');
  
  let command = `npx jest "${testPath}" --config="${jestConfig}"`;
  
  if (options.watch) {
    command += ' --watch';
  }
  
  if (options.coverage) {
    command += ' --coverage';
    ensureDirectoryExists(coverageDir);
  }
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.grep) {
    command += ` --testNamePattern="${options.grep}"`;
  }
  
  if (options.timeout) {
    command += ` --testTimeout=${options.timeout}`;
  }
  
  const result = executeCommand(command, 'Unit Tests');
  
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `unit-tests-${getTimestamp()}.json`);
    generateTestReport([{ type: 'unit', success: result.success, output: result.output || result.error }], reportPath);
  }
  
  return result.success;
}

// Run integration tests
function runIntegrationTests() {
  printColor('magenta', '=== Running Integration Tests ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.integration.test.ts');
  
  let command = `npx jest "${testPath}" --config="${jestConfig}" --testPathPattern=integration`;
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.coverage) {
    command += ' --coverage';
  }
  
  if (options.timeout) {
    command += ` --testTimeout=${options.timeout}`;
  }
  
  const result = executeCommand(command, 'Integration Tests');
  
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `integration-tests-${getTimestamp()}.json`);
    generateTestReport([{ type: 'integration', success: result.success, output: result.output || result.error }], reportPath);
  }
  
  return result.success;
}

// Run end-to-end tests
function runE2ETests() {
  printColor('magenta', '=== Running End-to-End Tests ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.e2e.test.ts');
  
  let command = `npx jest "${testPath}" --config="${jestConfig}" --testPathPattern=e2e`;
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.timeout) {
    command += ` --testTimeout=${options.timeout}`;
  }
  
  const result = executeCommand(command, 'End-to-End Tests');
  
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `e2e-tests-${getTimestamp()}.json`);
    generateTestReport([{ type: 'e2e', success: result.success, output: result.output || result.error }], reportPath);
  }
  
  return result.success;
}

// Run load tests
function runLoadTests() {
  printColor('magenta', '=== Running Load Tests ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.load.test.ts');
  
  let command = `npx jest "${testPath}" --config="${jestConfig}" --testPathPattern=load`;
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.timeout) {
    command += ` --testTimeout=${options.timeout}`;
  }
  
  const result = executeCommand(command, 'Load Tests');
  
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `load-tests-${getTimestamp()}.json`);
    generateTestReport([{ type: 'load', success: result.success, output: result.output || result.error }], reportPath);
  }
  
  return result.success;
}

// Run security tests
function runSecurityTests() {
  printColor('magenta', '=== Running Security Tests ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.security.test.ts');
  
  let command = `npx jest "${testPath}" --config="${jestConfig}" --testPathPattern=security`;
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.timeout) {
    command += ` --testTimeout=${options.timeout}`;
  }
  
  const result = executeCommand(command, 'Security Tests');
  
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `security-tests-${getTimestamp()}.json`);
    generateTestReport([{ type: 'security', success: result.success, output: result.output || result.error }], reportPath);
  }
  
  return result.success;
}

// Run all tests
function runAllTests() {
  printColor('magenta', '=== Running All Tests ===');
  
  const testResults = [];
  
  // Run unit tests
  testResults.push({ type: 'unit', success: runUnitTests() });
  
  // Run integration tests
  testResults.push({ type: 'integration', success: runIntegrationTests() });
  
  // Run end-to-end tests
  testResults.push({ type: 'e2e', success: runE2ETests() });
  
  // Run load tests
  testResults.push({ type: 'load', success: runLoadTests() });
  
  // Run security tests
  testResults.push({ type: 'security', success: runSecurityTests() });
  
  // Generate combined report
  if (options.report) {
    const reportDir = path.join(__dirname, '..', 'test-reports');
    ensureDirectoryExists(reportDir);
    const reportPath = path.join(reportDir, `all-tests-${getTimestamp()}.json`);
    generateTestReport(testResults, reportPath);
  }
  
  // Print summary
  printColor('magenta', '=== Test Summary ===');
  testResults.forEach(result => {
    const status = result.success ? '✓' : '✗';
    const color = result.success ? 'green' : 'red';
    printColor(color, `${status} ${result.type.charAt(0).toUpperCase() + result.type.slice(1)} Tests`);
  });
  
  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;
  
  if (successCount === totalCount) {
    printColor('green', `All ${totalCount} test suites passed!`);
    return true;
  } else {
    printColor('red', `${totalCount - successCount} of ${totalCount} test suites failed!`);
    return false;
  }
}

// Generate code coverage report
function generateCoverageReport() {
  printColor('magenta', '=== Generating Coverage Report ===');
  
  const jestConfig = path.join(__dirname, '..', 'jest.config.js');
  const testPath = path.join(__dirname, '..', 'src', '**', '__tests__', '*.test.ts');
  const coverageDir = path.join(__dirname, '..', 'coverage');
  
  ensureDirectoryExists(coverageDir);
  
  const command = `npx jest "${testPath}" --config="${jestConfig}" --coverage --coverageReporters=html,text`;
  
  const result = executeCommand(command, 'Coverage Report');
  
  if (result.success) {
    printColor('green', `Coverage report generated: ${path.join(coverageDir, 'lcov-report', 'index.html')}`);
  }
  
  return result.success;
}

// Run code linting
function runLinting() {
  printColor('magenta', '=== Running Code Linting ===');
  
  const eslintConfig = path.join(__dirname, '..', '.eslintrc.js');
  const srcPath = path.join(__dirname, '..', 'src');
  
  let command = `npx eslint "${srcPath}" --config="${eslintConfig}"`;
  
  if (options.fix) {
    command += ' --fix';
  }
  
  const result = executeCommand(command, 'Code Linting');
  
  return result.success;
}

// Clean test artifacts
function cleanTestArtifacts() {
  printColor('magenta', '=== Cleaning Test Artifacts ===');
  
  const dirsToClean = [
    path.join(__dirname, '..', 'coverage'),
    path.join(__dirname, '..', 'test-reports'),
    path.join(__dirname, '..', '.nyc_output')
  ];
  
  dirsToClean.forEach(dir => {
    if (directoryExists(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        printColor('yellow', `Removed directory: ${dir}`);
      } catch (error) {
        printColor('red', `Failed to remove directory: ${dir}`);
        printColor('red', error.message);
      }
    }
  });
  
  printColor('green', 'Test artifacts cleaned successfully');
  return true;
}

// Main execution logic
function main() {
  // Set environment
  process.env.NODE_ENV = options.env || 'test';
  
  // Handle commands
  switch (command) {
    case 'unit':
      const unitSuccess = runUnitTests();
      process.exit(unitSuccess ? 0 : 1);
      break;
      
    case 'integration':
      const integrationSuccess = runIntegrationTests();
      process.exit(integrationSuccess ? 0 : 1);
      break;
      
    case 'e2e':
      const e2eSuccess = runE2ETests();
      process.exit(e2eSuccess ? 0 : 1);
      break;
      
    case 'load':
      const loadSuccess = runLoadTests();
      process.exit(loadSuccess ? 0 : 1);
      break;
      
    case 'security':
      const securitySuccess = runSecurityTests();
      process.exit(securitySuccess ? 0 : 1);
      break;
      
    case 'all':
      const allSuccess = runAllTests();
      process.exit(allSuccess ? 0 : 1);
      break;
      
    case 'coverage':
      const coverageSuccess = generateCoverageReport();
      process.exit(coverageSuccess ? 0 : 1);
      break;
      
    case 'lint':
      const lintSuccess = runLinting();
      process.exit(lintSuccess ? 0 : 1);
      break;
      
    case 'clean':
      const cleanSuccess = cleanTestArtifacts();
      process.exit(cleanSuccess ? 0 : 1);
      break;
      
    default:
      printColor('red', `Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  runUnitTests,
  runIntegrationTests,
  runE2ETests,
  runLoadTests,
  runSecurityTests,
  runAllTests,
  generateCoverageReport,
  runLinting,
  cleanTestArtifacts
};