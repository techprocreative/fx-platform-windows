import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getEnvVar } from '../security/env-validator';

// TOTP configuration
const TOTP_OPTIONS = {
  window: 2, // Allow 2 time windows before and after for clock drift
  step: 30, // 30-second time step
};

/**
 * Generate a TOTP secret for a user
 * @param userId - User ID
 * @returns TOTP secret and QR code data URL
 */
export async function generateTOTPSecret(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
  try {
    // Generate a secure random secret
    const secret = authenticator.generateSecret();
    
    // Get issuer from environment
    const issuer = getEnvVar('TOTP_ISSUER');
    
    // Create TOTP URI for QR code generation
    const totpUri = authenticator.keyuri(userId, issuer, secret);
    
    // Generate QR code
    const qrCodeUrl = QRCode.toDataURL(totpUri);
    
    return { secret, qrCodeUrl };
  } catch (error) {
    console.error('Error generating TOTP secret:', error);
    throw new Error('Failed to generate TOTP secret');
  }
}

/**
 * Verify a TOTP token
 * @param token - 6-digit TOTP token
 * @param secret - User's TOTP secret
 * @returns Whether the token is valid
 */
export function verifyTOTPToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({
      token,
      secret,
      ...TOTP_OPTIONS,
    });
  } catch (error) {
    console.error('Error verifying TOTP token:', error);
    return false;
  }
}

/**
 * Generate backup codes for 2FA recovery
 * @param count - Number of backup codes to generate
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash backup codes for storage
 * @param codes - Array of backup codes
 * @returns Array of hashed backup codes
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => {
    const hash = crypto.createHash('sha256');
    hash.update(code);
    return hash.digest('hex');
  });
}

/**
 * Verify a backup code
 * @param code - Backup code to verify
 * @param hashedCodes - Array of hashed backup codes
 * @returns Whether the backup code is valid
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hash = crypto.createHash('sha256');
  hash.update(code.toUpperCase());
  const hashedCode = hash.digest('hex');
  
  return hashedCodes.includes(hashedCode);
}

/**
 * Generate a secure 2FA session token
 * @param userId - User ID
 * @returns 2FA session token
 */
export function generate2FASessionToken(userId: string): string {
  const data = `${userId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  const hash = crypto.createHmac('sha256', getEnvVar('TOTP_SECRET')).update(data).digest('hex');
  return `${data}-${hash}`;
}

/**
 * Verify a 2FA session token
 * @param token - 2FA session token
 * @param maxAge - Maximum age of the token in milliseconds (default: 5 minutes)
 * @returns Whether the token is valid
 */
export function verify2FASessionToken(token: string, maxAge: number = 5 * 60 * 1000): boolean {
  try {
    const parts = token.split('-');
    if (parts.length < 3) return false;
    
    const userId = parts[0];
    const timestamp = parseInt(parts[1]);
    const randomPart = parts.slice(2, -1).join('-');
    const hash = parts[parts.length - 1];
    
    // Check if token is expired
    if (Date.now() - timestamp > maxAge) return false;
    
    // Verify hash
    const data = `${userId}-${timestamp}-${randomPart}`;
    const expectedHash = crypto.createHmac('sha256', getEnvVar('TOTP_SECRET')).update(data).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (error) {
    console.error('Error verifying 2FA session token:', error);
    return false;
  }
}

/**
 * Check if 2FA is required for a specific operation
 * @param operation - Operation type
 * @param userId - User ID
 * @returns Whether 2FA is required
 */
export async function is2FARequired(operation: string, userId: string): Promise<boolean> {
  try {
    // In a real implementation, you would check the user's 2FA settings
    // For now, we'll require 2FA for all trading operations
    
    const sensitiveOperations = [
      'trade_open',
      'trade_close',
      'trade_modify',
      'strategy_create',
      'strategy_delete',
      'api_key_create',
      'api_key_delete',
      'executor_create',
      'executor_delete',
    ];
    
    return sensitiveOperations.includes(operation);
  } catch (error) {
    console.error('Error checking 2FA requirement:', error);
    // Fail secure - require 2FA if we can't determine
    return true;
  }
}

/**
 * Send 2FA verification code via email
 * @param email - User's email
 * @param code - Verification code
 * @returns Whether the email was sent successfully
 */
export async function send2FAEmail(email: string, code: string): Promise<boolean> {
  try {
    // In a real implementation, you would use an email service like Resend
    // For now, we'll just log the code
    console.log(`2FA code for ${email}: ${code}`);
    return true;
  } catch (error) {
    console.error('Error sending 2FA email:', error);
    return false;
  }
}

/**
 * Send 2FA verification code via SMS
 * @param phoneNumber - User's phone number
 * @param code - Verification code
 * @returns Whether the SMS was sent successfully
 */
export async function send2FASMS(phoneNumber: string, code: string): Promise<boolean> {
  try {
    // In a real implementation, you would use an SMS service like Twilio
    // For now, we'll just log the code
    console.log(`2FA code for ${phoneNumber}: ${code}`);
    return true;
  } catch (error) {
    console.error('Error sending 2FA SMS:', error);
    return false;
  }
}

/**
 * Generate a numeric verification code for email/SMS
 * @param length - Length of the code (default: 6)
 * @returns Numeric verification code
 */
export function generateVerificationCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Store a 2FA attempt in the database
 * @param userId - User ID
 * @param type - Type of 2FA attempt (totp, email, sms, backup_code)
 * @param success - Whether the attempt was successful
 * @param ipAddress - IP address of the request
 * @param userAgent - User agent of the request
 */
export async function log2FAAttempt(
  userId: string,
  type: 'totp' | 'email' | 'sms' | 'backup_code',
  success: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    // In a real implementation, you would log this to the database
    console.log(`2FA attempt: ${userId}, ${type}, ${success}, ${ipAddress}`);
  } catch (error) {
    console.error('Error logging 2FA attempt:', error);
  }
}

/**
 * Check if a user has exceeded 2FA attempt limits
 * @param userId - User ID
 * @param windowMs - Time window in milliseconds (default: 15 minutes)
 * @param maxAttempts - Maximum allowed attempts (default: 5)
 * @returns Whether the user has exceeded the limit
 */
export async function hasExceeded2FALimits(
  userId: string,
  windowMs: number = 15 * 60 * 1000,
  maxAttempts: number = 5
): Promise<boolean> {
  try {
    // In a real implementation, you would check the database for recent failed attempts
    // For now, we'll just return false
    return false;
  } catch (error) {
    console.error('Error checking 2FA limits:', error);
    // Fail secure - assume limit exceeded if we can't check
    return true;
  }
}

export default {
  generateTOTPSecret,
  verifyTOTPToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  generate2FASessionToken,
  verify2FASessionToken,
  is2FARequired,
  send2FAEmail,
  send2FASMS,
  generateVerificationCode,
  log2FAAttempt,
  hasExceeded2FALimits,
};