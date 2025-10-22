/**
 * Pusher Client-side Configuration
 * 
 * This module provides client-side Pusher functionality for:
 * - Connecting to Pusher channels
 * - Receiving real-time updates
 * - Handling disconnections and reconnections
 */

import PusherJS from 'pusher-js';

// Singleton instance
let pusherInstance: PusherJS | null = null;

/**
 * Get Pusher client instance (singleton)
 */
export function getPusherClient(): PusherJS | null {
  // Return existing instance
  if (pusherInstance) {
    return pusherInstance;
  }

  // Check if running in browser
  if (typeof window === 'undefined') {
    return null;
  }

  // Validate environment variables
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    console.warn('⚠️ Pusher not configured on client. Real-time features will be disabled.');
    return null;
  }

  try {
    pusherInstance = new PusherJS(key, {
      cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      
      // Auth endpoint for private channels
      authEndpoint: '/api/pusher/auth',
      
      // Connection options
      activityTimeout: 30000, // 30 seconds
      pongTimeout: 10000, // 10 seconds
    });

    // Connection state logging
    pusherInstance.connection.bind('connected', () => {
      console.log('✅ Pusher connected');
    });

    pusherInstance.connection.bind('disconnected', () => {
      console.log('⚠️ Pusher disconnected');
    });

    pusherInstance.connection.bind('error', (err: any) => {
      console.error('❌ Pusher error:', err);
    });

    console.log('✅ Pusher client initialized');
    return pusherInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Pusher client:', error);
    return null;
  }
}

/**
 * Disconnect Pusher client
 */
export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
    console.log('✅ Pusher disconnected');
  }
}

/**
 * Check if Pusher is connected
 */
export function isPusherConnected(): boolean {
  return pusherInstance?.connection.state === 'connected';
}

/**
 * Get connection state
 */
export function getPusherState(): string {
  return pusherInstance?.connection.state || 'disconnected';
}
