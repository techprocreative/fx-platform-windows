/**
 * Backtest Results Type Definitions
 * 
 * Defines the structure of backtest results stored in the database
 */

export interface BacktestTrade {
  id: string;
  type: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number;
  pips: number;
  duration: number;
  closeReason?: string;
}

export interface EquityCurvePoint {
  timestamp: Date;
  equity: number;
}

export interface BacktestMetadata {
  dataSource: string;
  totalDataPoints: number;
  executionTime: Date;
}

export interface BacktestResults {
  // Performance Metrics
  finalBalance: number;
  totalReturn: number;
  returnPercentage: number;
  
  // Risk Metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  
  // Trading Metrics
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  
  // Trade Details
  trades: BacktestTrade[];
  equityCurve: EquityCurvePoint[];
  
  // Metadata
  metadata: BacktestMetadata;
}

/**
 * Type guard to check if an object is BacktestResults
 */
export function isBacktestResults(obj: any): obj is BacktestResults {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.finalBalance === 'number' &&
    typeof obj.totalReturn === 'number' &&
    typeof obj.returnPercentage === 'number' &&
    typeof obj.winRate === 'number' &&
    typeof obj.totalTrades === 'number'
  );
}

/**
 * Default empty backtest results
 */
export const emptyBacktestResults: BacktestResults = {
  finalBalance: 0,
  totalReturn: 0,
  returnPercentage: 0,
  maxDrawdown: 0,
  maxDrawdownPercent: 0,
  winRate: 0,
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  averageWin: 0,
  averageLoss: 0,
  profitFactor: 0,
  sharpeRatio: 0,
  trades: [],
  equityCurve: [],
  metadata: {
    dataSource: '',
    totalDataPoints: 0,
    executionTime: new Date(),
  },
};
