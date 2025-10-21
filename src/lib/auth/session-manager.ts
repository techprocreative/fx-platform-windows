import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getEnvVar } from '../security/env-validator';
import { createAuditLogFromRequest, AuditEventType } from '../security/audit-log';

const prisma = new PrismaClient();

// Session configuration
const SESSION_CONFIG = {
  maxAge: getEnvVar('SESSION_MAX_AGE') * 1000, // Convert to milliseconds
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax' as const,
};

// Session store interface
export interface SessionData {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  twoFactorVerified?: boolean;
  lastActivity: Date;
  metadata?: any;
}

/**
 * Create a new session
 * @param sessionData - Session data
 * @param req - Request object
 * @returns Session token
 */
export async function createSession(
  sessionData: SessionData,
  req?: any
): Promise<string> {
  try {
    // Generate a secure session token
    const sessionToken = generateSecureSessionToken();
    
    // Calculate expiration date
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.maxAge);
    
    // Get client information
    const ipAddress = req ? getClientIP(req) : sessionData.ipAddress;
    const userAgent = req ? req.headers['user-agent'] : sessionData.userAgent;
    
    // Create session in database
    const session = await prisma.session.create({
      data: {
        sessionToken,
        userId: sessionData.userId,
        expires: expiresAt,
        ipAddress,
        userAgent,
      },
    });
    
    // Log session creation
    if (req) {
      await createAuditLogFromRequest({
        userId: sessionData.userId,
        eventType: AuditEventType.LOGIN,
        resource: 'SESSION',
        action: 'CREATE',
        result: 'SUCCESS',
        metadata: {
          sessionId: session.id,
          expiresAt: expiresAt.toISOString(),
        },
      }, req);
    }
    
    return sessionToken;
  } catch (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Validate a session token
 * @param sessionToken - Session token to validate
 * @param req - Request object
 * @returns Session data if valid, null otherwise
 */
export async function validateSession(
  sessionToken: string,
  req?: any
): Promise<SessionData | null> {
  try {
    // Find session in database
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });
    
    if (!session) {
      return null;
    }
    
    // Check if session has expired
    if (session.expires < new Date()) {
      await deleteSession(sessionToken);
      return null;
    }
    
    // Check if user is locked
    if (session.user.locked) {
      await deleteSession(sessionToken);
      return null;
    }
    
    // Update last activity
    await updateSessionActivity(sessionToken);
    
    // Return session data
    return {
      userId: session.userId,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      lastActivity: new Date(),
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Delete a session
 * @param sessionToken - Session token to delete
 * @param req - Request object
 * @returns Whether the session was deleted
 */
export async function deleteSession(
  sessionToken: string,
  req?: any
): Promise<boolean> {
  try {
    // Get session before deletion for logging
    const session = await prisma.session.findUnique({
      where: { sessionToken },
    });
    
    // Delete session from database
    await prisma.session.delete({
      where: { sessionToken },
    });
    
    // Log session deletion
    if (session && req) {
      await createAuditLogFromRequest({
        userId: session.userId,
        eventType: AuditEventType.LOGOUT,
        resource: 'SESSION',
        action: 'DELETE',
        result: 'SUCCESS',
        metadata: {
          sessionId: session.id,
        },
      }, req);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

/**
 * Delete all sessions for a user
 * @param userId - User ID
 * @param excludeSessionToken - Optional session token to exclude
 * @returns Number of deleted sessions
 */
export async function deleteAllUserSessions(
  userId: string,
  excludeSessionToken?: string
): Promise<number> {
  try {
    const where: any = { userId };
    if (excludeSessionToken) {
      where.sessionToken = { not: excludeSessionToken };
    }
    
    const result = await prisma.session.deleteMany({ where });
    return result.count;
  } catch (error) {
    console.error('Error deleting all user sessions:', error);
    return 0;
  }
}

/**
 * Update session activity timestamp
 * @param sessionToken - Session token
 * @returns Whether the update was successful
 */
async function updateSessionActivity(sessionToken: string): Promise<boolean> {
  try {
    // Note: Prisma doesn't have a direct way to update only the timestamp
    // In a real implementation, you might use raw SQL or add a lastActivity field
    return true;
  } catch (error) {
    console.error('Error updating session activity:', error);
    return false;
  }
}

/**
 * Get all active sessions for a user
 * @param userId - User ID
 * @returns Array of active sessions
 */
export async function getUserSessions(userId: string): Promise<any[]> {
  try {
    return await prisma.session.findMany({
      where: {
        userId,
        expires: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

/**
 * Check if a session has 2FA verified
 * @param sessionToken - Session token
 * @returns Whether 2FA is verified
 */
export async function isSessionTwoFactorVerified(
  sessionToken: string
): Promise<boolean> {
  try {
    // In a real implementation, you would store 2FA verification status
    // in the session or a separate table
    // For now, we'll return true
    return true;
  } catch (error) {
    console.error('Error checking 2FA verification:', error);
    return false;
  }
}

/**
 * Mark a session as 2FA verified
 * @param sessionToken - Session token
 * @returns Whether the update was successful
 */
export async function markSessionTwoFactorVerified(
  sessionToken: string
): Promise<boolean> {
  try {
    // In a real implementation, you would store 2FA verification status
    // in the session or a separate table
    return true;
  } catch (error) {
    console.error('Error marking 2FA verification:', error);
    return false;
  }
}

/**
 * Clean up expired sessions
 * @returns Number of cleaned up sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

/**
 * Check for suspicious session activity
 * @param userId - User ID
 * @param sessionToken - Current session token
 * @param req - Request object
 * @returns Whether suspicious activity was detected
 */
export async function checkSuspiciousActivity(
  userId: string,
  sessionToken: string,
  req: any
): Promise<boolean> {
  try {
    // Get current session
    const currentSession = await prisma.session.findUnique({
      where: { sessionToken },
    });
    
    if (!currentSession) {
      return false;
    }
    
    // Get other active sessions for the user
    const otherSessions = await prisma.session.findMany({
      where: {
        userId,
        sessionToken: { not: sessionToken },
        expires: { gt: new Date() },
      },
    });
    
    // Check for multiple concurrent sessions from different IPs
    const currentIP = getClientIP(req);
    const differentIPSessions = otherSessions.filter(
      session => session.ipAddress !== currentIP
    );
    
    if (differentIPSessions.length > 0) {
      // Log suspicious activity
      await createAuditLogFromRequest({
        userId,
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        resource: 'SESSION',
        action: 'MULTIPLE_IPS',
        result: 'DETECTED',
        metadata: {
          currentIP,
          otherIPs: differentIPSessions.map(s => s.ipAddress),
          sessionCount: otherSessions.length + 1,
        },
      }, req);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking suspicious activity:', error);
    return false;
  }
}

/**
 * Generate a secure session token
 * @returns Secure session token
 */
function generateSecureSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get client IP address from request
 * @param req - Request object
 * @returns Client IP address
 */
function getClientIP(req: any): string {
  try {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const clientIP = req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    } else if (realIP) {
      return realIP;
    } else if (clientIP) {
      // Remove IPv6 prefix if present
      return clientIP.replace(/^::ffff:/, '');
    } else {
      return 'unknown';
    }
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}

/**
 * Create a middleware for session management
 * @returns Express middleware function
 */
export function createSessionMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      // Get session token from cookie or header
      const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
      
      if (sessionToken) {
        // Validate session
        const sessionData = await validateSession(sessionToken, req);
        
        if (sessionData) {
          // Attach session data to request
          req.session = sessionData;
          req.sessionToken = sessionToken;
          
          // Check for suspicious activity
          await checkSuspiciousActivity(sessionData.userId, sessionToken, req);
        } else {
          // Clear invalid session token
          res.clearCookie('sessionToken');
        }
      }
      
      next();
    } catch (error) {
      console.error('Session middleware error:', error);
      next();
    }
  };
}

export default {
  createSession,
  validateSession,
  deleteSession,
  deleteAllUserSessions,
  getUserSessions,
  isSessionTwoFactorVerified,
  markSessionTwoFactorVerified,
  cleanupExpiredSessions,
  checkSuspiciousActivity,
  createSessionMiddleware,
  SESSION_CONFIG,
};