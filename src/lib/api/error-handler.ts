/**
 * STANDARDIZED API ERROR HANDLING
 * Provides consistent error responses across all API endpoints
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/types';

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  
  // Data & External Services
  NO_DATA = 'NO_DATA',
  MARKET_DATA_ERROR = 'MARKET_DATA_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  DETECTION_ERROR = 'DETECTION_ERROR',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  SCORING_ERROR = 'SCORING_ERROR',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

/**
 * Error response details
 */
export interface ErrorResponse {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
  status: number = 500,
  requestId?: string
): NextResponse<ApiResponse<null>> {
  const errorResponse: ErrorResponse = {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };

  return NextResponse.json<ApiResponse<null>>({
    success: false,
    error: errorResponse
  }, { status });
}

/**
 * Handle Zod validation errors
 */
export function handleValidationError(error: z.ZodError, requestId?: string): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.VALIDATION_ERROR,
    'Invalid request data',
    {
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    },
    400,
    requestId
  );
}

/**
 * Handle authentication errors
 */
export function handleAuthError(message: string = 'Authentication required', requestId?: string): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.UNAUTHORIZED,
    message,
    undefined,
    401,
    requestId
  );
}

/**
 * Handle authorization errors
 */
export function handleForbiddenError(message: string = 'Access forbidden', requestId?: string): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.FORBIDDEN,
    message,
    undefined,
    403,
    requestId
  );
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(resource: string, requestId?: string): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.NO_DATA,
    `${resource} not found`,
    undefined,
    404,
    requestId
  );
}

/**
 * Handle rate limit errors
 */
export function handleRateLimitError(resetTime?: Date, requestId?: string): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded',
    resetTime ? { resetTime: resetTime.toISOString() } : undefined,
    429,
    requestId
  );
}

/**
 * Handle internal server errors
 */
export function handleInternalError(
  error: Error | unknown,
  context?: string,
  requestId?: string
): NextResponse<ApiResponse<null>> {
  const message = context ? `Internal error in ${context}` : 'Internal server error';
  const details = process.env.NODE_ENV === 'development' 
    ? { 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    : undefined;

  return createErrorResponse(
    ApiErrorCode.INTERNAL_ERROR,
    message,
    details,
    500,
    requestId
  );
}

/**
 * Handle service unavailable errors
 */
export function handleServiceUnavailableError(
  service: string,
  requestId?: string
): NextResponse<ApiResponse<null>> {
  return createErrorResponse(
    ApiErrorCode.SERVICE_UNAVAILABLE,
    `${service} service is currently unavailable`,
    undefined,
    503,
    requestId
  );
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  metadata?: Record<string, unknown>
): NextResponse<ApiResponse<T>> {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  return NextResponse.json<ApiResponse<T>>(response as ApiResponse<T>, { status });
}

/**
 * API error boundary wrapper
 */
export function withErrorHandling(
  handler: (request: Request, context?: any) => Promise<NextResponse>
) {
  return async (request: Request, context?: any) => {
    const requestId = generateRequestId();
    
    try {
      const response = await handler(request, context);
      
      // Add request ID to response headers
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      console.error(`API Error [${requestId}]:`, error);
      
      if (error instanceof z.ZodError) {
        return handleValidationError(error, requestId);
      }
      
      return handleInternalError(error, undefined, requestId);
    }
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * API middleware for request logging
 */
export function logRequest(request: Request, requestId: string): void {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const query = url.search;
  
  console.log(`[${requestId}] ${method} ${path}${query}`);
}

/**
 * API middleware for response logging
 */
export function logResponse(response: NextResponse, requestId: string): void {
  const status = response.status;
  const success = status >= 200 && status < 300;
  
  console.log(`[${requestId}] Response: ${status} (${success ? 'SUCCESS' : 'ERROR'})`);
}