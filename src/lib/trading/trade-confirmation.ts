import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getEnvVar } from '../security/env-validator';
import { send2FAEmail, send2FASMS, generateVerificationCode } from '../auth/two-factor';

const prisma = new PrismaClient();

// Trade confirmation types
export enum ConfirmationType {
  EMAIL = 'email',
  SMS = 'sms',
  TOTP = 'totp',
  BACKUP_CODE = 'backup_code',
}

// Trade confirmation status
export enum ConfirmationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

// Trade confirmation request interface
export interface TradeConfirmationRequest {
  userId: string;
  symbol: string;
  type: string; // BUY, SELL
  lots: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  tradeId?: string;
  confirmationType: ConfirmationType;
}

// Trade confirmation result interface
export interface TradeConfirmationResult {
  success: boolean;
  confirmationId?: string;
  confirmationCode?: string;
  message?: string;
  expiresAt?: Date;
}

/**
 * Create a trade confirmation request
 * @param request - Trade confirmation request
 * @returns Trade confirmation result
 */
export async function createTradeConfirmation(
  request: TradeConfirmationRequest
): Promise<TradeConfirmationResult> {
  try {
    // Generate a unique confirmation code
    const confirmationCode = generateVerificationCode();
    
    // Set expiration time (default: 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Create trade confirmation record
    const tradeConfirmation = await prisma.tradeConfirmation.create({
      data: {
        userId: request.userId,
        tradeId: request.tradeId,
        symbol: request.symbol,
        type: request.type,
        lots: request.lots,
        price: request.price,
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        confirmationCode,
        expiresAt,
      },
    });
    
    // Send confirmation based on type
    let message = 'Confirmation code sent';
    switch (request.confirmationType) {
      case ConfirmationType.EMAIL:
        const user = await prisma.user.findUnique({
          where: { id: request.userId },
        });
        if (user?.email) {
          await sendTradeConfirmationEmail(user.email, confirmationCode, request);
        }
        message = 'Confirmation code sent to your email';
        break;
        
      case ConfirmationType.SMS:
        const userWithPhone = await prisma.user.findUnique({
          where: { id: request.userId },
        });
        if (userWithPhone?.phoneNumber) {
          await sendTradeConfirmationSMS(userWithPhone.phoneNumber, confirmationCode, request);
        }
        message = 'Confirmation code sent to your phone';
        break;
        
      case ConfirmationType.TOTP:
        // For TOTP, we don't send a code, the user uses their authenticator app
        message = 'Please use your authenticator app to confirm this trade';
        break;
        
      case ConfirmationType.BACKUP_CODE:
        message = 'Please use one of your backup codes to confirm this trade';
        break;
    }
    
    // Log the confirmation request
    await logTradeConfirmationEvent(
      request.userId,
      tradeConfirmation.id,
      'CREATED',
      request.confirmationType,
      request
    );
    
    return {
      success: true,
      confirmationId: tradeConfirmation.id,
      confirmationCode: request.confirmationType === ConfirmationType.TOTP ? undefined : confirmationCode,
      message,
      expiresAt,
    };
  } catch (error) {
    console.error('Error creating trade confirmation:', error);
    return {
      success: false,
      message: 'Failed to create trade confirmation',
    };
  }
}

/**
 * Verify a trade confirmation code
 * @param confirmationId - Trade confirmation ID
 * @param code - Confirmation code provided by user
 * @param userId - User ID
 * @returns Whether the confirmation is valid
 */
export async function verifyTradeConfirmation(
  confirmationId: string,
  code: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Get the trade confirmation
    const tradeConfirmation = await prisma.tradeConfirmation.findUnique({
      where: { id: confirmationId },
    });
    
    if (!tradeConfirmation) {
      return { success: false, message: 'Invalid confirmation ID' };
    }
    
    // Check if the confirmation belongs to the user
    if (tradeConfirmation.userId !== userId) {
      return { success: false, message: 'Unauthorized confirmation attempt' };
    }
    
    // Check if the confirmation has already been confirmed
    if (tradeConfirmation.isConfirmed) {
      return { success: false, message: 'Trade already confirmed' };
    }
    
    // Check if the confirmation has expired
    if (tradeConfirmation.isExpired || new Date() > tradeConfirmation.expiresAt) {
      // Mark as expired
      await prisma.tradeConfirmation.update({
        where: { id: confirmationId },
        data: { isExpired: true },
      });
      
      return { success: false, message: 'Confirmation code has expired' };
    }
    
    // Verify the confirmation code
    if (tradeConfirmation.confirmationCode !== code) {
      await logTradeConfirmationEvent(
        userId,
        confirmationId,
        'FAILED',
        'code',
        { providedCode: code }
      );
      
      return { success: false, message: 'Invalid confirmation code' };
    }
    
    // Mark the confirmation as confirmed
    await prisma.tradeConfirmation.update({
      where: { id: confirmationId },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
      },
    });
    
    // Log the successful confirmation
    await logTradeConfirmationEvent(
      userId,
      confirmationId,
      'CONFIRMED',
      'code',
      { confirmedAt: new Date() }
    );
    
    return { success: true, message: 'Trade confirmed successfully' };
  } catch (error) {
    console.error('Error verifying trade confirmation:', error);
    return { success: false, message: 'Failed to verify trade confirmation' };
  }
}

/**
 * Cancel a trade confirmation
 * @param confirmationId - Trade confirmation ID
 * @param userId - User ID
 * @returns Whether the cancellation was successful
 */
