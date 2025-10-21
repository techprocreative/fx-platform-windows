// Supported timezones
export const SUPPORTED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Manila',
  'Australia/Sydney',
  'Australia/Melbourne',
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

// Timezone offset mappings (in minutes from UTC)
const TIMEZONE_OFFSETS: Record<SupportedTimezone, number> = {
  'UTC': 0,
  'America/New_York': -300, // EST (UTC-5)
  'America/Chicago': -360, // CST (UTC-6)
  'America/Denver': -420, // MST (UTC-7)
  'America/Los_Angeles': -480, // PST (UTC-8)
  'Europe/London': 0, // GMT (UTC+0)
  'Europe/Berlin': 60, // CET (UTC+1)
  'Europe/Paris': 60, // CET (UTC+1)
  'Asia/Tokyo': 540, // JST (UTC+9)
  'Asia/Shanghai': 480, // CST (UTC+8)
  'Asia/Hong_Kong': 480, // HKT (UTC+8)
  'Asia/Singapore': 480, // SGT (UTC+8)
  'Asia/Jakarta': 420, // WIB (UTC+7)
  'Asia/Manila': 480, // PHT (UTC+8)
  'Australia/Sydney': 600, // AEST (UTC+10)
  'Australia/Melbourne': 600, // AEST (UTC+10)
};

// User timezone detection
export function detectUserTimezone(): SupportedTimezone {
  if (typeof window === 'undefined') {
    return 'UTC';
  }

  try {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map detected timezone to supported timezone
    if (SUPPORTED_TIMEZONES.includes(detectedTz as SupportedTimezone)) {
      return detectedTz as SupportedTimezone;
    }

    // Fallback mapping for common timezones
    const timezoneMap: Record<string, SupportedTimezone> = {
      'US/Eastern': 'America/New_York',
      'US/Central': 'America/Chicago',
      'US/Mountain': 'America/Denver',
      'US/Pacific': 'America/Los_Angeles',
      'Europe/Berlin': 'Europe/Paris',
      'Europe/Amsterdam': 'Europe/Paris',
      'Asia/Bangkok': 'Asia/Jakarta',
      'Asia/Kuala_Lumpur': 'Asia/Singapore',
    };

    return timezoneMap[detectedTz] || 'UTC';
  } catch (error) {
    console.warn('Failed to detect user timezone:', error);
    return 'UTC';
  }
}

// Convert date to user timezone
export function toUserTimezone(
  date: Date | string,
  userTimezone: SupportedTimezone = detectUserTimezone()
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  const offset = TIMEZONE_OFFSETS[userTimezone];
  return new Date(dateObj.getTime() + offset * 60 * 1000);
}

// Convert date from user timezone to UTC
export function fromUserTimezone(
  date: Date | string,
  userTimezone: SupportedTimezone = detectUserTimezone()
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  const offset = TIMEZONE_OFFSETS[userTimezone];
  return new Date(dateObj.getTime() - offset * 60 * 1000);
}

