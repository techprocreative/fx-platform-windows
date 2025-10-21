/**
 * Load Test Setup File
 * 
 * This file contains the setup for load tests.
 * It includes performance monitoring, resource tracking, and load test utilities.
 */

import { jest } from '@jest/globals';

// Set up load test timeout
jest.setTimeout(300000);

// Mock external services to avoid performance impact
jest.mock('../../realtime/pusher-service', () => ({
  pusherService: {
    trigger: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
}));

// Set up performance monitoring
beforeAll(async () => {
  // Initialize performance monitoring
  console.log('Setting up load test environment');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Clean up performance monitoring
afterAll(async () => {
  // Clean up performance monitoring
  console.log('Cleaning up load test environment');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Set up load test utilities
(global as any).loadTestUtils = {
  // Helper function to measure execution time
  measureExecutionTime: async (fn: Function, iterations: number = 1) => {
    const results = [];
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const result = await fn();
      const endTime = performance.now();
      
      results.push(result);
      times.push(endTime - startTime);
    }
    
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      results,
      times,
      totalTime,
      averageTime,
      minTime,
      maxTime
    };
  },
  
  // Helper function to measure memory usage
  measureMemoryUsage: async (fn: Function) => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryBefore = process.memoryUsage();
    const result = await fn();
    const memoryAfter = process.memoryUsage();
    
    return {
      result,
      memoryBefore,
      memoryAfter,
      memoryUsed: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external
      }
    };
  },
  
  // Helper function to create load test data
  createLoadTestData: (count: number, factory: Function) => {
    return Array.from({ length: count }, (_, i) => factory(i));
  },
  
  // Helper function to run concurrent operations
  runConcurrentOperations: async (operations: Function[], concurrency: number = 10) => {
    const results = [];
    
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  },
  
  // Helper function to monitor system resources
  monitorSystemResources: () => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: new Date()
    };
  },
  
  // Helper function to generate load test report
  generateLoadTestReport: (testName: string, metrics: any) => {
    return {
      testName,
      timestamp: new Date(),
      metrics,
      systemResources: (global as any).loadTestUtils.monitorSystemResources()
    };
  }
};

export default (global as any).loadTestUtils;