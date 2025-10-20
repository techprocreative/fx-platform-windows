/**
 * Unit Tests for Utility Functions
 * 
 * These tests cover critical utility functions used throughout the application.
 */

import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  formatTime,
  formatDatetime,
  truncate,
  generateId,
  isValidEmail,
  sleep,
  debounce,
  throttle,
  getProfitColor,
  getStatusColor,
  calculateWinRate,
  calculateProfitFactor,
  calculateDrawdown,
  calculateSharpeRatio,
  validateStrategy,
  getInitials,
  copyToClipboard,
  downloadFile
} from '../../utils';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency with default USD', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format currency with different currency', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
    });

    it('should handle zero values', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative values', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });
  });

  describe('formatPercent', () => {
    it('should format percentage with default decimals', () => {
      expect(formatPercent(0.1234)).toBe('12.34%');
    });

    it('should format percentage with custom decimals', () => {
      expect(formatPercent(0.1234, 1)).toBe('12.3%');
    });

    it('should handle zero values', () => {
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('should handle values greater than 1', () => {
      expect(formatPercent(1.5)).toBe('150.00%');
    });
  });

  describe('formatNumber', () => {
    it('should format number with default decimals', () => {
      expect(formatNumber(1234.5678)).toBe('1,234.57');
    });

    it('should format number with custom decimals', () => {
      expect(formatNumber(1234.5678, 3)).toBe('1,234.568');
    });

    it('should handle large numbers', () => {
      expect(formatNumber(1234567)).toBe('1,234,567.00');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15');

    it('should format date with short format', () => {
      expect(formatDate(testDate, 'short')).toBe('Jan 15, 2024');
    });

    it('should format date with long format', () => {
      expect(formatDate(testDate, 'long')).toBe('Monday, January 15, 2024');
    });

    it('should format date string', () => {
      expect(formatDate('2024-01-15', 'short')).toBe('Jan 15, 2024');
    });

    it('should handle default format', () => {
      expect(formatDate(testDate)).toBe('Jan 15, 2024');
    });
  });

  describe('formatTime', () => {
    const testDate = new Date('2024-01-15T14:30:45');

    it('should format time', () => {
      expect(formatTime(testDate)).toBe('02:30:45 PM');
    });

    it('should format time string', () => {
      expect(formatTime('2024-01-15T14:30:45')).toBe('02:30:45 PM');
    });
  });

  describe('formatDatetime', () => {
    const testDate = new Date('2024-01-15T14:30:45');

    it('should format datetime', () => {
      expect(formatDatetime(testDate)).toBe('Jan 15, 2024 02:30:45 PM');
    });
  });

  describe('truncate', () => {
    it('should truncate string longer than length', () => {
      expect(truncate('This is a long string', 10)).toBe('This is a...');
    });

    it('should return string as-is if shorter than length', () => {
      expect(truncate('Short', 10)).toBe('Short');
    });

    it('should handle exact length match', () => {
      expect(truncate('Exact', 5)).toBe('Exact');
    });
  });

  describe('generateId', () => {
    it('should generate random ID', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]{9}$/);
    });

    it('should generate ID with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_[a-z0-9]{9}$/);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const startTime = Date.now();
      await sleep(100);
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      throttledFn();
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });

  describe('getProfitColor', () => {
    it('should return green for positive values', () => {
      expect(getProfitColor(100)).toBe('text-green-600');
    });

    it('should return red for negative values', () => {
      expect(getProfitColor(-100)).toBe('text-red-600');
    });

    it('should return gray for zero values', () => {
      expect(getProfitColor(0)).toBe('text-gray-600');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct color classes', () => {
      expect(getStatusColor('active')).toBe('bg-green-100 text-green-800');
      expect(getStatusColor('draft')).toBe('bg-gray-100 text-gray-800');
      expect(getStatusColor('paused')).toBe('bg-yellow-100 text-yellow-800');
      expect(getStatusColor('archived')).toBe('bg-red-100 text-red-800');
    });

    it('should return default color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('calculateWinRate', () => {
    it('should calculate win rate correctly', () => {
      expect(calculateWinRate(60, 100)).toBe(60);
      expect(calculateWinRate(0, 100)).toBe(0);
      expect(calculateWinRate(100, 100)).toBe(100);
    });

    it('should handle zero total trades', () => {
      expect(calculateWinRate(50, 0)).toBe(0);
    });
  });

  describe('calculateProfitFactor', () => {
    it('should calculate profit factor correctly', () => {
      expect(calculateProfitFactor(5000, 3000)).toBeCloseTo(1.67, 2);
      expect(calculateProfitFactor(3000, 5000)).toBeCloseTo(0.6, 2);
    });

    it('should handle zero gross loss', () => {
      expect(calculateProfitFactor(5000, 0)).toBe(100);
    });

    it('should handle zero gross profit with positive loss', () => {
      expect(calculateProfitFactor(0, 5000)).toBe(0);
    });
  });

  describe('calculateDrawdown', () => {
    it('should calculate drawdown correctly', () => {
      expect(calculateDrawdown(10000, 8000)).toBe(20);
      expect(calculateDrawdown(10000, 9500)).toBe(5);
    });

    it('should handle zero peak', () => {
      expect(calculateDrawdown(0, 0)).toBe(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio correctly', () => {
      const returns = [0.01, 0.02, -0.01, 0.03, 0.01];
      const sharpe = calculateSharpeRatio(returns);
      expect(sharpe).toBeGreaterThan(0);
    });

    it('should handle empty returns array', () => {
      expect(calculateSharpeRatio([])).toBe(0);
    });

    it('should handle zero standard deviation', () => {
      const returns = [0.01, 0.01, 0.01];
      expect(calculateSharpeRatio(returns)).toBe(0);
    });
  });

  describe('validateStrategy', () => {
    it('should validate correct strategy object', () => {
      const validStrategy = {
        name: 'Test Strategy',
        symbol: 'EURUSD',
        timeframe: 'H1',
        rules: {
          entry: { conditions: [], logic: 'AND' as const },
          exit: {
            takeProfit: { type: 'pips' as const, value: 20 },
            stopLoss: { type: 'pips' as const, value: 10 }
          },
          riskManagement: { lotSize: 0.1, maxPositions: 3 }
        }
      };
      expect(validateStrategy(validStrategy)).toBe(true);
    });

    it('should reject invalid strategy object', () => {
      expect(validateStrategy(null)).toBe(false);
      expect(validateStrategy({})).toBe(false);
      expect(validateStrategy({ name: 'Test' })).toBe(false);
    });
  });

  describe('getInitials', () => {
    it('should get initials from first and last name', () => {
      expect(getInitials('John', 'Doe')).toBe('JD');
    });

    it('should handle missing names', () => {
      expect(getInitials()).toBe('?');
      expect(getInitials('John')).toBe('J');
    });
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      await copyToClipboard('test text');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
    });
  });

  describe('downloadFile', () => {
    // Mock createElement and appendChild
    const mockCreateElement = jest.fn(() => ({
      href: '',
      download: '',
      click: jest.fn()
    }));
    const originalCreateElement = document.createElement;
    document.createElement = mockCreateElement as any;

    it('should download file', () => {
      downloadFile('test content', 'test.txt');
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    // Restore original createElement
    document.createElement = originalCreateElement;
  });
});