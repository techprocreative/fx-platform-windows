/**
 * Jest Configuration
 * 
 * This file contains the Jest configuration for the FX Trading Platform test suite.
 * It includes configuration for unit tests, integration tests, end-to-end tests,
 * load tests, and security tests.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Roots for test files
  roots: ['<rootDir>/src'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Transform files with TypeScript
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/lib/testing/test-setup.ts'],
  
  // Coverage configuration
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: false,
  
  // Projects for different test types
  projects: [
    // Unit tests
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/src/**/__tests__/*.test.ts'],
      testPathIgnorePatterns: [
        '<rootDir>/src/**/__tests__/*.integration.test.ts',
        '<rootDir>/src/**/__tests__/*.e2e.test.ts',
        '<rootDir>/src/**/__tests__/*.load.test.ts',
        '<rootDir>/src/**/__tests__/*.security.test.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/src/lib/testing/test-setup.ts']
    },
    
    // Integration tests
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/src/**/__tests__/*.integration.test.ts'],
      testTimeout: 60000,
      setupFilesAfterEnv: ['<rootDir>/src/lib/testing/integration-setup.ts']
    },
    
    // End-to-end tests
    {
      displayName: 'End-to-End Tests',
      testMatch: ['<rootDir>/src/**/__tests__/*.e2e.test.ts'],
      testTimeout: 120000,
      setupFilesAfterEnv: ['<rootDir>/src/lib/testing/e2e-setup.ts']
    },
    
    // Load tests
    {
      displayName: 'Load Tests',
      testMatch: ['<rootDir>/src/**/__tests__/*.load.test.ts'],
      testTimeout: 300000,
      maxWorkers: 1, // Run load tests sequentially
      setupFilesAfterEnv: ['<rootDir>/src/lib/testing/load-setup.ts']
    },
    
    // Security tests
    {
      displayName: 'Security Tests',
      testMatch: ['<rootDir>/src/**/__tests__/*.security.test.ts'],
      testTimeout: 120000,
      setupFilesAfterEnv: ['<rootDir>/src/lib/testing/security-setup.ts']
    }
  ]
};
