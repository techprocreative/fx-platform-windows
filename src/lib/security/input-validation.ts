import { z } from 'zod';
// Note: DOMPurify would need to be installed separately
// import DOMPurify from 'isomorphic-dompurify';
import { createAuditLogFromRequest, AuditEventType } from './audit-log';

// Common validation schemas
export const commonSchemas = {
  // Email validation
  email: z.string().email('Invalid email format').max(254, 'Email too long'),
  
  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  
  // Username validation
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  // ID validation (CUID format)
  id: z.string().cuid('Invalid ID format'),
  
  // Phone number validation
  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  
  // URL validation
  url: z.string().url('Invalid URL format').max(2048, 'URL too long'),
  
  // IP address validation
  ipAddress: z.string()
    .regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address'),
  
  // Symbol validation (for trading symbols)
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .regex(/^[A-Z0-9._-]+$/, 'Invalid symbol format'),
  
  // Numeric validation
  positiveNumber: z.number().positive('Value must be positive'),
  nonNegativeNumber: z.number().nonnegative('Value must be non-negative'),
  
  // Date validation
  date: z.string().datetime('Invalid date format'),
  
  // Boolean validation
  boolean: z.boolean(),
  
  // String validation
  nonEmptyString: z.string().min(1, 'Value cannot be empty'),
  maxLengthString: (max: number) => z.string().max(max, `Value cannot exceed ${max} characters`),
};

// Order type validation
const orderType = z.enum(['BUY', 'SELL'], { invalid_type_error: 'Invalid order type' });

// Order status validation
const orderStatus = z.enum(['PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'], { invalid_type_error: 'Invalid order status' });

// Timeframe validation
const timeframe = z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'], { invalid_type_error: 'Invalid timeframe' });

// Lot size validation
const lotSize = z.number()
  .positive('Lot size must be positive')
  .min(0.01, 'Minimum lot size is 0.01')
  .max(100, 'Maximum lot size is 100')
  .multipleOf(0.01, 'Lot size must be a multiple of 0.01');

// Price validation
const price = z.number()
  .positive('Price must be positive')
  .max(1000000, 'Price too high');

// Stop loss and take profit validation
const stopLoss = z.number().positive('Stop loss must be positive').optional();
const takeProfit = z.number().positive('Take profit must be positive').optional();

// Trading-specific validation schemas
export const tradingSchemas = {
  orderType,
  orderStatus,
  timeframe,
  lotSize,
  price,
  stopLoss,
  takeProfit,
  
  // Trade validation
  trade: z.object({
    symbol: commonSchemas.symbol,
    type: orderType,
    lots: lotSize,
    price: price.optional(),
    stopLoss,
    takeProfit,
  }),
  
  // Strategy validation
  strategy: z.object({
    name: commonSchemas.maxLengthString(100),
    description: commonSchemas.maxLengthString(1000).optional(),
    symbol: commonSchemas.symbol,
    timeframe,
    rules: z.any(), // Rules can be any JSON structure
  }),
};

// API validation schemas
export const apiSchemas = {
  // API key validation
  apiKey: z.object({
    name: commonSchemas.maxLengthString(100),
    permissions: z.array(z.string()).min(1, 'At least one permission is required'),
    ipWhitelist: z.array(commonSchemas.ipAddress).optional(),
    rateLimit: z.number().positive().max(10000, 'Rate limit too high').optional(),
  }),
  
  // Pagination validation
  pagination: z.object({
    page: z.number().positive().default(1),
    limit: z.number().positive().max(100).default(20),
  }),
  
  // Date range validation
  dateRange: z.object({
    startDate: commonSchemas.date,
    endDate: commonSchemas.date,
  }).refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    { message: 'End date must be after start date' }
  ),
};

