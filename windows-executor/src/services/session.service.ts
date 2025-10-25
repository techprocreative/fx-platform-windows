/**
 * Enhanced Session Service
 * Manages trading sessions with optimal pair matching and aggressiveness multipliers
 */

import { logger } from '../utils/logger';

export interface TradingSession {
  name: string;
  start: string;
  end: string;
  optimalPairs: string[];
  description: string;
  volumeMultiplier: number;
}

export interface SessionAnalysis {
  currentSession: string | null;
  isOptimalSession: boolean;
  optimalPairs: string[];
  aggressivenessMultiplier: number;
  sessionOverlap: string[];
  recommendations: string[];
}

export class SessionService {
  
  private readonly MARKET_SESSIONS: Record<string, TradingSession> = {
    SYDNEY: {
      name: 'Sydney',
      start: '22:00',
      end: '07:00',
      optimalPairs: ['AUDUSD', 'NZDUSD', 'AUDNZD', 'AUDJPY'],
      description: 'Sydney Session - Lower volume',
      volumeMultiplier: 0.7
    },
    TOKYO: {
      name: 'Tokyo',
      start: '00:00',
      end: '09:00',
      optimalPairs: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CHFJPY'],
      description: 'Tokyo Session - Asian markets',
      volumeMultiplier: 0.8
    },
    LONDON: {
      name: 'London',
      start: '08:00',
      end: '17:00',
      optimalPairs: ['EURUSD', 'GBPUSD', 'EURGBP', 'USDCHF', 'GBPJPY', 'EURJPY'],
      description: 'London Session - Highest volume',
      volumeMultiplier: 1.5
    },
    NEWYORK: {
      name: 'New York',
      start: '13:00',
      end: '22:00',
      optimalPairs: ['EURUSD', 'GBPUSD', 'USDCAD', 'USDJPY', 'AUDUSD'],
      description: 'New York Session - High volume',
      volumeMultiplier: 1.3
    }
  };

  /**
   * Get current trading session
   */
  getCurrentSession(timezone: string = 'UTC'): string | null {
    const now = new Date();
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    for (const [sessionName, session] of Object.entries(this.MARKET_SESSIONS)) {
      if (this.isTimeInRange(currentTime, session.start, session.end)) {
        return sessionName;
      }
    }

    return null;
  }

  /**
   * Analyze session for a specific pair
   */
  analyzeSession(symbol: string, timezone: string = 'UTC'): SessionAnalysis {
    const currentSession = this.getCurrentSession(timezone);
    const activeOverlaps = this.getActiveSessionOverlaps();
    
    let isOptimalSession = false;
    let optimalPairs: string[] = [];
    let aggressivenessMultiplier = 1.0;
    const recommendations: string[] = [];

    if (currentSession) {
      const session = this.MARKET_SESSIONS[currentSession];
      optimalPairs = session.optimalPairs;
      isOptimalSession = session.optimalPairs.includes(symbol);

      // Calculate aggressiveness multiplier
      if (isOptimalSession) {
        aggressivenessMultiplier = session.volumeMultiplier;
        
        // Boost during session overlaps
        if (activeOverlaps.length > 0) {
          aggressivenessMultiplier *= 1.2;
          recommendations.push(`Session overlap detected: ${activeOverlaps.join(' + ')}`);
          recommendations.push('Increased volatility and volume expected');
        }

        recommendations.push(`Optimal session for ${symbol}`);
        recommendations.push(`Volume multiplier: ${aggressivenessMultiplier.toFixed(1)}x`);
      } else {
        aggressivenessMultiplier = 0.7;
        recommendations.push(`Suboptimal session for ${symbol}`);
        recommendations.push(`Consider trading: ${session.optimalPairs.slice(0, 3).join(', ')}`);
        recommendations.push(`Reduced position size recommended (${aggressivenessMultiplier}x)`);
      }
    } else {
      recommendations.push('Outside major trading sessions');
      recommendations.push('Lower liquidity expected');
      aggressivenessMultiplier = 0.5;
    }

    return {
      currentSession,
      isOptimalSession,
      optimalPairs,
      aggressivenessMultiplier,
      sessionOverlap: activeOverlaps,
      recommendations
    };
  }

