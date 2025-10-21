# 🧪 FX Trading Platform - Testing Strategy & Procedures

## Overview

This document outlines the comprehensive testing strategy for the FX Trading Platform. Our testing approach ensures high-quality, reliable, and secure software through multiple layers of testing, from unit tests to end-to-end testing.

## Testing Philosophy

### Core Principles
1. **Test Early, Test Often**: Integrate testing throughout the development lifecycle
2. **Automate Everything**: Automate repetitive testing tasks for efficiency
3. **Coverage Matters**: Aim for high test coverage across all critical components
4. **Quality is Everyone's Responsibility**: Developers write tests for their code
5. **Continuous Testing**: Run tests automatically in CI/CD pipeline

### Testing Pyramid

```
    /\
   /  \     E2E Tests (10%)
  /____\    
 /      \   Integration Tests (20%)
/__________\ Unit Tests (70%)
```

- **Unit Tests (70%)**: Fast, isolated tests for individual functions/components
- **Integration Tests (20%)**: Tests for component interactions and API endpoints
- **E2E Tests (10%)**: Full application workflow tests

## Test Types

### 1. Unit Testing

#### Purpose
- Test individual functions and components in isolation
- Verify business logic correctness
- Ensure code reliability at the smallest unit level

#### Tools & Frameworks
- **Jest**: Primary testing framework
- **React Testing Library**: Component testing
- **ts-jest**: TypeScript support

#### Coverage Requirements
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 80,
    statements: 80
  },
  // Critical modules have higher requirements
  './src/lib/utils.ts': {
    branches: 90,
    functions: 90,
    lines: 95,
    statements: 95
  },
  './src/lib/risk/': {
    branches: 80,
    functions: 80,
    lines: 85,
    statements: 85
  }
}
```

#### Example Unit Test
```typescript
// src/lib/utils/__tests__/utils.test.ts
import { calculatePipValue, formatCurrency } from '../utils';

describe('Utils', () => {
  describe('calculatePipValue', () => {
    it('should calculate pip value for EURUSD correctly', () => {
      const result = calculatePipValue('EURUSD', 1.0, 0.0001);
      expect(result).toBe(0.0001);
    });

    it('should calculate pip value for USDJPY correctly', () => {
      const result = calculatePipValue('USDJPY', 1.0, 0.01);
      expect(result).toBe(0.01);
    });

    it('should throw error for invalid symbol', () => {
      expect(() => {
        calculatePipValue('INVALID', 1.0, 0.0001);
      }).toThrow('Invalid trading symbol');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with 2 decimal places', () => {
      const result = formatCurrency(1234.567, 'USD');
      expect(result).toBe('$1,234.57');
    });
  });
});
```

### 2. Integration Testing

#### Purpose
- Test component interactions
- Verify API endpoint functionality
- Test database operations
- Validate external service integrations

#### Test Scenarios
- API endpoint testing
- Database operations
- Authentication flows
- WebSocket connections
- Third-party service integrations

#### Example Integration Test
```typescript
// src/lib/__tests__/strategy.integration.test.ts
import { request } from 'supertest';
import { app } from '../../app';
import { prisma } from '../prisma';