// Format date in user timezone
export function formatDateInUserTimezone(
  date: Date | string,
  formatStr: string,
  userTimezone: SupportedTimezone = detectUserTimezone()
): string {
  const dateInTz = toUserTimezone(date, userTimezone);
  
  // Simple formatting implementation
  const year = dateInTz.getFullYear();
  const month = String(dateInTz.getMonth() + 1).padStart(2, '0');
  const day = String(dateInTz.getDate()).padStart(2, '0');
  const hours = String(dateInTz.getHours()).padStart(2, '0');
  const minutes = String(dateInTz.getMinutes()).padStart(2, '0');
  const seconds = String(dateInTz.getSeconds()).padStart(2, '0');
  
  // Replace format tokens
  return formatStr
    .replace(/yyyy/g, year.toString())
    .replace(/MM/g, month)
    .replace(/dd/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
    .replace(/MMM/g, dateInTz.toLocaleString('default', { month: 'short' }));
}

// Get timezone offset string
export function getTimezoneOffset(timezone: SupportedTimezone): string {
  const offset = TIMEZONE_OFFSETS[timezone];
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Get timezone display name
export function getTimezoneDisplay(timezone: SupportedTimezone): string {
  const offset = getTimezoneOffset(timezone);
  
  // Format: "timezone (UTC±HH:MM)"
  return `${timezone.replace(/_/g, ' ')} (${offset})`;
}

// Check if two dates are the same day in user timezone
export function isSameDayInUserTimezone(
  date1: Date | string,
  date2: Date | string,
  userTimezone: SupportedTimezone = detectUserTimezone()
): boolean {
  const tzDate1 = toUserTimezone(date1, userTimezone);
  const tzDate2 = toUserTimezone(date2, userTimezone);
  
  return (
    tzDate1.getFullYear() === tzDate2.getFullYear() &&
    tzDate1.getMonth() === tzDate2.getMonth() &&
    tzDate1.getDate() === tzDate2.getDate()
  );
}

// Get trading session info for a timezone
export function getTradingSessionInfo(
  date: Date | string,
  timezone: SupportedTimezone
): {
  isWeekend: boolean;
  isMarketHours: boolean;
  session: 'asian' | 'london' | 'new_york' | 'overlap' | 'closed';
  nextOpen: Date;
  nextClose: Date;
} {
  const dateInTz = toUserTimezone(date, timezone);
  const day = dateInTz.getDay();
  const hours = dateInTz.getHours();
  
  // Weekend check
  const isWeekend = day === 0 || day === 6;
  
  // Market hours check (simplified)
  const isMarketHours = !isWeekend && hours >= 0 && hours < 24;
  
  // Session determination (simplified)
  let session: 'asian' | 'london' | 'new_york' | 'overlap' | 'closed' = 'closed';
  
  if (isMarketHours) {
    if (hours >= 0 && hours < 8) {
      session = 'asian';
    } else if (hours >= 8 && hours < 13) {
      session = 'london';
    } else if (hours >= 13 && hours < 17) {
      session = 'new_york';
    } else if (hours >= 17 && hours < 24) {
      session = 'asian'; // Next day Asian session
    }
  }
  
  // Calculate next open/close (simplified)
  const nextOpen = new Date(dateInTz);
  const nextClose = new Date(dateInTz);
  
  if (isWeekend) {
    // Next Monday
    const daysUntilMonday = day === 0 ? 1 : 6;
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(0, 0, 0, 0);
    
    nextClose.setDate(nextClose.getDate() + daysUntilMonday);
    nextClose.setHours(23, 59, 59, 999);
  } else {
    if (hours >= 23) {
      // Next day
      nextOpen.setDate(nextOpen.getDate() + 1);
      nextOpen.setHours(0, 0, 0, 0);
    } else {
      nextOpen.setHours(hours + 1, 0, 0, 0);
    }
    
    nextClose.setHours(23, 59, 59, 999);
  }
  
  return {
    isWeekend,
    isMarketHours,
    session,
    nextOpen: fromUserTimezone(nextOpen, timezone),
    nextClose: fromUserTimezone(nextClose, timezone),
  };
}

// Convert market hours between timezones
export function convertMarketHours(
  fromTimezone: SupportedTimezone,
  toTimezone: SupportedTimezone,
  date: Date | string = new Date()
): {
  open: Date;
  close: Date;
  isCurrentlyOpen: boolean;
} {
  const dateInFromTz = toUserTimezone(date, fromTimezone);
  const sessionInfo = getTradingSessionInfo(dateInFromTz, fromTimezone);
  
  // Convert the session times to target timezone
  const openInTargetTz = toUserTimezone(sessionInfo.nextOpen, toTimezone);
  const closeInTargetTz = toUserTimezone(sessionInfo.nextClose, toTimezone);
  
  // Check if current time is within market hours in target timezone
  const nowInTargetTz = toUserTimezone(new Date(), toTimezone);
  const isCurrentlyOpen = nowInTargetTz >= openInTargetTz && nowInTargetTz <= closeInTargetTz;
  
  return {
    open: openInTargetTz,
    close: closeInTargetTz,
    isCurrentlyOpen,
  };
}

// Format utilities for common use cases
export const formatInUserTimezone = {
  date: (date: Date | string, timezone?: SupportedTimezone) =>
    formatDateInUserTimezone(date, 'MMM dd, yyyy', timezone),
  
  time: (date: Date | string, timezone?: SupportedTimezone) =>
    formatDateInUserTimezone(date, 'HH:mm:ss', timezone),
  
  datetime: (date: Date | string, timezone?: SupportedTimezone) =>
    formatDateInUserTimezone(date, 'MMM dd, yyyy HH:mm:ss', timezone),
  
  shortDate: (date: Date | string, timezone?: SupportedTimezone) =>
    formatDateInUserTimezone(date, 'MM/dd/yyyy', timezone),
  
  iso: (date: Date | string, timezone?: SupportedTimezone) => {
    const dateInTz = toUserTimezone(date, timezone);
    return dateInTz.toISOString();
  },
};

// Validation utilities
export function isValidTimezone(timezone: string): timezone is SupportedTimezone {
  return SUPPORTED_TIMEZONES.includes(timezone as SupportedTimezone);
}

export function validateTimezone(timezone: string): SupportedTimezone {
  if (isValidTimezone(timezone)) {
    return timezone;
  }
  
  console.warn(`Invalid timezone "${timezone}", falling back to UTC`);
  return 'UTC';
}

// Client-side hook for timezone management
export function useTimezone(initialTimezone?: SupportedTimezone) {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return {
      timezone: initialTimezone || 'UTC',
      setTimezone: () => {},
      detectAndSetTimezone: () => {},
      isDetecting: false,
    };
  }

  // Simple state management without React hooks
  let timezone: SupportedTimezone = initialTimezone || detectUserTimezone();
  let isDetecting = false;

  const setTimezone = (newTimezone: SupportedTimezone) => {
    timezone = newTimezone;
  };

  const detectAndSetTimezone = () => {
    isDetecting = true;
    try {
      const detected = detectUserTimezone();
      timezone = detected;
    } catch (error) {
      console.error('Failed to detect timezone:', error);
    } finally {
      isDetecting = false;
    }
  };

  return {
    timezone,
    setTimezone,
    detectAndSetTimezone,
    isDetecting,
  };
}

// Server-side timezone utilities
export function getUserTimezoneFromRequest(request: Request): SupportedTimezone {
  try {
    // Try to get timezone from user preferences or headers
    const timezoneHeader = request.headers.get('x-user-timezone');
    if (timezoneHeader && isValidTimezone(timezoneHeader)) {
      return timezoneHeader;
    }
    
    // Fallback to UTC
    return 'UTC';
  } catch (error) {
    console.warn('Failed to get timezone from request:', error);
    return 'UTC';
  }
}

// Database utilities for storing timezone preferences
export function storeUserTimezone(userId: string, timezone: SupportedTimezone): void {
  // This would typically update the user preferences in the database
  // Implementation depends on your database setup
  console.log(`Storing timezone ${timezone} for user ${userId}`);
}

export async function getUserTimezone(userId: string): Promise<SupportedTimezone> {
  // This would typically fetch from the database
  // Implementation depends on your database setup
  console.log(`Fetching timezone for user ${userId}`);
  return 'UTC'; // Default fallback
}