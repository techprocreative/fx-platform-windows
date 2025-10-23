import { 
  CorrelationMatrix, 
  CorrelationData, 
  CorrelationFilter, 
  CorrelationAnalysisResult,
  CorrelationGroup,
  CorrelationThreshold,
  HistoricalCorrelation
} from '@/types';

// Currency pair groupings by base currency
export const CURRENCY_GROUPS = {
  USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
  EUR: ['EURUSD', 'EURJPY', 'EURGBP', 'EURAUD', 'EURCHF'],
  GBP: ['GBPUSD', 'GBPJPY', 'EURGBP', 'GBPAUD', 'GBPCAD', 'GBPNZD'],
  JPY: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY'],
  AUD: ['AUDUSD', 'AUDJPY', 'EURAUD', 'AUDNZD', 'AUDCAD'],
  CAD: ['USDCAD', 'GBPCAD', 'AUDCAD'],
  NZD: ['NZDUSD', 'NZDJPY', 'AUDNZD', 'GBPNZD'],
  CHF: ['USDCHF', 'EURCHF']
};

// Major vs Minor vs Exotic pair classification
export const PAIR_CLASSIFICATIONS = {
  major: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
  minor: ['EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF', 'AUDNZD', 'NZDJPY', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDCAD'],
  exotic: ['USDMXN', 'USDTRY', 'USDZAR', 'USDNOK', 'USDSEK', 'USDSGD', 'USDHKD', 'USDCNH']
};

// Price data point interface
interface PriceDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Correlation calculation result
interface CorrelationCalculation {
  correlation: number;
  pValue: number;
  sampleSize: number;
  standardError: number;
  confidenceInterval: [number, number];
}

/**
 * Calculate Pearson correlation coefficient between two price series
 */
export function calculatePearsonCorrelation(
  series1: number[], 
  series2: number[]
): CorrelationCalculation {
  if (series1.length !== series2.length || series1.length < 2) {
    throw new Error('Series must have equal length and at least 2 data points');
  }

  const n = series1.length;
  
  // Calculate means
  const mean1 = series1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = series2.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate covariance and variances
  let covariance = 0;
  let variance1 = 0;
  let variance2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;
    
    covariance += diff1 * diff2;
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
  }
  
  covariance /= (n - 1);
  variance1 /= (n - 1);
  variance2 /= (n - 1);
  
  // Calculate correlation
  const correlation = covariance / Math.sqrt(variance1 * variance2);
  
  // Calculate p-value (two-tailed test)
  const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
  const pValue = 2 * (1 - tDistributionCDF(Math.abs(t), n - 2));
  
  // Calculate standard error and confidence interval
  const standardError = Math.sqrt((1 - correlation * correlation) / (n - 2));
  const tCritical = tDistributionInverse(0.975, n - 2); // 95% confidence
  const marginOfError = tCritical * standardError;
  const confidenceInterval: [number, number] = [
    correlation - marginOfError,
    correlation + marginOfError
  ];
  
  return {
    correlation: isNaN(correlation) ? 0 : correlation,
    pValue: isNaN(pValue) ? 1 : pValue,
    sampleSize: n,
    standardError: isNaN(standardError) ? 0 : standardError,
    confidenceInterval
  };
}

/**
 * Approximate t-distribution CDF (cumulative distribution function)
 */
function tDistributionCDF(t: number, df: number): number {
  // Simplified approximation for t-distribution CDF
  // For production use, consider using a proper statistics library
  const x = df / (df + t * t);
  const beta = 0.5 * df;
  return 1 - 0.5 * incompleteBeta(beta, 0.5, x);
}

/**
 * Approximate inverse t-distribution
 */