// Input sanitization functions
export class InputSanitizer {
  /**
   * Sanitize HTML content
   * @param html - HTML content to sanitize
   * @returns Sanitized HTML
   */
  static sanitizeHTML(html: string): string {
    // Basic HTML sanitization without DOMPurify
    // In a real implementation, you would install and use DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }
  
  /**
   * Sanitize string input
   * @param input - String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove JavaScript protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }
  
  /**
   * Sanitize numeric input
   * @param input - Input to sanitize
   * @returns Sanitized number or null
   */
  static sanitizeNumber(input: any): number | null {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Sanitize boolean input
   * @param input - Input to sanitize
   * @returns Sanitized boolean
   */
  static sanitizeBoolean(input: any): boolean {
    if (typeof input === 'boolean') {
      return input;
    }
    
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true';
    }
    
    return Boolean(input);
  }
  
  /**
   * Sanitize email input
   * @param input - Email to sanitize
   * @returns Sanitized email or null
   */
  static sanitizeEmail(input: string): string | null {
    const email = this.sanitizeString(input.toLowerCase());
    return commonSchemas.email.safeParse(email).success ? email : null;
  }
  
  /**
   * Sanitize URL input
   * @param input - URL to sanitize
   * @returns Sanitized URL or null
   */
  static sanitizeURL(input: string): string | null {
    const url = this.sanitizeString(input);
    return commonSchemas.url.safeParse(url).success ? url : null;
  }
  
  /**
   * Sanitize object by recursively sanitizing all string values
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }
}

// Validation middleware for Express
export function validateRequest(schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: any, res: any, next: any) => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        // Log validation error
        createAuditLogFromRequest({
          userId: req.session?.userId,
          eventType: AuditEventType.SECURITY_VIOLATION,
          resource: 'INPUT_VALIDATION',
          action: 'VALIDATION_FAILED',
          result: 'BLOCKED',
          metadata: {
            source,
            errors,
            input: data,
          },
        }, req).catch(error => console.error('Error logging validation error:', error));
        
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          errors,
        });
      }
      
      // Replace the original data with validated and sanitized data
      req[source] = InputSanitizer.sanitizeObject(result.data);
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Input validation failed',
      });
    }
  };
}

// Custom validation functions
export const customValidators = {
  /**
   * Validate password strength
   * @param password - Password to validate
   * @returns Validation result
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;
    
    // Length check
    if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
      feedback.push('Consider using a longer password (12+ characters)');
    } else {
      feedback.push('Password must be at least 8 characters');
    }
    
    // Character variety checks
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');
    
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');
    
    // Common patterns check
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Avoid repeating characters');
    }
    
    if (/password|123456|qwerty/i.test(password)) {
      score -= 2;
      feedback.push('Avoid common passwords');
    }
    
    return {
      isValid: score >= 4,
      score: Math.max(0, Math.min(5, score)),
      feedback,
    };
  },
  
  /**
   * Validate trading symbol
   * @param symbol - Symbol to validate
   * @returns Whether the symbol is valid
   */
  validateTradingSymbol(symbol: string): boolean {
    // Check if symbol exists in a list of valid symbols
    // In a real implementation, you would check against a database of valid symbols
    const validSymbols = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
      'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD',
      'EURCAD', 'EURNZD', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
    ];
    
    return validSymbols.includes(symbol.toUpperCase());
  },
  
  /**
   * Validate lot size based on symbol and account
   * @param symbol - Trading symbol
   * @param lots - Lot size
   * @param accountType - Account type
   * @returns Whether the lot size is valid
   */
  validateLotSize(symbol: string, lots: number, accountType: string = 'standard'): boolean {
    const minLotSize = accountType === 'micro' ? 0.01 : 0.01;
    const maxLotSize = accountType === 'standard' ? 100 : 50;
    
    return lots >= minLotSize && lots <= maxLotSize && lots % 0.01 === 0;
  },
};

export default {
  commonSchemas,
  tradingSchemas,
  apiSchemas,
  InputSanitizer,
  validateRequest,
  customValidators,
};