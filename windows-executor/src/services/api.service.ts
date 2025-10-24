import axios, { AxiosInstance, AxiosError } from 'axios';
import { AppConfig } from '../types/config.types';
import { Command } from '../types/command.types';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface HeartbeatPayload {
  status: 'online' | 'offline' | 'error';
  metadata: {
    version: string;
    platform: string;
    accountBalance?: number;
    accountEquity?: number;
    openPositions?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    timestamp: string;
  };
}

interface HeartbeatResponse {
  success: boolean;
  pendingCommands?: Command[];
  serverTime?: string;
}

export class ApiService {
  private client: AxiosInstance;
  private config: AppConfig | null = null;
  private log: (level: string, message: string, metadata?: any) => void;

  constructor(log?: (level: string, message: string, metadata?: any) => void) {
    this.log = log || console.log;
    
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FX-Executor/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.config) {
          config.headers['X-API-Key'] = this.config.apiKey;
          config.headers['X-API-Secret'] = this.config.apiSecret;
          config.headers['X-Executor-Id'] = this.config.executorId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.log('error', 'API request failed', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  configure(config: AppConfig): void {
    this.config = config;
    this.client.defaults.baseURL = config.platformUrl;
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<HeartbeatResponse> {
    try {
      const response = await this.client.post<HeartbeatResponse>(
        `/api/executor/${this.config?.executorId}/heartbeat`,
        payload
      );

      this.log('debug', 'Heartbeat sent successfully', response.data);
      return response.data;
    } catch (error) {
      this.log('error', 'Failed to send heartbeat', { error: (error as Error).message });
      throw error;
    }
  }

  async reportCommandResult(
    commandId: string,
    status: 'received' | 'executing' | 'executed' | 'failed' | 'cancelled',
    result: any
  ): Promise<void> {
    try {
      await this.client.patch(
        `/api/executor/${this.config?.executorId}/command`,
        {
          commandId,
          status,
          result,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('debug', 'Command result reported', { commandId, status });
    } catch (error) {
      this.log('error', 'Failed to report command result', {
        commandId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async reportTrade(trade: {
    ticket: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    openPrice: number;
    openTime: string;
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
  }): Promise<void> {
    try {
      await this.client.post(
        `/api/trades`,
        {
          executorId: this.config?.executorId,
          ...trade,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('info', 'Trade reported', { ticket: trade.ticket });
    } catch (error) {
      this.log('error', 'Failed to report trade', {
        ticket: trade.ticket,
        error: (error as Error).message,
      });
    }
  }

  async reportTradeClose(
    ticket: string,
    closePrice: number,
    closeTime: string,
    profit: number
  ): Promise<void> {
    try {
      await this.client.patch(
        `/api/trades/${ticket}`,
        {
          executorId: this.config?.executorId,
          closePrice,
          closeTime,
          profit,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('info', 'Trade close reported', { ticket, profit });
    } catch (error) {
      this.log('error', 'Failed to report trade close', {
        ticket,
        error: (error as Error).message,
      });
    }
  }

  async reportSafetyAlert(alert: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.client.post(
        `/api/alerts`,
        {
          executorId: this.config?.executorId,
          category: 'safety',
          ...alert,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('warn', 'Safety alert reported', alert);
    } catch (error) {
      this.log('error', 'Failed to report safety alert', {
        error: (error as Error).message,
      });
    }
  }

  async reportSecurityEvent(event: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.client.post(
        `/api/alerts`,
        {
          executorId: this.config?.executorId,
          category: 'security',
          ...event,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('error', 'Security event reported', event);
    } catch (error) {
      this.log('error', 'Failed to report security event', {
        error: (error as Error).message,
      });
    }
  }

  async reportError(error: {
    type: string;
    message: string;
    stack?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.client.post(
        `/api/errors/report`,
        {
          executorId: this.config?.executorId,
          ...error,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('error', 'Error reported to platform', error);
    } catch (err) {
      this.log('error', 'Failed to report error', {
        error: (err as Error).message,
      });
    }
  }

  async getPendingCommands(): Promise<Command[]> {
    try {
      const response = await this.client.get<ApiResponse<Command[]>>(
        `/api/executor/${this.config?.executorId}/commands/pending`
      );

      if (response.data.success && response.data.data) {
        this.log('debug', 'Retrieved pending commands', {
          count: response.data.data.length,
        });
        return response.data.data;
      }

      return [];
    } catch (error) {
      this.log('error', 'Failed to get pending commands', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  async updateExecutorStatus(status: 'online' | 'offline' | 'error' | 'maintenance'): Promise<void> {
    try {
      await this.client.patch(
        `/api/executor/${this.config?.executorId}`,
        {
          status,
          timestamp: new Date().toISOString(),
        }
      );

      this.log('info', 'Executor status updated', { status });
    } catch (error) {
      this.log('error', 'Failed to update executor status', {
        error: (error as Error).message,
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get<ApiResponse>(
        `/api/executor/${this.config?.executorId}/ping`
      );

      return response.data.success;
    } catch (error) {
      this.log('error', 'Connection test failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  async registerExecutor(executorData: {
    executorId: string;
    name?: string;
    mt5Version?: string;
    mt5Build?: number;
    broker?: string;
  }): Promise<boolean> {
    try {
      const response = await this.client.post<ApiResponse>(
        `/api/executor/register`,
        executorData
      );

      return response.data.success;
    } catch (error) {
      this.log('error', 'Failed to register executor', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey && !!this.config.executorId;
  }
}