function tDistributionInverse(p: number, df: number): number {
  // Simplified approximation - for production use, use a proper statistics library
  // This is a rough approximation for common critical values
  if (p === 0.975) {
    if (df >= 30) return 1.96;
    if (df >= 20) return 2.086;
    if (df >= 10) return 2.228;
    return 2.776; // df = 5
  }
  return 1.96; // Default
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(a: number, b: number, x: number): number {
  // Simplified approximation - for production use, use a proper statistics library
  return Math.pow(x, a) * Math.pow(1 - x, b);
}

/**
 * Calculate returns from price series
 */
export function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

/**
 * Calculate correlation matrix for multiple currency pairs
 */
export async function calculateCorrelationMatrix(
  pairs: string[],
  priceData: Record<string, PriceDataPoint[]>,
  timeframe: string,
  lookbackPeriod: number,
  minDataPoints: number = 20
): Promise<CorrelationMatrix> {
  const correlations: Record<string, Record<string, CorrelationData>> = {};
  const validPairs: string[] = [];
  
  // Filter pairs with sufficient data
  for (const pair of pairs) {
    if (priceData[pair] && priceData[pair].length >= minDataPoints) {
      validPairs.push(pair);
    }
  }
  
  // Calculate correlations for all pair combinations
  for (let i = 0; i < validPairs.length; i++) {
    const pair1 = validPairs[i];
    correlations[pair1] = {};
    
    for (let j = 0; j < validPairs.length; j++) {
      const pair2 = validPairs[j];
      
      if (i === j) {
        // Self-correlation is always 1
        correlations[pair1][pair2] = {
          correlation: 1,
          pValue: 0,
          sampleSize: priceData[pair1].length,
          lastUpdated: new Date(),
          trend: 'stable',
          changeRate: 0
        };
      } else {
        try {
          // Extract close prices and calculate returns
          const prices1 = priceData[pair1].slice(-lookbackPeriod).map(p => p.close);
          const prices2 = priceData[pair2].slice(-lookbackPeriod).map(p => p.close);
          
          const returns1 = calculateReturns(prices1);
          const returns2 = calculateReturns(prices2);
          
          const calcResult = calculatePearsonCorrelation(returns1, returns2);
          
          // Determine trend (would need historical data for accurate assessment)
          const trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
          const changeRate = 0;
          
          correlations[pair1][pair2] = {
            correlation: calcResult.correlation,
            pValue: calcResult.pValue,
            sampleSize: calcResult.sampleSize,
            lastUpdated: new Date(),
            trend,
            changeRate
          };
        } catch (error) {
          console.error(`Error calculating correlation for ${pair1}-${pair2}:`, error);
          correlations[pair1][pair2] = {
            correlation: 0,
            pValue: 1,
            sampleSize: 0,
            lastUpdated: new Date(),
            trend: 'stable',
            changeRate: 0
          };
        }
      }
    }
  }
  
  // Calculate metadata
  const allCorrelations: number[] = [];
  for (let i = 0; i < validPairs.length; i++) {
    for (let j = i + 1; j < validPairs.length; j++) {
      const corr = correlations[validPairs[i]][validPairs[j]].correlation;
      if (!isNaN(corr)) {
        allCorrelations.push(Math.abs(corr));
      }
    }
  }
  
  const averageCorrelation = allCorrelations.length > 0 
    ? allCorrelations.reduce((sum, val) => sum + val, 0) / allCorrelations.length 
    : 0;
  const highestCorrelation = allCorrelations.length > 0 ? Math.max(...allCorrelations) : 0;
  const lowestCorrelation = allCorrelations.length > 0 ? Math.min(...allCorrelations) : 0;
  
  return {
    id: `corr_${Date.now()}`,
    timestamp: new Date(),
    timeframe,
    lookbackPeriod,
    correlations,
    metadata: {
      totalPairs: validPairs.length,
      averageCorrelation,
      highestCorrelation,
      lowestCorrelation,
      volatilityAdjusted: false
    }
  };
}

/**
 * Analyze correlation for a specific trading signal
 */
export function analyzeCorrelationForSignal(
  symbol: string,
  existingPositions: Array<{ symbol: string; size: number }>,
  correlationMatrix: CorrelationMatrix,
  filter: CorrelationFilter
): CorrelationAnalysisResult {
  if (!filter.enabled) {
    return {
      symbol,
      shouldSkip: false,
      conflictingPositions: [],
      recommendedAction: 'proceed',
      confidence: 100
    };
  }
  
  const conflictingPositions: Array<{ symbol: string; correlation: number; positionSize: number }> = [];
  let maxCorrelation = 0;
  
  // Check correlations with existing positions
  for (const position of existingPositions) {
    const correlation = correlationMatrix.correlations[symbol]?.[position.symbol]?.correlation || 0;
    
    if (Math.abs(correlation) >= filter.maxCorrelation) {
      conflictingPositions.push({
        symbol: position.symbol,
        correlation,
        positionSize: position.size
      });
      maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
    }
  }
  
  // Determine if signal should be skipped
  const shouldSkip = conflictingPositions.length > 0 && filter.skipHighlyCorrelated;
  
  // Determine recommended action
  let recommendedAction: 'proceed' | 'skip' | 'reduce_size' = 'proceed';
  let adjustedPositionSize: number | undefined;
  
  if (shouldSkip) {
    recommendedAction = 'skip';
  } else if (conflictingPositions.length > 0 && !filter.skipHighlyCorrelated) {
    recommendedAction = 'reduce_size';
    // Reduce position size based on correlation strength
    const correlationFactor = 1 - (maxCorrelation - filter.maxCorrelation) / (1 - filter.maxCorrelation);
    adjustedPositionSize = Math.max(0.1, correlationFactor);
  }
  
  // Calculate confidence based on correlation strength
  const confidence = shouldSkip 
    ? Math.max(0, 100 - (maxCorrelation * 100))
    : Math.max(50, 100 - (maxCorrelation * 50));
  
  return {
    symbol,
    shouldSkip,
    reason: shouldSkip 
      ? `High correlation (${maxCorrelation.toFixed(2)}) with existing positions: ${conflictingPositions.map(p => p.symbol).join(', ')}`
      : conflictingPositions.length > 0
      ? `Moderate correlation detected, position size recommended to be reduced`
      : undefined,
    conflictingPositions,
    recommendedAction,
    adjustedPositionSize,
    confidence
  };
}

/**
 * Group currency pairs by base currency
 */
export function groupPairsByCurrency(pairs: string[]): CorrelationGroup[] {
  const groups: CorrelationGroup[] = [];
  
  for (const [currency, currencyPairs] of Object.entries(CURRENCY_GROUPS)) {
    const validPairs = pairs.filter(pair => currencyPairs.includes(pair));
    
    if (validPairs.length > 1) {
      groups.push({
        currency,
        pairs: validPairs,
        averageInternalCorrelation: 0, // Would need correlation matrix to calculate
        riskFactor: validPairs.length > 3 ? 0.8 : 0.5 // Simple heuristic
      });
    }
  }
  
  return groups;
}

/**
 * Calculate dynamic correlation thresholds based on market volatility
 */
export function calculateDynamicThresholds(
  correlationMatrix: CorrelationMatrix,
  volatilityData: Record<string, number>,
  baseThreshold: number = 0.7
): CorrelationThreshold[] {
  const thresholds: CorrelationThreshold[] = [];
  
  for (const symbol of Object.keys(correlationMatrix.correlations)) {
    const volatility = volatilityData[symbol] || 0.02; // Default volatility
    const volatilityMultiplier = Math.min(2, Math.max(0.5, 1 / volatility));
    const adjustedThreshold = baseThreshold * volatilityMultiplier;
    
    thresholds.push({
      symbol,
      threshold: Math.min(0.95, adjustedThreshold),
      adjustedForVolatility: true,
      volatilityMultiplier
    });
  }
  
  return thresholds;
}

/**
 * Calculate historical correlation trends
 */
export function calculateHistoricalCorrelation(
  symbol1: string,
  symbol2: string,
  historicalData: Array<{ date: Date; correlation: number; volatility: number }>
): HistoricalCorrelation {
  const correlations = historicalData.map(d => d.correlation);
  const mean = correlations.reduce((sum, val) => sum + val, 0) / correlations.length;
  
  // Calculate standard deviation
  const variance = correlations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / correlations.length;
  const stdDev = Math.sqrt(variance);
  
  const min = Math.min(...correlations);
  const max = Math.max(...correlations);
  
  // Determine trend
  const recentCorrelations = correlations.slice(-10);
  const olderCorrelations = correlations.slice(-20, -10);
  const recentAvg = recentCorrelations.reduce((sum, val) => sum + val, 0) / recentCorrelations.length;
  const olderAvg = olderCorrelations.length > 0 
    ? olderCorrelations.reduce((sum, val) => sum + val, 0) / olderCorrelations.length 
    : recentAvg;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 0.05) trend = 'increasing';
  else if (recentAvg < olderAvg - 0.05) trend = 'decreasing';
  
  return {
    symbol1,
    symbol2,
    timeframe: 'D1', // Default timeframe
    dataPoints: historicalData,
    statistics: {
      mean,
      stdDev,
      min,
      max,
      trend
    }
  };
}