  /**
   * Get active session overlaps
   */
  private getActiveSessionOverlaps(): string[] {
    const now = new Date();
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;
    const activeSessions: string[] = [];

    for (const [sessionName, session] of Object.entries(this.MARKET_SESSIONS)) {
      if (this.isTimeInRange(currentTime, session.start, session.end)) {
        activeSessions.push(sessionName);
      }
    }

    return activeSessions;
  }

  /**
   * Check if time is in range
   */
  private isTimeInRange(time: string, start: string, end: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    // Handle overnight sessions (e.g., Sydney)
    if (startMinutes > endMinutes) {
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Convert time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get optimal pairs for current session
   */
  getOptimalPairsForCurrentSession(): string[] {
    const currentSession = this.getCurrentSession();
    
    if (!currentSession) {
      return [];
    }

    return this.MARKET_SESSIONS[currentSession].optimalPairs;
  }

  /**
   * Check if pair is optimal for trading right now
   */
  isOptimalPair(symbol: string): boolean {
    const analysis = this.analyzeSession(symbol);
    return analysis.isOptimalSession;
  }

  /**
   * Get aggressiveness multiplier for symbol
   */
  getAggressivenessMultiplier(symbol: string): number {
    const analysis = this.analyzeSession(symbol);
    return analysis.aggressivenessMultiplier;
  }

  /**
   * Adjust position size based on session
   */
  adjustPositionSizeForSession(
    baseSize: number,
    symbol: string,
    useOptimalPairs: boolean = true
  ): { adjustedSize: number; reason: string } {
    
    if (!useOptimalPairs) {
      return {
        adjustedSize: baseSize,
        reason: 'Session-based adjustment disabled'
      };
    }

    const analysis = this.analyzeSession(symbol);
    const adjustedSize = baseSize * analysis.aggressivenessMultiplier;

    let reason = '';
    if (analysis.isOptimalSession) {
      reason = `Increased to ${adjustedSize.toFixed(2)} (${analysis.aggressivenessMultiplier}x) - optimal session`;
    } else {
      reason = `Reduced to ${adjustedSize.toFixed(2)} (${analysis.aggressivenessMultiplier}x) - suboptimal session`;
    }

    return { adjustedSize, reason };
  }

  /**
   * Get best trading times for a pair
   */
  getBestTradingTimesForPair(symbol: string): Array<{ session: string; multiplier: number }> {
    const bestTimes: Array<{ session: string; multiplier: number }> = [];

    for (const [sessionName, session] of Object.entries(this.MARKET_SESSIONS)) {
      if (session.optimalPairs.includes(symbol)) {
        bestTimes.push({
          session: `${session.name} (${session.start} - ${session.end} UTC)`,
          multiplier: session.volumeMultiplier
        });
      }
    }

    return bestTimes.sort((a, b) => b.multiplier - a.multiplier);
  }

  /**
   * Get all sessions info
   */
  getAllSessions(): Record<string, TradingSession> {
    return { ...this.MARKET_SESSIONS };
  }

  /**
   * Check if should trade based on session
   */
  shouldTradeInSession(
    symbol: string,
    allowedSessions: string[] = [],
    requireOptimalPair: boolean = false
  ): { shouldTrade: boolean; reason: string } {
    
    const currentSession = this.getCurrentSession();

    if (!currentSession) {
      return {
        shouldTrade: false,
        reason: 'Outside major trading sessions'
      };
    }

    // Check if current session is allowed
    if (allowedSessions.length > 0 && !allowedSessions.includes(currentSession)) {
      return {
        shouldTrade: false,
        reason: `Current session (${currentSession}) not in allowed sessions`
      };
    }

    // Check if pair is optimal
    if (requireOptimalPair) {
      const analysis = this.analyzeSession(symbol);
      
      if (!analysis.isOptimalSession) {
        return {
          shouldTrade: false,
          reason: `${symbol} not optimal for ${currentSession} session. Try: ${analysis.optimalPairs.slice(0, 2).join(', ')}`
        };
      }
    }

    return {
      shouldTrade: true,
      reason: `Trading allowed in ${currentSession} session`
    };
  }
}
