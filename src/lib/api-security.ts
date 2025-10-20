/**
 * API SECURITY UTILITIES
 * Provides security functions for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import crypto from 'crypto';

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting function
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean old entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
  
  const current = rateLimitStore.get(identifier);
  
  if (!current || current.resetTime < now) {
    // Start new window
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }
  
  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: current.resetTime };
  }
  
  // Increment count
  current.count++;
  rateLimitStore.set(identifier, current);
  
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Validate API Key
 */
export async function validateAPIKey(apiKey: string): Promise<any> {
  try {
    // Check if API key exists in database
    const executor = await prisma.executor.findFirst({
      where: {
        apiKey: apiKey,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        userId: true,
        status: true,
      },
    });
    
    return executor;
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

/**
 * Generate JWT token
 */
export function generateJWT(payload: any, expiresIn: string = '15m'): string {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Validate JWT token
 */
export function validateJWT(token: string): any {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Extract bearer token from request
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Extract API key from request
 */
export function extractAPIKey(request: NextRequest): string | null {
  // Check header first
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;
  
  // Check authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('API-Key ')) {
    return authHeader.substring(8);
  }
  
  // Check query parameter
  const url = new URL(request.url);
  return url.searchParams.get('apiKey');
}

/**
 * Get client IP address
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return request.ip || 'unknown';
}

/**
 * Validate IP against whitelist
 */
export function validateIP(ip: string, whitelist?: string[]): boolean {
  // If no whitelist configured, allow all
  if (!whitelist || whitelist.length === 0) {
    return true;
  }
  
  // Check if IP is in whitelist
  return whitelist.includes(ip) || whitelist.includes('*');
}

/**
 * Create secure API response
 */
export function createSecureResponse(
  data: any,
  status: number = 200,
  headers?: HeadersInit
): NextResponse {
  const response = NextResponse.json(data, { status, headers });
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  return response;
}

/**
 * Create error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  return createSecureResponse(
    {
      error: message,
      details,
      timestamp: new Date().toISOString(),
    },
    status
  );
}

/**
 * Validate request body against schema (using Zod)
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: any
): Promise<{ valid: true; data: T } | { valid: false; errors: any }> {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    return { valid: true, data: validated };
  } catch (error: any) {
    return {
      valid: false,
      errors: error.errors || [{ message: 'Invalid request body' }],
    };
  }
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  event: string,
  userId: string,
  metadata?: any,
  ip?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: event,
        metadata,
        ipAddress: ip,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Check if request is from localhost (for development)
 */
export function isLocalhost(request: NextRequest): boolean {
  const ip = getClientIP(request);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  // Remove potential XSS attempts
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Hash sensitive data
 */
export async function hashData(data: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(data, 10);
}

/**
 * Verify hashed data
 */
export async function verifyHash(data: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(data, hash);
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate CORS origin
 */
export function validateOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    process.env.NEXTAUTH_URL || 'https://yourdomain.vercel.app',
    'http://localhost:3000',
  ];
  
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}

/**
 * Apply CORS headers
 */
export function applyCORSHeaders(response: NextResponse, origin?: string): void {
  if (origin && validateOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
}
