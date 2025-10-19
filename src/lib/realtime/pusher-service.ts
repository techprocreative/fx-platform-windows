/**
 * PUSHER SERVICE - Vercel Compatible WebSocket Alternative
 * Handles real-time communication for Vercel deployment
 */

import type { TradeCommand } from '@/lib/commands/queue';

// Dynamic imports to avoid build errors if not configured
let Pusher: any;
let PusherClient: any;

if (process.env.PUSHER_APP_ID) {
  Pusher = require('pusher');
}

if (process.env.NEXT_PUBLIC_PUSHER_KEY) {
  PusherClient = require('pusher-js');
}

// Server-side Pusher instance
export const getPusherServer = () => {
  if (!Pusher || !process.env.PUSHER_APP_ID) {
    console.warn('Pusher not configured. Realtime features disabled.');
    return null;
  }

  return new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
};

// Client-side Pusher instance (for browser)
export const getPusherClient = () => {
  if (!PusherClient || !process.env.NEXT_PUBLIC_PUSHER_KEY) {
    console.warn('Pusher client not configured');
    return null;
  }

  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    forceTLS: true,
  });
};

/**
 * Send command to specific executor
 */
export async function sendCommandToExecutor(
  executorId: string,
  command: TradeCommand
): Promise<boolean> {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      console.error('Pusher not configured');
      return false;
    }

    await pusher.trigger(
      `private-executor-${executorId}`,
      'trade-command',
      {
        ...command,
        timestamp: new Date().toISOString(),
      }
    );

    console.log(`Command sent to executor ${executorId} via Pusher`);
    return true;
  } catch (error) {
    console.error('Failed to send command via Pusher:', error);
    return false;
  }
}

/**
 * Broadcast command to all executors
 */
export async function broadcastCommand(command: any): Promise<boolean> {
  try {
    const pusher = getPusherServer();
    if (!pusher) {
      console.error('Pusher not configured');
      return false;
    }

    await pusher.trigger(
      'executors',
      'broadcast-command',
      {
        ...command,
        timestamp: new Date().toISOString(),
      }
    );

    console.log('Command broadcast to all executors');
    return true;
  } catch (error) {
    console.error('Failed to broadcast command:', error);
    return false;
  }
}

/**
 * Send execution result notification
 */
export async function notifyExecutionResult(
  userId: string,
  result: any
): Promise<void> {
  try {
    const pusher = getPusherServer();
    if (!pusher) return;

    await pusher.trigger(
      `private-user-${userId}`,
      'execution-result',
      result
    );
  } catch (error) {
    console.error('Failed to notify execution result:', error);
  }
}

/**
 * Send market update
 */
export async function broadcastMarketUpdate(data: any): Promise<void> {
  try {
    const pusher = getPusherServer();
    if (!pusher) return;

    await pusher.trigger(
      'market-data',
      'update',
      data
    );
  } catch (error) {
    console.error('Failed to broadcast market update:', error);
  }
}

/**
 * Authenticate Pusher channel subscription (for private channels)
 */
export async function authenticatePusherChannel(
  socketId: string,
  channelName: string,
  userId?: string
): Promise<any> {
  const pusher = getPusherServer();
  if (!pusher) {
    throw new Error('Pusher not configured');
  }

  // Validate channel access based on user permissions
  if (channelName.startsWith('private-executor-')) {
    // Verify executor ownership
    const executorId = channelName.replace('private-executor-', '');
    // Add validation logic here
  }

  if (channelName.startsWith('private-user-')) {
    // Verify user match
    const channelUserId = channelName.replace('private-user-', '');
    if (channelUserId !== userId) {
      throw new Error('Unauthorized channel access');
    }
  }

  // Generate auth response
  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return authResponse;
}

/**
 * Check if realtime service is configured
 */
export function isRealtimeConfigured(): boolean {
  return !!(
    process.env.PUSHER_APP_ID &&
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
    process.env.PUSHER_SECRET &&
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

/**
 * Get realtime service status
 */
export function getRealtimeStatus(): {
  configured: boolean;
  service: 'pusher' | 'websocket' | 'none';
  fallbackEnabled: boolean;
} {
  return {
    configured: isRealtimeConfigured(),
    service: isRealtimeConfigured() ? 'pusher' : 'none',
    fallbackEnabled: !!process.env.ENABLE_WEBSOCKET_FALLBACK,
  };
}
