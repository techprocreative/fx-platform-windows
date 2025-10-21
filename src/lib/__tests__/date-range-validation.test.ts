// Mock the date validation functions from backtest route
const MARKET_HOLIDAYS = [
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-05-27', '2024-06-19',
  '2024-07-04', '2024-09-02', '2024-10-14', '2024-11-11', '2024-11-28', '2024-12-25',
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
];

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isMarketHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return MARKET_HOLIDAYS.includes(dateStr);
}

function isValidTradingDay(date: Date): boolean {
  return !isWeekend(date) && !isMarketHoliday(date);
}

function getNextTradingDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isValidTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

function getPreviousTradingDay(date: Date): Date {
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  
  while (!isValidTradingDay(prevDay)) {
    prevDay.setDate(prevDay.getDate() - 1);
  }
  
  return prevDay;
}

function countTradingDays(startDate: Date, endDate: Date): number {
  let tradingDays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (isValidTradingDay(currentDate)) {
      tradingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return tradingDays;
}

function validateDateRange(startDate: Date, endDate: Date): {
  isValid: boolean;
  error?: string;
  tradingDays?: number;
  warnings?: string[];
} {
  const warnings: string[] = [];
  
  // Basic validation
  if (startDate >= endDate) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  // Check if dates are in the future
  const now = new Date();
  if (startDate > now) {
    return { isValid: false, error: 'Start date cannot be in the future' };
  }
  
  if (endDate > now) {
    warnings.push('End date is in the future, using current date instead');
    endDate = now;
  }
  
  // Check if dates are too old (limited data availability)
  const minDate = new Date('2020-01-01');
  if (startDate < minDate) {
    return { isValid: false, error: 'Start date cannot be before 2020-01-01 (limited data availability)' };
  }
  
  // Count trading days
  const tradingDays = countTradingDays(startDate, endDate);
  
  if (tradingDays === 0) {
    return { isValid: false, error: 'No valid trading days in the selected date range' };
  }
  
  // Check minimum trading days required
  const minTradingDays = 5;
  if (tradingDays < minTradingDays) {
    return { 
      isValid: false, 
      error: `Minimum ${minTradingDays} trading days required for meaningful backtest` 
    };
  }
  
  // Check maximum trading days
  const maxTradingDays = 365;
  if (tradingDays > maxTradingDays) {
    return { 
      isValid: false, 
      error: `Maximum ${maxTradingDays} trading days allowed per backtest` 
    };
  }
  
  return { 
    isValid: true, 
    tradingDays,
    warnings 
  };
}

describe('Date Range Validation', () => {
  describe('Trading Day Functions', () => {
    it('should identify weekends correctly', () => {
      const saturday = new Date('2024-01-06'); // Saturday
      const sunday = new Date('2024-01-07');   // Sunday
      const monday = new Date('2024-01-08');    // Monday
      
      expect(isWeekend(saturday)).toBe(true);
      expect(isWeekend(sunday)).toBe(true);
      expect(isWeekend(monday)).toBe(false);
    });

    it('should identify market holidays correctly', () => {
      const newYear = new Date('2024-01-01');
      const christmas = new Date('2024-12-25');
      const regularDay = new Date('2024-01-02');
      
      expect(isMarketHoliday(newYear)).toBe(true);
      expect(isMarketHoliday(christmas)).toBe(true);
      expect(isMarketHoliday(regularDay)).toBe(false);
    });

    it('should identify valid trading days correctly', () => {
      const weekend = new Date('2024-01-06'); // Saturday
      const holiday = new Date('2024-01-01');  // New Year
      const tradingDay = new Date('2024-01-02'); // Regular weekday
      
      expect(isValidTradingDay(weekend)).toBe(false);
      expect(isValidTradingDay(holiday)).toBe(false);
      expect(isValidTradingDay(tradingDay)).toBe(true);
    });

    it('should find next trading day correctly', () => {
      const friday = new Date('2024-01-05'); // Friday
      const saturday = new Date('2024-01-06'); // Saturday
      
      const nextFromFriday = getNextTradingDay(friday);
      expect(nextFromFriday.getDay()).toBe(1); // Monday
      
      const nextFromSaturday = getNextTradingDay(saturday);
      expect(nextFromSaturday.getDay()).toBe(1); // Monday
    });

    it('should find previous trading day correctly', () => {
      const monday = new Date('2024-01-08'); // Monday
      const saturday = new Date('2024-01-06'); // Saturday
      
      const prevFromMonday = getPreviousTradingDay(monday);
      expect(prevFromMonday.getDay()).toBe(5); // Friday
      
      const prevFromSaturday = getPreviousTradingDay(saturday);
      expect(prevFromSaturday.getDay()).toBe(5); // Friday
    });
  });

  describe('countTradingDays', () => {
    it('should count trading days correctly for a week', () => {
      const start = new Date('2024-01-01'); // Monday (Holiday)
      const end = new Date('2024-01-07');   // Sunday
      
      const tradingDays = countTradingDays(start, end);
      // Jan 1: Holiday, Jan 2-5: Trading days, Jan 6-7: Weekend
      expect(tradingDays).toBe(4);
    });

    it('should count trading days correctly for a month', () => {
      const start = new Date('2024-01-01'); // January 1st
      const end = new Date('2024-01-31');   // January 31st
      
      const tradingDays = countTradingDays(start, end);
      // January 2024 has 23 trading days (excluding weekends and holidays)
      expect(tradingDays).toBe(23);
    });

    it('should handle single day range', () => {
      const tradingDay = new Date('2024-01-02'); // Tuesday
      const weekend = new Date('2024-01-06');   // Saturday
      
      expect(countTradingDays(tradingDay, tradingDay)).toBe(1);
      expect(countTradingDays(weekend, weekend)).toBe(0);
    });
  });

  describe('validateDateRange', () => {
    it('should reject invalid date ranges', () => {
      const start = new Date('2024-01-10');
      const end = new Date('2024-01-05');
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date must be before end date');
    });

    it('should reject future start dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const end = new Date();
      end.setDate(end.getDate() + 20);
      
      const result = validateDateRange(future, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date cannot be in the future');
    });

    it('should reject dates before 2020', () => {
      const start = new Date('2019-12-31');
      const end = new Date('2020-01-05');
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date cannot be before 2020-01-01 (limited data availability)');
    });

    it('should reject ranges with no trading days', () => {
      const start = new Date('2024-01-06'); // Saturday
      const end = new Date('2024-01-07');   // Sunday
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No valid trading days in the selected date range');
    });

    it('should reject ranges with insufficient trading days', () => {
      const start = new Date('2024-01-02'); // Tuesday
      const end = new Date('2024-01-04');   // Thursday (3 trading days)
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Minimum 5 trading days required for meaningful backtest');
    });

    it('should reject ranges with too many trading days', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2022-01-01'); // ~2 years
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Maximum 365 trading days allowed per backtest');
    });

    it('should accept valid date ranges', () => {
      const start = new Date('2024-01-02'); // Tuesday
      const end = new Date('2024-01-31');   // End of month
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(true);
      expect(result.tradingDays).toBe(23);
      expect(result.warnings).toBeDefined();
    });

    it('should handle edge case dates', () => {
      // Test around holidays
      const start = new Date('2024-12-23'); // Monday before Christmas
      const end = new Date('2024-12-31');   // End of year
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(true);
      // Should exclude Christmas (Dec 25) and weekends
      expect(result.tradingDays).toBeGreaterThan(0);
      expect(result.tradingDays).toBeLessThan(10);
    });

    it('should provide warnings for future end dates', () => {
      const start = new Date('2024-01-02');
      const future = new Date();
      future.setDate(future.getDate() + 10);
      
      const result = validateDateRange(start, future);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('End date is in the future, using current date instead');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle year transition correctly', () => {
      const start = new Date('2024-12-30'); // Monday
      const end = new Date('2025-01-03');   // Friday
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(true);
      // Should exclude New Year's Day (2025-01-01) and weekends
      expect(result.tradingDays).toBe(3); // Dec 30, Dec 31, Jan 2, Jan 3 (but Jan 1 is holiday)
    });

    it('should handle multiple holidays in range', () => {
      const start = new Date('2024-11-25'); // Monday before Thanksgiving
      const end = new Date('2024-12-02');   // Monday after Thanksgiving
      
      const result = validateDateRange(start, end);
      expect(result.isValid).toBe(true);
      // Should exclude Thanksgiving (Nov 28) and weekends
      expect(result.tradingDays).toBe(5); // Nov 25-27, Nov 29, Dec 2
    });
  });
});