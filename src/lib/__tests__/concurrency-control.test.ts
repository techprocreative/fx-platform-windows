// Mock the concurrency control functions from backtest route
const runningBacktests = new Map<string, {
  userId: string;
  strategyId: string;
  startTime: Date;
  lockId: string;
}>();

const MAX_CONCURRENT_BACKTESTS_PER_USER = 2;
const MAX_CONCURRENT_BACKTESTS_TOTAL = 10;
const BACKTEST_LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function acquireBacktestLock(userId: string, strategyId: string): string | null {
  // Clean up expired locks
  cleanupExpiredLocks();
  
  // Check user-specific concurrent limits
  const userRunningBacktests = Array.from(runningBacktests.values())
    .filter(backtest => backtest.userId === userId);
  
  if (userRunningBacktests.length >= MAX_CONCURRENT_BACKTESTS_PER_USER) {
    return null;
  }
  
  // Check total concurrent limits
  if (runningBacktests.size >= MAX_CONCURRENT_BACKTESTS_TOTAL) {
    return null;
  }
  
  // Check if there's already a running backtest for this strategy
  const existingBacktest = Array.from(runningBacktests.values())
    .find(backtest => backtest.strategyId === strategyId);
  
  if (existingBacktest) {
    return null;
  }
  
  // Generate unique lock ID
  const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Acquire lock
  runningBacktests.set(lockId, {
    userId,
    strategyId,
    startTime: new Date(),
    lockId,
  });
  
  return lockId;
}

function releaseBacktestLock(lockId: string): void {
  const backtest = runningBacktests.get(lockId);
  if (backtest) {
    runningBacktests.delete(lockId);
  }
}

function cleanupExpiredLocks(): void {
  const now = Date.now();
  const expiredLocks: string[] = [];
  
  runningBacktests.forEach((backtest, lockId) => {
    if (now - backtest.startTime.getTime() > BACKTEST_LOCK_TIMEOUT) {
      expiredLocks.push(lockId);
    }
  });
  
  expiredLocks.forEach(lockId => {
    runningBacktests.delete(lockId);
  });
}

// Mock date for testing
const mockDate = new Date('2024-01-01T00:00:00Z');
const originalDate = Date.now;
Date.now = () => mockDate.getTime();

