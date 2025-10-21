/**
 * Security Test Setup File
 * 
 * This file contains the setup for security tests.
 * It includes security monitoring, vulnerability scanning, and security test utilities.
 */

import { jest } from '@jest/globals';

// Set up security test timeout
jest.setTimeout(120000);

// Mock external services to avoid security risks during testing
jest.mock('../../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

// Set up security monitoring
beforeAll(async () => {
  // Initialize security monitoring
  console.log('Setting up security test environment');
});

// Clean up security monitoring
afterAll(async () => {
  // Clean up security monitoring
  console.log('Cleaning up security test environment');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Set up security test utilities
(global as any).securityTestUtils = {
  // Helper function to create malicious input for testing
  createMaliciousInput: (type: string) => {
    switch (type) {
      case 'sql-injection':
        return "'; DROP TABLE users; --";
      case 'xss':
        return '<script>alert("XSS")</script>';
      case 'command-injection':
        return '; rm -rf /';
      case 'path-traversal':
        return '../../../etc/passwd';
      case 'ldap-injection':
        return '*)(&';
      case 'nosql-injection':
        return '{"$gt": ""}';
      case 'buffer-overflow':
        return 'A'.repeat(10000);
      case 'null-byte':
        return '\x00';
      case 'unicode-exploit':
        return '\uFEFF';
      default:
        return '';
    }
  },
  
  // Helper function to test input validation
  testInputValidation: (input: string, validator: Function) => {
    try {
      const result = validator(input);
      return {
        valid: true,
        result,
        error: null
      };
    } catch (error) {
      return {
        valid: false,
        result: null,
        error: (error as Error).message
      };
    }
  },
  
  // Helper function to test authentication bypass
  testAuthenticationBypass: (authFunction: Function, credentials: any) => {
    try {
      const result = authFunction(credentials);
      return {
        bypassed: false,
        result,
        error: null
      };
    } catch (error) {
      return {
        bypassed: true,
        result: null,
        error: (error as Error).message
      };
    }
  },
  
  // Helper function to test authorization bypass
  testAuthorizationBypass: (authzFunction: Function, user: any, resource: any) => {
    try {
      const result = authzFunction(user, resource);
      return {
        bypassed: false,
        result,
        error: null
      };
    } catch (error) {
      return {
        bypassed: true,
        result: null,
        error: (error as Error).message
      };
    }
  },
  
  // Helper function to test rate limiting
  testRateLimiting: async (rateLimitFunction: Function, requests: any[]) => {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await rateLimitFunction(request);
        results.push({
          allowed: true,
          result,
          error: null
        });
      } catch (error) {
        results.push({
          allowed: false,
          result: null,
          error: (error as Error).message
        });
      }
    }
    
    return results;
  },
  
  // Helper function to test data encryption
  testDataEncryption: (encryptFunction: Function, decryptFunction: Function, data: any) => {
    try {
      const encrypted = encryptFunction(data);
      const decrypted = decryptFunction(encrypted);
      
      return {
        encrypted: true,
        decrypted: true,
        dataMatch: JSON.stringify(data) === JSON.stringify(decrypted),
        error: null
      };
    } catch (error) {
      return {
        encrypted: false,
        decrypted: false,
        dataMatch: false,
        error: (error as Error).message
      };
    }
  },
  
  // Helper function to test session security
  testSessionSecurity: (sessionFunction: Function, sessionData: any) => {
    try {
      const session = sessionFunction(sessionData);
      
      return {
        secure: true,
        session,
        error: null
      };
    } catch (error) {
      return {
        secure: false,
        session: null,
        error: (error as Error).message
      };
    }
  },
  
  // Helper function to test for resource exhaustion
  testResourceExhaustion: async (resourceFunction: Function, iterations: number) => {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();
      
      try {
        const result = await resourceFunction(i);
        
        const endTime = performance.now();
        const memoryAfter = process.memoryUsage();
        
        results.push({
          iteration: i,
          success: true,
          result,
          executionTime: endTime - startTime,
          memoryUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          error: null
        });
      } catch (error) {
        const endTime = performance.now();
        const memoryAfter = process.memoryUsage();
        
        results.push({
          iteration: i,
          success: false,
          result: null,
          executionTime: endTime - startTime,
          memoryUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          error: (error as Error).message
        });
      }
    }
    
    return results;
  },
  
  // Helper function to generate security test report
  generateSecurityTestReport: (testName: string, results: any) => {
    return {
      testName,
      timestamp: new Date(),
      results,
      vulnerabilities: results.filter((r: any) => !r.success || r.bypassed || !r.valid || !r.secure),
      securityScore: Math.max(0, 100 - (results.filter((r: any) => !r.success || r.bypassed || !r.valid || !r.secure).length * 10))
    };
  }
};

export default (global as any).securityTestUtils;