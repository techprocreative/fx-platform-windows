/**
 * Type definitions for MT5 Auto-Installer Module
 * Based on WINDOWS_EXECUTOR_PLAN.md specifications
 */

export interface MT5Info {
  path: string;
  dataPath: string;
  version: string;
  build: number;
  libraryPath: string;
  expertsPath: string;
  isRunning: boolean;
  broker?: string;
  accountNumber?: string;
}

export interface InstallProgress {
  step: number;
  message: string;
  percentage?: number;
  currentOperation?: string;
}

export interface InstallResult {
  success: boolean;
  mt5Installations: MT5Info[];
  componentsInstalled: {
    libzmq: boolean;
    expertAdvisor: boolean;
    configFile: boolean;
  };
  errors: string[];
  warnings?: string[];
}

export interface SafetyLimits {
  maxDailyLoss: number;
  maxPositions: number;
  maxLotSize: number;
  maxDrawdownPercent: number;
}

export interface TradeParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface SafetyCheck {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export interface Command {
  id: string;
  command: string;
  parameters?: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
}

export interface TradeResult {
  success: boolean;
  ticket?: number;
  openPrice?: number;
  openTime?: string;
  error?: string;
}

export interface RegistryEntry {
  displayName: string;
  installLocation: string;
  version?: string;
  publisher?: string;
}

export interface FileOperationResult {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  backupPath?: string;
  error?: string;
}

export interface MT5ProcessInfo {
  pid: number;
  path: string;
  accountNumber?: string;
  broker?: string;
  isPortable: boolean;
}

export interface ZMQConfig {
  host: string;
  port: number;
  protocol: 'tcp' | 'ipc';
  timeout: number;
}

export interface EAConfig {
  executorId: string;
  apiKey: string;
  zmqPort: number;
  zmqHost: string;
  autoReconnect: boolean;
  heartbeatInterval: number;
  safetyLimits?: SafetyLimits;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

export interface ConnectionStatus {
  pusher: 'connected' | 'disconnected' | 'error';
  zeromq: 'connected' | 'disconnected' | 'error';
  api: 'connected' | 'disconnected' | 'error';
  mt5: 'connected' | 'disconnected' | 'error';
}

export interface ExecutorStatus {
  status: 'online' | 'offline' | 'error';
  metadata: {
    version: string;
    platform: string;
    accountBalance: number;
    accountEquity: number;
    openPositions: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  connections: ConnectionStatus;
  lastHeartbeat: Date;
}

export interface InstallationPaths {
  programFiles: string[];
  programFilesX86: string[];
  appDataLocal: string[];
  appDataRoaming: string[];
  registry: string[];
  custom: string[];
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  hash: string;
}

export interface FileHash {
  path: string;
  hash: string;
  algorithm: 'sha256' | 'md5';
  size: number;
  lastModified: Date;
}

export interface MT5Version {
  major: number;
  minor: number;
  build: number;
  releaseDate?: Date;
}

export interface BrokerInfo {
  name: string;
  server: string;
  company?: string;
  website?: string;
  support?: string;
}

export interface AccountInfo {
  number: string;
  broker: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  tradeMode: 'demo' | 'real';
}

export interface ErrorContext {
  operation: string;
  path?: string;
  timestamp: Date;
  stack?: string;
  systemInfo?: {
    os: string;
    arch: string;
    nodeVersion: string;
  };
}

export interface AutoInstallerConfig {
  forceUpdate: boolean;
  createBackups: boolean;
  verifyInstallation: boolean;
  autoAttachEA: boolean;
  defaultSymbol: string;
  defaultTimeframe: string;
}

export enum InstallerStep {
  DETECTING_MT5 = 1,
  INSTALLING_LIBZMQ = 2,
  INSTALLING_EXPERT_ADVISOR = 3,
  CREATING_CONFIG = 4,
  AUTO_ATTACHING_EA = 5,
  COMPLETED = 6,
  FAILED = -1
}

export enum Architecture {
  X86 = 'x86',
  X64 = 'x64'
}

export enum MT5InstallationType {
  STANDARD = 'standard',
  PORTABLE = 'portable',
  BROKER_SPECIFIC = 'broker-specific',
  CUSTOM = 'custom'
}