export async function cancelTradeConfirmation(
  confirmationId: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Get the trade confirmation
    const tradeConfirmation = await prisma.tradeConfirmation.findUnique({
      where: { id: confirmationId },
    });
    
    if (!tradeConfirmation) {
      return { success: false, message: 'Invalid confirmation ID' };
    }
    
    // Check if the confirmation belongs to the user
    if (tradeConfirmation.userId !== userId) {
      return { success: false, message: 'Unauthorized cancellation attempt' };
    }
    
    // Check if the confirmation has already been confirmed
    if (tradeConfirmation.isConfirmed) {
      return { success: false, message: 'Cannot cancel a confirmed trade' };
    }
    
    // Delete the confirmation
    await prisma.tradeConfirmation.delete({
      where: { id: confirmationId },
    });
    
    // Log the cancellation
    await logTradeConfirmationEvent(
      userId,
      confirmationId,
      'CANCELLED',
      'user',
      { cancelledAt: new Date() }
    );
    
    return { success: true, message: 'Trade confirmation cancelled' };
  } catch (error) {
    console.error('Error cancelling trade confirmation:', error);
    return { success: false, message: 'Failed to cancel trade confirmation' };
  }
}

/**
 * Check if a trade requires confirmation based on its value
 * @param userId - User ID
 * @param tradeValue - Value of the trade in USD
 * @returns Whether confirmation is required
 */
export async function isTradeConfirmationRequired(
  userId: string,
  tradeValue: number
): Promise<boolean> {
  try {
    // Get the large trade threshold from environment
    const largeTradeThreshold = getEnvVar('LARGE_TRADE_THRESHOLD');
    
    // Check if the trade value exceeds the threshold
    return tradeValue >= largeTradeThreshold;
  } catch (error) {
    console.error('Error checking trade confirmation requirement:', error);
    // Fail secure - require confirmation if we can't determine
    return true;
  }
}

/**
 * Send trade confirmation email
 * @param email - Email address
 * @param code - Confirmation code
 * @param tradeDetails - Trade details
 */
async function sendTradeConfirmationEmail(
  email: string,
  code: string,
  tradeDetails: TradeConfirmationRequest
): Promise<void> {
  try {
    const subject = 'Trade Confirmation Required';
    const text = `
      Please confirm your trade:
      
      Symbol: ${tradeDetails.symbol}
      Type: ${tradeDetails.type}
      Lots: ${tradeDetails.lots}
      Price: ${tradeDetails.price || 'Market'}
      Stop Loss: ${tradeDetails.stopLoss || 'Not set'}
      Take Profit: ${tradeDetails.takeProfit || 'Not set'}
      
      Confirmation Code: ${code}
      
      This code will expire in 10 minutes.
    `;
    
    await send2FAEmail(email, text);
  } catch (error) {
    console.error('Error sending trade confirmation email:', error);
    throw error;
  }
}

/**
 * Send trade confirmation SMS
 * @param phoneNumber - Phone number
 * @param code - Confirmation code
 * @param tradeDetails - Trade details
 */
async function sendTradeConfirmationSMS(
  phoneNumber: string,
  code: string,
  tradeDetails: TradeConfirmationRequest
): Promise<void> {
  try {
    const message = `
      NexusTrade: Confirm ${tradeDetails.type} ${tradeDetails.lots} ${tradeDetails.symbol} at ${tradeDetails.price || 'market'}. Code: ${code}. Expires in 10 min.
    `;
    
    await send2FASMS(phoneNumber, message);
  } catch (error) {
    console.error('Error sending trade confirmation SMS:', error);
    throw error;
  }
}

/**
 * Log trade confirmation events
 * @param userId - User ID
 * @param confirmationId - Confirmation ID
 * @param event - Event type
 * @param method - Confirmation method
 * @param metadata - Additional metadata
 */
async function logTradeConfirmationEvent(
  userId: string,
  confirmationId: string,
  event: string,
  method: string,
  metadata?: any
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: 'TRADE_CONFIRMATION',
        resource: 'TRADE',
        action: event,
        result: event === 'CONFIRMED' ? 'SUCCESS' : event === 'FAILED' ? 'FAILED' : 'PENDING',
        metadata: {
          confirmationId,
          method,
          ...metadata,
        },
      },
    });
  } catch (error) {
    console.error('Error logging trade confirmation event:', error);
  }
}

/**
 * Clean up expired trade confirmations
 * @returns Number of cleaned up confirmations
 */
export async function cleanupExpiredConfirmations(): Promise<number> {
  try {
    const result = await prisma.tradeConfirmation.updateMany({
      where: {
        isConfirmed: false,
        isExpired: false,
        expiresAt: { lt: new Date() },
      },
      data: {
        isExpired: true,
      },
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired confirmations:', error);
    return 0;
  }
}

/**
 * Get pending trade confirmations for a user
 * @param userId - User ID
 * @returns Array of pending trade confirmations
 */
export async function getPendingConfirmations(userId: string): Promise<any[]> {
  try {
    return await prisma.tradeConfirmation.findMany({
      where: {
        userId,
        isConfirmed: false,
        isExpired: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Error getting pending confirmations:', error);
    return [];
  }
}

export default {
  createTradeConfirmation,
  verifyTradeConfirmation,
  cancelTradeConfirmation,
  isTradeConfirmationRequired,
  cleanupExpiredConfirmations,
  getPendingConfirmations,
  ConfirmationType,
  ConfirmationStatus,
};