describe('Concurrency Control', () => {
  beforeEach(() => {
    // Clear all locks before each test
    runningBacktests.clear();
  });

  afterAll(() => {
    // Restore original Date.now
    Date.now = originalDate;
  });

  describe('acquireBacktestLock', () => {
    it('should acquire lock for new backtest', () => {
      const lockId = acquireBacktestLock('user1', 'strategy1');
      expect(lockId).toBeTruthy();
      expect(typeof lockId).toBe('string');
      expect(runningBacktests.size).toBe(1);
    });

    it('should reject multiple backtests for same strategy', () => {
      const lockId1 = acquireBacktestLock('user1', 'strategy1');
      const lockId2 = acquireBacktestLock('user1', 'strategy1');
      
      expect(lockId1).toBeTruthy();
      expect(lockId2).toBeNull();
      expect(runningBacktests.size).toBe(1);
    });

    it('should allow backtests for different strategies', () => {
      const lockId1 = acquireBacktestLock('user1', 'strategy1');
      const lockId2 = acquireBacktestLock('user1', 'strategy2');
      
      expect(lockId1).toBeTruthy();
      expect(lockId2).toBeTruthy();
      expect(runningBacktests.size).toBe(2);
    });

    it('should enforce per-user concurrent limit', () => {
      const lockId1 = acquireBacktestLock('user1', 'strategy1');
      const lockId2 = acquireBacktestLock('user1', 'strategy2');
      const lockId3 = acquireBacktestLock('user1', 'strategy3');
      
      expect(lockId1).toBeTruthy();
      expect(lockId2).toBeTruthy();
      expect(lockId3).toBeNull(); // Exceeds per-user limit
      expect(runningBacktests.size).toBe(2);
    });

    it('should allow backtests from different users', () => {
      const lockId1 = acquireBacktestLock('user1', 'strategy1');
      const lockId2 = acquireBacktestLock('user2', 'strategy1');
      
      expect(lockId1).toBeTruthy();
      expect(lockId2).toBeTruthy();
      expect(runningBacktests.size).toBe(2);
    });

    it('should enforce total concurrent limit', () => {
      const lockIds: string[] = [];
      
      // Fill up to the total limit
      for (let i = 0; i < MAX_CONCURRENT_BACKTESTS_TOTAL; i++) {
        const lockId = acquireBacktestLock(`user${i}`, `strategy${i}`);
        if (lockId) lockIds.push(lockId);
      }
      
      expect(lockIds.length).toBe(MAX_CONCURRENT_BACKTESTS_TOTAL);
      
      // Try to add one more
      const extraLockId = acquireBacktestLock('extraUser', 'extraStrategy');
      expect(extraLockId).toBeNull();
      expect(runningBacktests.size).toBe(MAX_CONCURRENT_BACKTESTS_TOTAL);
    });
  });

  describe('releaseBacktestLock', () => {
    it('should release existing lock', () => {
      const lockId = acquireBacktestLock('user1', 'strategy1');
      expect(runningBacktests.size).toBe(1);
      
      releaseBacktestLock(lockId!);
      expect(runningBacktests.size).toBe(0);
    });

    it('should handle releasing non-existent lock', () => {
      const initialSize = runningBacktests.size;
      
      releaseBacktestLock('non-existent-lock');
      expect(runningBacktests.size).toBe(initialSize);
    });

    it('should allow new backtest after releasing', () => {
      const lockId1 = acquireBacktestLock('user1', 'strategy1');
      expect(lockId1).toBeTruthy();
      
      releaseBacktestLock(lockId1!);
      
      const lockId2 = acquireBacktestLock('user1', 'strategy1');
      expect(lockId2).toBeTruthy();
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should clean up expired locks', () => {
      const lockId = acquireBacktestLock('user1', 'strategy1');
      expect(runningBacktests.size).toBe(1);
      
      // Simulate time passage beyond timeout
      const pastDate = new Date(mockDate.getTime() - BACKTEST_LOCK_TIMEOUT - 1000);
      const backtest = runningBacktests.get(lockId!);
      if (backtest) {
        backtest.startTime = pastDate;
      }
      
      cleanupExpiredLocks();
      expect(runningBacktests.size).toBe(0);
    });

    it('should not clean up active locks', () => {
      const lockId = acquireBacktestLock('user1', 'strategy1');
      expect(runningBacktests.size).toBe(1);
      
      cleanupExpiredLocks();
      expect(runningBacktests.size).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed user and strategy scenarios', () => {
      // User 1 starts backtest for strategy 1
      const lock1 = acquireBacktestLock('user1', 'strategy1');
      expect(lock1).toBeTruthy();
      
      // User 2 tries same strategy - should succeed
      const lock2 = acquireBacktestLock('user2', 'strategy1');
      expect(lock2).toBeTruthy();
      
      // User 1 tries different strategy - should succeed
      const lock3 = acquireBacktestLock('user1', 'strategy2');
      expect(lock3).toBeTruthy();
      
      // User 1 tries another strategy - should fail (per-user limit)
      const lock4 = acquireBacktestLock('user1', 'strategy3');
      expect(lock4).toBeNull();
      
      // User 2 tries same strategy - should fail (strategy already running)
      const lock5 = acquireBacktestLock('user2', 'strategy1');
      expect(lock5).toBeNull();
      
      expect(runningBacktests.size).toBe(3);
    });

    it('should handle lock release and reuse correctly', () => {
      const lock1 = acquireBacktestLock('user1', 'strategy1');
      const lock2 = acquireBacktestLock('user1', 'strategy2');
      
      expect(runningBacktests.size).toBe(2);
      
      // Release first lock
      releaseBacktestLock(lock1!);
      expect(runningBacktests.size).toBe(1);
      
      // Should be able to start new backtest for same strategy
      const lock3 = acquireBacktestLock('user1', 'strategy1');
      expect(lock3).toBeTruthy();
      expect(runningBacktests.size).toBe(2);
    });
  });
});