describe('Strategy Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup test user and authentication
    const user = await createTestUser();
    userId = user.id;
    authToken = generateTestToken(user);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({ where: { id: userId } });
  });

  describe('POST /api/strategy', () => {
    it('should create a new strategy', async () => {
      const strategyData = {
        name: 'Test Strategy',
        type: 'manual',
        config: {
          symbol: 'EURUSD',
          timeframe: '1h',
          riskPercent: 2
        }
      };

      const response = await request(app)
        .post('/api/strategy')
        .set('Authorization', `Bearer ${authToken}`)
        .send(strategyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(strategyData.name);
      expect(response.body.data.userId).toBe(userId);
    });

    it('should reject unauthorized requests', async () => {
      const strategyData = {
        name: 'Test Strategy',
        type: 'manual'
      };

      await request(app)
        .post('/api/strategy')
        .send(strategyData)
        .expect(401);
    });
  });
});
```

### 3. End-to-End Testing

#### Purpose
- Test complete user workflows
- Verify application functionality from user perspective
- Test cross-browser compatibility
- Validate critical user journeys

#### Tools & Frameworks
- **Playwright**: E2E testing framework
- **Cypress**: Alternative E2E framework
- **BrowserStack**: Cross-browser testing

#### Test Scenarios
- User registration and login
- Strategy creation and execution
- Trading workflow
- Backtesting process
- Risk management

#### Example E2E Test
```typescript
// tests/e2e/trading-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Trading Workflow', () => {
  test('user can create and execute a trade', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Navigate to trading
    await page.click('[data-testid=trading-tab]');
    await page.waitForSelector('[data-testid=trading-panel]');
    
    // Select symbol
    await page.selectOption('[data-testid=symbol-select]', 'EURUSD');
    
    // Set trade parameters
    await page.fill('[data-testid=lot-size]', '0.1');
    await page.fill('[data-testid=stop-loss]', '1.0800');
    await page.fill('[data-testid=take-profit]', '1.0900');
    
    // Execute trade
    await page.click('[data-testid=buy-button]');
    
    // Verify trade execution
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    await expect(page.locator('[data-testid=position-table]')).toContainText('EURUSD');
  });

  test('risk management prevents excessive trades', async ({ page }) => {
    // Setup user with risk limits
    await setupUserWithRiskLimits(page);
    
    // Attempt to exceed risk limits
    await page.goto('/trading');
    await page.fill('[data-testid=lot-size]', '10.0'); // Excessive size
    await page.click('[data-testid=buy-button]');
    
    // Verify risk rejection
    await expect(page.locator('[data-testid=risk-error]')).toBeVisible();
    await expect(page.locator('[data-testid=risk-error]')).toContainText('Risk limit exceeded');
  });
});
```

### 4. Performance Testing

#### Purpose
- Measure application performance under load
- Identify performance bottlenecks
- Ensure scalability requirements are met

#### Performance Metrics
- **Response Time**: <500ms for API calls
- **Page Load Time**: <3s for initial load
- **Throughput**: 1000+ requests per minute
- **Memory Usage**: <512MB for normal operations

#### Load Testing Script
```typescript
// tests/load/api-load-test.ts
import { check, sleep } from 'k6';
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  let response = http.post('http://localhost:3000/api/strategy', {
    name: 'Load Test Strategy',
    type: 'manual',
    config: { symbol: 'EURUSD' }
  }, {
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### 5. Security Testing

#### Purpose
- Identify security vulnerabilities
- Validate authentication and authorization
- Test input validation and sanitization
- Verify data protection measures

#### Security Test Scenarios
- SQL injection prevention
- XSS protection
- Authentication bypass attempts
- Authorization testing
- Input validation testing

#### Security Test Example
```typescript
// tests/security/security-penetration.test.ts
import { request } from 'supertest';
import { app } from '../../app';

describe('Security Tests', () => {
  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in strategy name', async () => {
      const maliciousInput = "'; DROP TABLE strategies; --";
      
      const response = await request(app)
        .post('/api/strategy')
        .send({
          name: maliciousInput,
          type: 'manual'
        })
        .expect(400); // Should be rejected

      // Verify strategies table still exists
      const strategies = await request(app)
        .get('/api/strategy')
        .expect(200);
      
      expect(strategies.body.success).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML in strategy descriptions', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/strategy')
        .send({
          name: 'Test Strategy',
          description: xssPayload,
          type: 'manual'
        })
        .expect(201);

      // Verify script tags are sanitized
      expect(response.body.data.description).not.toContain('<script>');
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests with invalid tokens', async () => {
      const response = await request(app)
        .get('/api/strategy')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });
});
```

## Test Environment Setup

### Test Database
```bash
# Create test database
createdb fx_platform_test

# Set test environment variable
export DATABASE_URL="postgresql://postgres:password@localhost:5432/fx_platform_test"

# Run test migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Test Configuration
```typescript
// src/lib/testing/test-setup.ts
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

// Mock external services
jest.mock('../lib/pusher', () => ({
  trigger: jest.fn(),
  authenticate: jest.fn(),
}));

jest.mock('../lib/twelve-data', () => ({
  getQuote: jest.fn(),
  getTimeSeries: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  createTestUser: async () => {
    // Create test user logic
  },
  generateTestToken: (user) => {
    // Generate JWT token for testing
  },
  cleanupTestData: async () => {
    // Clean up test data
  }
};
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Test Data Management

### Test Data Factory
```typescript
// src/lib/testing/factory.ts
import { faker } from '@faker-js/faker';
import { prisma } from '../prisma';

export class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      ...overrides
    };
  }

  static createStrategy(overrides = {}) {
    return {
      name: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      type: 'manual',
      config: {
        symbol: 'EURUSD',
        timeframe: '1h',
        riskPercent: 2
      },
      ...overrides
    };
  }

  static async createTestUser(data = {}) {
    return await prisma.user.create({
      data: this.createUser(data)
    });
  }

  static async createTestStrategy(userId: string, data = {}) {
    return await prisma.strategy.create({
      data: {
        ...this.createStrategy(data),
        userId
      }
    });
  }
}
```

### Test Cleanup
```typescript
// src/lib/testing/cleanup.ts
import { prisma } from '../prisma';

export class TestCleanup {
  static async cleanupAll() {
    // Clean up in order of dependencies
    await prisma.auditLog.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.backtest.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.riskLimit.deleteMany();
    await prisma.user.deleteMany();
  }

  static async cleanupUser(userId: string) {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.trade.deleteMany({ where: { userId } });
    await prisma.backtest.deleteMany({ where: { userId } });
    await prisma.strategy.deleteMany({ where: { userId } });
    await prisma.riskLimit.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
}
```

## Test Reporting

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

### Test Results Dashboard
- **Unit Tests**: Jest HTML Reporter
- **Integration Tests**: Custom dashboard
- **E2E Tests**: Playwright HTML Report
- **Performance Tests**: K6 HTML Report

## Best Practices

### Writing Good Tests
1. **Arrange, Act, Assert**: Structure tests clearly
2. **Descriptive Names**: Use descriptive test names
3. **Independent Tests**: Tests should not depend on each other
4. **Mock External Dependencies**: Isolate tests from external services
5. **Test Edge Cases**: Test boundary conditions and error scenarios

### Test Maintenance
1. **Regular Updates**: Keep tests updated with code changes
2. **Refactor Tests**: Refactor tests for better maintainability
3. **Remove Redundant Tests**: Remove duplicate or unnecessary tests
4. **Performance Monitoring**: Monitor test execution time

### Code Coverage
1. **Focus on Critical Paths**: Prioritize testing critical business logic
2. **Aim for Meaningful Coverage**: Focus on quality over quantity
3. **Review Coverage Reports**: Regularly review coverage reports
4. **Set Realistic Targets**: Set achievable coverage targets

## Troubleshooting

### Common Test Issues
1. **Flaky Tests**: Tests that pass/fail inconsistently
2. **Timeout Issues**: Tests taking too long to execute
3. **Memory Leaks**: Tests causing memory issues
4. **Dependency Issues**: Tests failing due to external dependencies

### Debugging Tests
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests with verbose output
npm test -- --verbose

# Run tests with coverage for specific file
npm test -- --coverage --collectCoverageFrom=path/to/file.ts
```

---

**Last Updated**: 2024-01-20  
**Version**: 1.0.0  
**Test Lead**: QA Team

---

*This testing strategy is maintained by the FX Trading Platform QA team. For questions or updates, please contact the QA team.*