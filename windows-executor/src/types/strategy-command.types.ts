/**
 * Strategy Command Types
 * Commands for strategy lifecycle management
 */

import { Strategy } from './strategy.types';

export enum StrategyCommandType {
  START_STRATEGY = 'START_STRATEGY',
  STOP_STRATEGY = 'STOP_STRATEGY',
  PAUSE_STRATEGY = 'PAUSE_STRATEGY',
  RESUME_STRATEGY = 'RESUME_STRATEGY',
  UPDATE_STRATEGY = 'UPDATE_STRATEGY',
}

export interface StrategyCommand {
  id: string;
  type: StrategyCommandType;
  strategyId: string;
  executorId: string;
  strategy?: Strategy;
  updates?: Partial<Strategy>;
  timestamp: Date;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  metadata?: {
    source?: 'user' | 'system' | 'scheduler';
    reason?: string;
  };
}

export interface StrategyCommandResult {
  commandId: string;
  strategyId: string;
  success: boolean;
  message: string;
  timestamp: Date;
  metadata?: {
    monitoringStarted?: boolean;
    positionsClosed?: number;
    error?: string;
  };
}

export interface StartStrategyPayload {
  strategy: Strategy;
  options?: {
    startImmediately?: boolean;
    paperTrading?: boolean;
    maxDailyLoss?: number;
    maxPositions?: number;
  };
}

export interface StopStrategyPayload {
  strategyId: string;
  options?: {
    closePositions?: boolean;
    cancelOrders?: boolean;
    saveState?: boolean;
  };
}

export interface UpdateStrategyPayload {
  strategyId: string;
  updates: Partial<Strategy>;
  options?: {
    restartMonitoring?: boolean;
  };
}
