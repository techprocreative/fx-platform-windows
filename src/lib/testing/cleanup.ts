/**
 * Test Cleanup Utilities
 * 
 * This file provides utilities for cleaning up test data
 * after test execution to ensure a clean test environment.
 */

import { prisma } from '../prisma';

export class TestCleanup {
  /**
   * Clean up all test data in the correct order
   * to respect foreign key constraints
   */
  static async cleanupAll() {
    try {
      // Clean up in order of dependencies
      await this.cleanupAuditLogs();
      await this.cleanupTrades();
      await this.cleanupBacktests();
      await this.cleanupStrategies();
      await this.cleanupRiskLimits();
      await this.cleanupMarketData();
      await this.cleanupUsers();
      
      console.log('✅ All test data cleaned up successfully');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Clean up all data for a specific user
   */
  static async cleanupUser(userId: string) {
    try {
      await this.cleanupAuditLogsForUser(userId);
      await this.cleanupTradesForUser(userId);
      await this.cleanupBacktestsForUser(userId);
      await this.cleanupStrategiesForUser(userId);
      await this.cleanupRiskLimitsForUser(userId);
      
      // Finally delete the user
      await prisma.user.delete({
        where: { id: userId }
      });
      
      console.log(`✅ Cleaned up all data for user: ${userId}`);
    } catch (error) {
      console.error(`❌ Error cleaning up user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up audit logs
   */
  static async cleanupAuditLogs() {
    await prisma.auditLog.deleteMany({});
  }

  /**
   * Clean up audit logs for a specific user
   */
  static async cleanupAuditLogsForUser(userId: string) {
    await prisma.auditLog.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up trades
   */
  static async cleanupTrades() {
    await prisma.trade.deleteMany({});
  }

  /**
   * Clean up trades for a specific user
   */
  static async cleanupTradesForUser(userId: string) {
    await prisma.trade.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up backtests
   */
  static async cleanupBacktests() {
    await prisma.backtest.deleteMany({});
  }

  /**
   * Clean up backtests for a specific user
   */
  static async cleanupBacktestsForUser(userId: string) {
    await prisma.backtest.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up strategies
   */
  static async cleanupStrategies() {
    await prisma.strategy.deleteMany({});
  }

  /**
   * Clean up strategies for a specific user
   */
  static async cleanupStrategiesForUser(userId: string) {
    await prisma.strategy.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up risk limits
   */
  static async cleanupRiskLimits() {
    // Note: This table name might need to be adjusted based on your schema
    // Assuming it's called 'riskLimit' in Prisma
    try {
      await (prisma as any).riskLimit.deleteMany({});
    } catch (error) {
      console.warn('Risk limits table might not exist or have different name:', error);
    }
  }

  /**
   * Clean up risk limits for a specific user
   */
  static async cleanupRiskLimitsForUser(userId: string) {
    try {
      await (prisma as any).riskLimit.deleteMany({
        where: { userId }
      });
    } catch (error) {
      console.warn('Risk limits table might not exist or have different name:', error);
    }
  }

  /**
   * Clean up market data
   */
  static async cleanupMarketData() {
    try {
      await prisma.marketData.deleteMany({});
    } catch (error) {
      console.warn('Market data table might not exist:', error);
    }
  }

  /**
   * Clean up users
   */
  static async cleanupUsers() {
    // Only delete test users (those with test email domains)
    const testEmailDomains = ['example.com', 'test.com', 'test.org'];
    
    for (const domain of testEmailDomains) {
      await prisma.user.deleteMany({
        where: {
          email: {
            endsWith: `@${domain}`
          }
        }
      });
    }
  }

  /**
   * Clean up data older than specified number of days
   */
  static async cleanupOldData(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      // Note: Be careful with deleting other data as it might be important
      console.log(`✅ Cleaned up data older than ${daysOld} days`);
    } catch (error) {
      console.error(`❌ Error cleaning up old data:`, error);
      throw error;
    }
  }

  /**
   * Reset database to clean state (for test environments only)
   */
  static async resetDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database reset can only be performed in test environment');
    }

    try {
      // Get all table names
      const tableNames = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      
      // Disable foreign key constraints
      await prisma.$executeRaw`SET session_replication_role = replica;`;
      
      // Truncate all tables
      for (const table of tableNames as any[]) {
        const tableName = table.tablename;
        if (tableName !== '_prisma_migrations') {
          await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
        }
      }
      
      // Re-enable foreign key constraints
      await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
      
      console.log('✅ Database reset to clean state');
    } catch (error) {
      console.error('❌ Error resetting database:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned records (records with invalid foreign keys)
   */
  static async cleanupOrphanedRecords() {
    try {
      // Clean up trades with invalid strategy or user references
      await prisma.$executeRaw`
        DELETE FROM trades 
        WHERE strategy_id NOT IN (SELECT id FROM strategies)
        OR user_id NOT IN (SELECT id FROM users)
      `;

      // Clean up backtests with invalid strategy or user references
      await prisma.$executeRaw`
        DELETE FROM backtests 
        WHERE strategy_id NOT IN (SELECT id FROM strategies)
        OR user_id NOT IN (SELECT id FROM users)
      `;

      // Clean up strategies with invalid user references
      await prisma.$executeRaw`
        DELETE FROM strategies 
        WHERE user_id NOT IN (SELECT id FROM users)
      `;

      console.log('✅ Cleaned up orphaned records');
    } catch (error) {
      console.error('❌ Error cleaning up orphaned records:', error);
      throw error;
    }
  }

  /**
   * Get statistics about test data
   */
  static async getTestDataStats() {
    try {
      const stats = {
        users: await prisma.user.count(),
        strategies: await prisma.strategy.count(),
        backtests: await prisma.backtest.count(),
        trades: await prisma.trade.count(),
        auditLogs: await prisma.auditLog.count()
      };

      return stats;
    } catch (error) {
      console.error('❌ Error getting test data stats:', error);
      throw error;
    }
  }

  /**
   * Verify cleanup was successful
   */
  static async verifyCleanup() {
    try {
      const stats = await this.getTestDataStats();
      
      // Check if we have only expected test data
      const testUserCount = await prisma.user.count({
        where: {
          email: {
            endsWith: '@example.com'
          }
        }
      });

      console.log('📊 Test data statistics:', stats);
      console.log(`📊 Test users found: ${testUserCount}`);

      // Return true if cleanup looks good
      return testUserCount === 0 || 
             (stats.strategies === 0 && 
              stats.backtests === 0 && 
              stats.trades === 0);
    } catch (error) {
      console.error('❌ Error verifying cleanup:', error);
      return false;
    }
  }

  /**
   * Clean up specific test data by ID
   */
  static async cleanupSpecificData(type: string, ids: string[]) {
    try {
      switch (type.toLowerCase()) {
        case 'user':
          for (const id of ids) {
            await this.cleanupUser(id);
          }
          break;
        case 'strategy':
          await prisma.strategy.deleteMany({
            where: {
              id: {
                in: ids
              }
            }
          });
          break;
        case 'backtest':
          await prisma.backtest.deleteMany({
            where: {
              id: {
                in: ids
              }
            }
          });
          break;
        case 'trade':
          await prisma.trade.deleteMany({
            where: {
              id: {
                in: ids
              }
            }
          });
          break;
        default:
          throw new Error(`Unknown cleanup type: ${type}`);
      }
      
      console.log(`✅ Cleaned up ${type} data for IDs: ${ids.join(', ')}`);
    } catch (error) {
      console.error(`❌ Error cleaning up ${type} data:`, error);
      throw error;
    }
  }

  /**
   * Clean up data by date range
   */
  static async cleanupByDateRange(type: string, startDate: Date, endDate: Date) {
    try {
      switch (type.toLowerCase()) {
        case 'auditlog':
          await prisma.auditLog.deleteMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        case 'trade':
          await prisma.trade.deleteMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        case 'backtest':
          await prisma.backtest.deleteMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        default:
          throw new Error(`Cannot cleanup ${type} by date range`);
      }
      
      console.log(`✅ Cleaned up ${type} data from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } catch (error) {
      console.error(`❌ Error cleaning up ${type} by date range:`, error);
      throw error;
    }
  }
}