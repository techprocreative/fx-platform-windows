/**
 * Pusher Server-side Configuration
 * 
 * This module provides server-side Pusher functionality for:
 * - Triggering events to executors
 * - Broadcasting status updates
 * - Sending commands via real-time channels
 * 
 * Used in API routes to push updates to connected clients.
 */

import Pusher from 'pusher';

// Singleton instance
let pusherInstance: Pusher | null = null;

/**
 * Get Pusher server instance (singleton)
 */
export function getPusherServer(): Pusher {
  if (pusherInstance) {
    return pusherInstance;
  }

  // Validate environment variables
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.warn('⚠️ Pusher not configured. Real-time features will be disabled.');
    console.warn('Missing env vars:', {
      appId: !!appId,
      key: !!key,
      secret: !!secret,
      cluster: !!cluster,
    });
    
    // Return mock instance for development
    return {
      trigger: async () => {
        console.log('Pusher mock: Event would be triggered here');
        return { channels: {}, event_id: 'mock' } as any;
      },
    } as any;
  }

  pusherInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: process.env.PUSHER_USE_TLS !== 'false',
  });

  console.log('✅ Pusher server initialized');
  return pusherInstance;
}

/**
 * Channel naming conventions
 */
export const PUSHER_CHANNELS = {
  // Private channel per executor for receiving commands
  executor: (executorId: string) => `private-executor-${executorId}`,
  
  // Private channel per user for notifications
  user: (userId: string) => `private-user-${userId}`,
  
  // Public broadcast channel for all executors
  broadcast: 'executors',
  
  // Public channel for system-wide notifications
  system: 'system',
};

/**
 * Event naming conventions
 */
export const PUSHER_EVENTS = {
  // Executor events
  COMMAND_RECEIVED: 'command-received',
  STATUS_UPDATE: 'status-update',
  HEARTBEAT: 'heartbeat',
  
  // Trade events
  TRADE_OPENED: 'trade-opened',
  TRADE_CLOSED: 'trade-closed',
  TRADE_MODIFIED: 'trade-modified',
  
  // Execution events
  EXECUTION_STARTED: 'execution-started',
  EXECUTION_COMPLETED: 'execution-completed',
  EXECUTION_FAILED: 'execution-failed',
  
  // System events
  EMERGENCY_STOP: 'emergency-stop',
  SYSTEM_ALERT: 'system-alert',
};

/**
 * Trigger a command to a specific executor
 */
export async function triggerExecutorCommand(
  executorId: string,
  command: {
    id: string;
    command: string;
    parameters?: any;
    priority: string;
  }
) {
  const pusher = getPusherServer();
  
  try {
    await pusher.trigger(
      PUSHER_CHANNELS.executor(executorId),
      PUSHER_EVENTS.COMMAND_RECEIVED,
      command
    );
    
    console.log(`✅ Command ${command.id} sent to executor ${executorId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send command to executor ${executorId}:`, error);
    return false;
  }
}

/**
 * Broadcast status update to all listeners
 */
export async function broadcastStatusUpdate(data: {
  executorId: string;
  status: string;
  timestamp: string;
}) {
  const pusher = getPusherServer();
  
  try {
    await pusher.trigger(
      PUSHER_CHANNELS.broadcast,
      PUSHER_EVENTS.STATUS_UPDATE,
      data
    );
    
    console.log(`✅ Status update broadcasted for executor ${data.executorId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to broadcast status update:', error);
    return false;
  }
}

/**
 * Send execution result to user
 */
export async function notifyUserExecution(
  userId: string,
  execution: {
    commandId: string;
    executorId: string;
    command: string;
    success: boolean;
    result?: any;
    timestamp: string;
  }
) {
  const pusher = getPusherServer();
  
  try {
    await pusher.trigger(
      PUSHER_CHANNELS.user(userId),
      PUSHER_EVENTS.EXECUTION_COMPLETED,
      execution
    );
    
    console.log(`✅ Execution result sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to notify user ${userId}:`, error);
    return false;
  }
}

/**
 * Trigger emergency stop to all executors
 */
export async function triggerEmergencyStop(data: {
  userId: string;
  reason: string;
  timestamp: string;
}) {
  const pusher = getPusherServer();
  
  try {
    await pusher.trigger(
      PUSHER_CHANNELS.broadcast,
      PUSHER_EVENTS.EMERGENCY_STOP,
      data
    );
    
    console.log('🚨 Emergency stop triggered');
    return true;
  } catch (error) {
    console.error('❌ Failed to trigger emergency stop:', error);
    return false;
  }
}

/**
 * Send trade notification
 */
export async function notifyTradeEvent(
  userId: string,
  event: 'opened' | 'closed' | 'modified',
  trade: {
    id: string;
    executorId: string;
    symbol: string;
    type: string;
    lots: number;
    price: number;
    profit?: number;
  }
) {
  const pusher = getPusherServer();
  
  const eventMap = {
    opened: PUSHER_EVENTS.TRADE_OPENED,
    closed: PUSHER_EVENTS.TRADE_CLOSED,
    modified: PUSHER_EVENTS.TRADE_MODIFIED,
  };
  
  try {
    await pusher.trigger(
      PUSHER_CHANNELS.user(userId),
      eventMap[event],
      trade
    );
    
    console.log(`✅ Trade ${event} notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to notify trade ${event}:`, error);
    return false;
  }
}
