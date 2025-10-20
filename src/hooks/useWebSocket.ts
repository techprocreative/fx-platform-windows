"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(prev => ({ ...prev, connected: true, connecting: false, error: null }));
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setStatus(prev => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setStatus(prev => ({ ...prev, connected: false, connecting: false }));
        wsRef.current = null;
        onDisconnect?.();

        // Attempt to reconnect if not explicitly closed
        if (!event.wasClean && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        setStatus(prev => ({ 
          ...prev, 
          connected: false, 
          connecting: false, 
          error: 'Connection error' 
        }));
        onError?.(error);
      };

    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        connecting: false, 
        error: error instanceof Error ? error.message : 'Failed to connect' 
      }));
    }
  }, [url, reconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnected by user');
      wsRef.current = null;
    }

    setStatus(prev => ({ 
      ...prev, 
      connected: false, 
      connecting: false 
    }));
  }, []);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((channel: string) => {
    return sendMessage('subscribe', { channel });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    return sendMessage('unsubscribe', { channel });
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    ...status,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
  };
}

// Specific hooks for different use cases
export function useBacktestStatus(backtestId?: string) {
  const [backtestStatus, setBacktestStatus] = useState<{
    status: string;
    progress?: number;
    currentStep?: string;
    error?: string;
  } | null>(null);

  const { connected, subscribe, unsubscribe, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'backtest:update' && message.payload.id === backtestId) {
        setBacktestStatus({
          status: message.payload.status,
          progress: message.payload.progress,
          currentStep: message.payload.currentStep,
          error: message.payload.error,
        });
      }
    },
  });

  useEffect(() => {
    if (backtestId && connected) {
      subscribe(`backtest:${backtestId}`);
      
      return () => {
        unsubscribe(`backtest:${backtestId}`);
      };
    }
    return undefined;
  }, [backtestId, connected, subscribe, unsubscribe]);

  return backtestStatus;
}

export function useTradeStatus() {
  const [trades, setTrades] = useState<any[]>([]);

  const { connected, subscribe, unsubscribe, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'trade:update') {
        setTrades(prev => {
          const existingIndex = prev.findIndex(t => t.id === message.payload.id);
          if (existingIndex >= 0) {
            const newTrades = [...prev];
            newTrades[existingIndex] = message.payload;
            return newTrades;
          }
          return [message.payload, ...prev];
        });
      }
    },
  });

  useEffect(() => {
    if (connected) {
      subscribe('trades');
      
      return () => {
        unsubscribe('trades');
      };
    }
    return undefined;
  }, [connected, subscribe, unsubscribe]);

  return trades;
}

export function useStrategyPerformance(strategyId?: string) {
  const [performance, setPerformance] = useState<{
    totalReturn: number;
    winRate: number;
    totalTrades: number;
    openPositions: number;
    lastUpdated: string;
  } | null>(null);

  const { connected, subscribe, unsubscribe, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'strategy:performance' && message.payload.strategyId === strategyId) {
        setPerformance({
          ...message.payload,
          lastUpdated: message.timestamp,
        });
      }
    },
  });

  useEffect(() => {
    if (strategyId && connected) {
      subscribe(`strategy:${strategyId}:performance`);
      
      return () => {
        unsubscribe(`strategy:${strategyId}:performance`);
      };
    }
    return undefined;
  }, [strategyId, connected, subscribe, unsubscribe]);

  return performance;
}