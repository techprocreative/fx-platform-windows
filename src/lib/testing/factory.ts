/**
 * Test Data Factory
 * 
 * This file provides factory functions for creating test data
 * for the FX Trading Platform testing suite.
 */

import { faker } from '@faker-js/faker';
import { prisma } from '../prisma';

export class TestDataFactory {
  /**
   * Generate user data for testing
   */
  static createUser(overrides: Partial<any> = {}) {
    return {
      email: faker.internet.email(),
      username: faker.internet.username(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: faker.internet.password({ length: 12 }),
      role: 'user',
      status: 'active',
      emailVerified: new Date(),
      twoFactorEnabled: false,
      preferences: {},
      ...overrides
    };
  }

  /**
   * Generate strategy data for testing
   */
  static createStrategy(overrides: Partial<any> = {}) {
    return {
      name: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      type: 'manual',
      status: 'active',
      config: {
        symbol: 'EURUSD',
        timeframe: '1h',
        riskPercent: 2,
        stopLossPips: 20,
        takeProfitPips: 40
      },
      performanceMetrics: {
        totalReturn: faker.number.float({ min: -50, max: 100, fractionDigits: 2 }),
        winRate: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
        profitFactor: faker.number.float({ min: 0.5, max: 3, fractionDigits: 2 }),
        maxDrawdown: faker.number.float({ min: 0, max: 30, fractionDigits: 2 }),
        sharpeRatio: faker.number.float({ min: -1, max: 3, fractionDigits: 2 })
      },
      tags: [faker.lorem.word(), faker.lorem.word()],
      version: 1,
      isPublic: false,
      ...overrides
    };
  }

  /**
   * Generate backtest data for testing
   */
  static createBacktest(overrides: Partial<any> = {}) {
    return {
      name: faker.lorem.words(3),
      status: 'completed',
      progress: 100,
      config: {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        initialCapital: 10000,
        commission: 0.0001,
        slippage: 2
      },
      results: {
        totalReturn: faker.number.float({ min: -50, max: 100, fractionDigits: 2 }),
        winRate: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
        profitFactor: faker.number.float({ min: 0.5, max: 3, fractionDigits: 2 }),
        maxDrawdown: faker.number.float({ min: 0, max: 30, fractionDigits: 2 }),
        sharpeRatio: faker.number.float({ min: -1, max: 3, fractionDigits: 2 }),
        totalTrades: faker.number.int({ min: 10, max: 500 }),
        winningTrades: faker.number.int({ min: 0, max: 250 }),
        losingTrades: faker.number.int({ min: 0, max: 250 })
      },
      performanceMetrics: {
        averageWin: faker.number.float({ min: 10, max: 100, fractionDigits: 2 }),
        averageLoss: faker.number.float({ min: -100, max: -10, fractionDigits: 2 }),
        largestWin: faker.number.float({ min: 100, max: 500, fractionDigits: 2 }),
        largestLoss: faker.number.float({ min: -500, max: -100, fractionDigits: 2 }),
        averageTrade: faker.number.float({ min: -50, max: 50, fractionDigits: 2 })
      },
      trades: [],
      equityCurve: [],
      startedAt: faker.date.past(),
      completedAt: faker.date.recent(),
      ...overrides
    };
  }

  /**
   * Generate trade data for testing
   */
  static createTrade(overrides: Partial<any> = {}) {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD'];
    const types = ['buy', 'sell'];
    const statuses = ['pending', 'executed', 'cancelled', 'rejected'];
    const orderTypes = ['market', 'limit', 'stop', 'stop_limit'];

    return {
      symbol: faker.helpers.arrayElement(symbols),
      type: faker.helpers.arrayElement(types),
      orderType: faker.helpers.arrayElement(orderTypes),
      quantity: faker.number.float({ min: 0.01, max: 10, fractionDigits: 2 }),
      price: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      stopLoss: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      takeProfit: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      commission: faker.number.float({ min: 0, max: 10, fractionDigits: 2 }),
      swap: faker.number.float({ min: -5, max: 5, fractionDigits: 2 }),
      profit: faker.number.float({ min: -1000, max: 1000, fractionDigits: 2 }),
      status: faker.helpers.arrayElement(statuses),
      executedAt: faker.date.recent(),
      externalId: faker.string.alphanumeric(10),
      metadata: {},
      ...overrides
    };
  }

  /**
   * Generate risk limit data for testing
   */
  static createRiskLimit(overrides: Partial<any> = {}) {
    const types = ['daily_loss', 'max_position', 'max_leverage', 'max_drawdown'];
    const limitTypes = ['absolute', 'percentage'];

    return {
      name: faker.lorem.words(2),
      type: faker.helpers.arrayElement(types),
      limitType: faker.helpers.arrayElement(limitTypes),
      limitValue: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
      currentValue: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      isActive: true,
      ...overrides
    };
  }

  /**
   * Generate market data for testing
   */
  static createMarketData(overrides: Partial<any> = {}) {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD'];
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

    return {
      symbol: faker.helpers.arrayElement(symbols),
      timeframe: faker.helpers.arrayElement(timeframes),
      timestamp: faker.date.recent(),
      open: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      high: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      low: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      close: faker.number.float({ min: 1.0000, max: 150.0000, fractionDigits: 4 }),
      volume: faker.number.int({ min: 100, max: 10000 }),
      ...overrides
    };
  }

  /**
   * Generate audit log data for testing
   */
  static createAuditLog(overrides: Partial<any> = {}) {
    const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'];
    const resourceTypes = ['user', 'strategy', 'trade', 'backtest', 'risk_limit'];

    return {
      action: faker.helpers.arrayElement(actions),
      resourceType: faker.helpers.arrayElement(resourceTypes),
      resourceId: faker.string.uuid(),
      oldValues: {},
      newValues: {},
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      ...overrides
    };
  }

  // Database creation methods

  /**
   * Create a test user in the database
   */
  static async createTestUser(data: Partial<any> = {}) {
    const userData = this.createUser(data);
    
    // Hash password for database
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(userData.password, 10);

    // Remove fields that don't exist in Prisma schema
    const { password, username, ...userCreateData } = userData;
    
    return await prisma.user.create({
      data: {
        ...userCreateData,
        passwordHash,
        emailVerified: userData.emailVerified || null
      }
    });
  }

  /**
   * Create a test strategy in the database
   */
  static async createTestStrategy(userId: string, data: Partial<any> = {}) {
    const strategyData = this.createStrategy(data);
    
    // Map to Prisma schema fields
    return await prisma.strategy.create({
      data: {
        userId,
        name: strategyData.name,
        description: strategyData.description,
        symbol: strategyData.config?.symbol || 'EURUSD',
        timeframe: strategyData.config?.timeframe || 'H1',
        type: strategyData.type,
        status: strategyData.status,
        rules: strategyData.config as any,
        version: strategyData.version,
        isPublic: strategyData.isPublic
      }
    });
  }

  /**
   * Create a test backtest in the database
   */
  static async createTestBacktest(strategyId: string, userId: string, data: Partial<any> = {}) {
    const backtestData = this.createBacktest(data);
    
    // Map to Prisma schema fields
    return await prisma.backtest.create({
      data: {
        strategyId,
        userId,
        status: backtestData.status,
        dateFrom: new Date(backtestData.config.startDate),
        dateTo: new Date(backtestData.config.endDate),
        initialBalance: backtestData.config.initialCapital,
        settings: backtestData.config as any,
        results: backtestData.results as any,
        completedAt: backtestData.completedAt
      }
    });
  }

  /**
   * Create a test trade in the database
   */
  static async createTestTrade(userId: string, data: Partial<any> = {}) {
    const tradeData = this.createTrade(data);
    
    // Map to Prisma schema fields
    return await prisma.trade.create({
      data: {
        userId,
        strategyId: data.strategyId || 'default-strategy',
        executorId: data.executorId || 'default-executor',
        ticket: tradeData.externalId,
        symbol: tradeData.symbol,
        type: tradeData.type.toUpperCase(),
        lots: tradeData.quantity,
        openTime: tradeData.executedAt,
        openPrice: tradeData.price,
        stopLoss: tradeData.stopLoss,
        takeProfit: tradeData.takeProfit,
        commission: tradeData.commission,
        swap: tradeData.swap,
        profit: tradeData.profit
      }
    });
  }

  /**
   * Create a test risk limit in the database
   * Note: riskLimit model doesn't exist in schema, skipping
   */
  static async createTestRiskLimit(userId: string, data: Partial<any> = {}) {
    // const riskLimitData = this.createRiskLimit(data);
    // RiskLimit model doesn't exist in Prisma schema
    console.warn('createTestRiskLimit: riskLimit model not available');
    return null;
  }

  /**
   * Create test market data in the database
   */
  static async createTestMarketData(data: Partial<any> = {}) {
    const marketData = this.createMarketData(data);
    
    return await prisma.marketData.create({
      data: marketData
    });
  }

  /**
   * Create a test audit log in the database
   */
  static async createTestAuditLog(userId: string, data: Partial<any> = {}) {
    const auditLogData = this.createAuditLog(data);
    
    // Map to Prisma schema fields
    return await prisma.auditLog.create({
      data: {
        userId,
        eventType: auditLogData.action,
        resource: auditLogData.resourceType,
        action: auditLogData.action,
        result: 'success',
        metadata: {
          resourceId: auditLogData.resourceId,
          oldValues: auditLogData.oldValues,
          newValues: auditLogData.newValues
        } as any,
        ipAddress: auditLogData.ipAddress,
        userAgent: auditLogData.userAgent
      }
    });
  }

  // Bulk creation methods

  /**
   * Create multiple test users
   */
  static async createTestUsers(count: number, data: Partial<any> = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.createTestUser({ ...data, email: `test${i}@example.com` }));
    }
    return users;
  }

  /**
   * Create multiple test strategies
   */
  static async createTestStrategies(userId: string, count: number, data: Partial<any> = {}) {
    const strategies = [];
    for (let i = 0; i < count; i++) {
      strategies.push(await this.createTestStrategy(userId, { ...data, name: `Test Strategy ${i}` }));
    }
    return strategies;
  }

  /**
   * Create multiple test trades
   */
  static async createTestTrades(userId: string, count: number, data: Partial<any> = {}) {
    const trades = [];
    for (let i = 0; i < count; i++) {
      trades.push(await this.createTestTrade(userId, data));
    }
    return trades;
  }

  /**
   * Create multiple test market data points
   */
  static async createTestMarketDataPoints(symbol: string, timeframe: string, count: number) {
    const dataPoints = [];
    const baseTimestamp = new Date();
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(baseTimestamp.getTime() - (i * 60000)); // 1 minute intervals
      dataPoints.push(await this.createTestMarketData({
        symbol,
        timeframe,
        timestamp
      }));
    }
    
    return dataPoints.reverse(); // Return in chronological order
  }

  // Scenario creation methods

  /**
   * Create a complete trading scenario with user, strategies, trades, and backtests
   */
  static async createTradingScenario(overrides: Partial<any> = {}) {
    // Create user
    const user = await this.createTestUser(overrides.user);
    
    // Create strategies
    const strategies = await this.createTestStrategies(user.id, 3, overrides.strategies);
    
    // Create trades for each strategy
    const trades = [];
    for (const strategy of strategies) {
      const strategyTrades = await this.createTestTrades(user.id, 10, {
        strategyId: strategy.id,
        ...overrides.trades
      });
      trades.push(...strategyTrades);
    }
    
    // Create backtests for each strategy
    const backtests = [];
    for (const strategy of strategies) {
      const backtest = await this.createTestBacktest(strategy.id, user.id, overrides.backtests);
      backtests.push(backtest);
    }
    
    // Create risk limits
    const riskLimits = await this.createTestRiskLimit(user.id, overrides.riskLimits);
    
    return {
      user,
      strategies,
      trades,
      backtests,
      riskLimits
    };
  }

  /**
   * Create a performance testing scenario with large dataset
   */
  static async createPerformanceTestScenario(userId: string, tradeCount: number = 1000) {
    // Create strategy
    const strategy = await this.createTestStrategy(userId);
    
    // Create large number of trades
    const trades = await this.createTestTrades(userId, tradeCount, {
      strategyId: strategy.id
    });
    
    // Create market data
    const marketData = await this.createTestMarketDataPoints('EURUSD', '1h', 1000);
    
    return {
      strategy,
      trades,
      marketData
    };
  }
}