/**
 * Validate correlation filter configuration
 */
export function validateCorrelationFilter(filter: CorrelationFilter): string[] {
  const errors: string[] = [];
  
  if (!filter.enabled) return errors;
  
  if (filter.maxCorrelation < 0.1 || filter.maxCorrelation > 1.0) {
    errors.push('Maximum correlation must be between 0.1 and 1.0');
  }
  
  if (filter.lookbackPeriod < 7 || filter.lookbackPeriod > 365) {
    errors.push('Lookback period must be between 7 and 365 days');
  }
  
  if (filter.minDataPoints < 10 || filter.minDataPoints > 1000) {
    errors.push('Minimum data points must be between 10 and 1000');
  }
  
  if (filter.updateFrequency < 1 || filter.updateFrequency > 168) {
    errors.push('Update frequency must be between 1 and 168 hours');
  }
  
  if (filter.timeframes.length === 0) {
    errors.push('At least one timeframe must be selected');
  }
  
  return errors;
}

/**
 * Get recommended pairs for correlation analysis based on the main symbol
 */
export function getRecommendedPairs(symbol: string, allPairs: string[]): string[] {
  // Extract base and quote currencies
  const baseCurrency = symbol.slice(0, 3);
  const quoteCurrency = symbol.slice(3, 6);
  
  // Find pairs with same base or quote currency
  const relatedPairs = allPairs.filter(pair => {
    if (pair === symbol) return false;
    const pairBase = pair.slice(0, 3);
    const pairQuote = pair.slice(3, 6);
    return pairBase === baseCurrency || pairQuote === quoteCurrency ||
           pairBase === quoteCurrency || pairQuote === baseCurrency;
  });
  
  // Add some major pairs if not enough related pairs
  const majorPairs = PAIR_CLASSIFICATIONS.major.filter(p => p !== symbol && !relatedPairs.includes(p));
  const additionalPairs = majorPairs.slice(0, 5 - relatedPairs.length);
  
  return [...relatedPairs, ...additionalPairs].slice(0, 10);
}
