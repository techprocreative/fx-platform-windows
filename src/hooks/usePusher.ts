/**
 * React Hook for Pusher Integration
 * 
 * Provides easy-to-use React hooks for real-time updates
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getPusherClient, isPusherConnected, getPusherState } from '@/lib/pusher/client';
import type { Channel } from 'pusher-js';

/**
 * Hook to get Pusher connection status
 */
export function usePusherConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const updateState = () => {
      setIsConnected(isPusherConnected());
      setConnectionState(getPusherState());
    };

    // Initial state
    updateState();

    // Listen to connection state changes
    pusher.connection.bind('state_change', updateState);

    return () => {
      pusher.connection.unbind('state_change', updateState);
    };
  }, []);

  return { isConnected, connectionState };
}

/**
 * Hook to subscribe to a Pusher channel
 */
export function usePusherChannel(channelName: string) {
  const [channel, setChannel] = useState<Channel | null>(null);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const subscribedChannel = pusher.subscribe(channelName);
    setChannel(subscribedChannel);

    return () => {
      subscribedChannel.unsubscribe();
    };
  }, [channelName]);

  return channel;
}

/**
 * Hook to listen to executor commands
 */
export function useExecutorCommands(executorId: string | null) {
  const [commands, setCommands] = useState<any[]>([]);
  const channel = usePusherChannel(
    executorId ? `private-executor-${executorId}` : ''
  );

  useEffect(() => {
    if (!channel) return;

    const handleCommand = (data: any) => {
      setCommands((prev) => [data, ...prev.slice(0, 99)]); // Keep last 100
    };

    channel.bind('command-received', handleCommand);

    return () => {
      channel.unbind('command-received', handleCommand);
    };
  }, [channel]);

  return commands;
}

/**
 * Hook to listen to executor status updates
 */
export function useExecutorStatus() {
  const [updates, setUpdates] = useState<any[]>([]);
  const channel = usePusherChannel('executors');

  useEffect(() => {
    if (!channel) return;

    const handleStatusUpdate = (data: any) => {
      setUpdates((prev) => [data, ...prev.slice(0, 49)]); // Keep last 50
    };

    channel.bind('status-update', handleStatusUpdate);

    return () => {
      channel.unbind('status-update', handleStatusUpdate);
    };
  }, [channel]);

  return updates;
}

/**
 * Hook to listen to user notifications and executions
 */
export function useUserNotifications() {
  const { data: session } = useSession();
  const [executions, setExecutions] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  
  const channel = usePusherChannel(
    session?.user?.id ? `private-user-${session.user.id}` : ''
  );

  useEffect(() => {
    if (!channel) return;

    const handleExecution = (data: any) => {
      setExecutions((prev) => [data, ...prev.slice(0, 99)]);
    };

    const handleTradeOpened = (data: any) => {
      setTrades((prev) => [{ ...data, event: 'opened' }, ...prev.slice(0, 49)]);
    };

    const handleTradeClosed = (data: any) => {
      setTrades((prev) => [{ ...data, event: 'closed' }, ...prev.slice(0, 49)]);
    };

    channel.bind('execution-completed', handleExecution);
    channel.bind('trade-opened', handleTradeOpened);
    channel.bind('trade-closed', handleTradeClosed);

    return () => {
      channel.unbind('execution-completed', handleExecution);
      channel.unbind('trade-opened', handleTradeOpened);
      channel.unbind('trade-closed', handleTradeClosed);
    };
  }, [channel]);

  return { executions, trades };
}

/**
 * Hook to listen for emergency stop events
 */
export function useEmergencyStop(onEmergencyStop?: () => void) {
  const channel = usePusherChannel('executors');

  useEffect(() => {
    if (!channel || !onEmergencyStop) return;

    channel.bind('emergency-stop', onEmergencyStop);

    return () => {
      channel.unbind('emergency-stop', onEmergencyStop);
    };
  }, [channel, onEmergencyStop]);
}
