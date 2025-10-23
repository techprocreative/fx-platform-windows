/**
 * Market Session Awareness Module
 * 
 * This module provides functionality to detect market sessions and optimize
 * trading strategies based on session-specific characteristics.
 */

import { MarketSessions, MarketSessionInfo, SessionFilter } from '../../types';

// Define market sessions with their optimal trading pairs
export const MARKET_SESSIONS: MarketSessions = {
  sydney: {
    start: "22:00",
    end: "07:00",
    pairs: ["AUDUSD", "NZDUSD"],
    description: "Sydney Session - Asian Pacific trading"
  },
  tokyo: {
    start: "00:00",
    end: "09:00",
    pairs: ["USDJPY", "EURJPY", "AUDJPY", "NZDJPY"],
    description: "Tokyo Session - Major Asian trading hub"
  },
  london: {
    start: "08:00",
    end: "17:00",
    pairs: ["EURUSD", "GBPUSD", "EURGBP", "USDCHF"],
    description: "London Session - Highest volume session"
  },
  newYork: {
    start: "13:00",
    end: "22:00",
    pairs: ["EURUSD", "USDCAD", "USDJPY", "GBPUSD"],
    description: "New York Session - US market hours"
  }
};

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time in minutes since midnight (UTC)
 */
function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

/**
 * Check if a time is within a session's time range
 * Handles sessions that cross midnight
 */
function isTimeInSession(currentMinutes: number, session: MarketSessionInfo): boolean {
  const startMinutes = timeToMinutes(session.start);
  const endMinutes = timeToMinutes(session.end);
  
  // Session doesn't cross midnight
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  
  // Session crosses midnight (e.g., Sydney: 22:00-07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Get the currently active market session(s)
 */
export function getCurrentSession(): Array<keyof MarketSessions> {
  const currentMinutes = getCurrentTimeMinutes();
  const activeSessions: Array<keyof MarketSessions> = [];
  
  for (const [sessionName, sessionInfo] of Object.entries(MARKET_SESSIONS)) {
    if (isTimeInSession(currentMinutes, sessionInfo)) {
      activeSessions.push(sessionName as keyof MarketSessions);
    }
  }
  
  return activeSessions;
}

/**
 * Check if a trading pair is optimal for a specific session
 */
export function isOptimalSessionPair(pair: string, session: keyof MarketSessions): boolean {
  const sessionInfo = MARKET_SESSIONS[session];
  return sessionInfo.pairs.includes(pair);
}

/**
 * Get all optimal pairs for currently active sessions
 */
export function getOptimalPairsForCurrentSessions(): string[] {
  const currentSessions = getCurrentSession();
  const optimalPairs = new Set<string>();
  
  for (const session of currentSessions) {
    const sessionInfo = MARKET_SESSIONS[session];
    sessionInfo.pairs.forEach(pair => optimalPairs.add(pair));
  }
  
  return Array.from(optimalPairs);
}

/**
 * Check if current time is optimal for trading a specific pair
 */
export function isOptimalTimeForPair(pair: string): boolean {
  const currentSessions = getCurrentSession();
  
  if (currentSessions.length === 0) {
    return false; // No active sessions
  }
  
  // Check if pair is optimal for any active session
  for (const session of currentSessions) {
    if (isOptimalSessionPair(pair, session)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get session aggressiveness multiplier based on optimal session/pair matching
 */
export function getSessionMultiplier(pair: string, sessionFilter?: SessionFilter): number {
  if (!sessionFilter || !sessionFilter.enabled) {
    return 1.0; // No session filtering, neutral multiplier
  }
  
  const currentSessions = getCurrentSession();
  
  if (currentSessions.length === 0) {
    return sessionFilter.aggressivenessMultiplier.suboptimal;
  }
  
  // Check if any current sessions are in allowed list
  const hasAllowedSession = currentSessions.some(session => 
    sessionFilter.allowedSessions.includes(session)
  );
  
  if (!hasAllowedSession) {
    return sessionFilter.aggressivenessMultiplier.suboptimal;
  }
  
  // Check if pair is optimal for current sessions
  if (sessionFilter.useOptimalPairs && isOptimalTimeForPair(pair)) {
    return sessionFilter.aggressivenessMultiplier.optimal;
  }
  
  // Trading in allowed session but not optimal pair
  return sessionFilter.aggressivenessMultiplier.suboptimal;
}

/**
 * Check if trading is allowed based on session filter
 */
export function isTradingAllowed(pair: string, sessionFilter?: SessionFilter): boolean {
  if (!sessionFilter || !sessionFilter.enabled) {
    return true; // No session filtering, always allowed
  }
  
  const currentSessions = getCurrentSession();
  
  if (currentSessions.length === 0) {
    return false; // No active sessions
  }
  
  // Check if any current sessions are in allowed list
  const hasAllowedSession = currentSessions.some(session => 
    sessionFilter.allowedSessions.includes(session)
  );
  
  if (!hasAllowedSession) {
    return false;
  }
  
  // If optimal pairs filter is enabled, check if pair is optimal
  if (sessionFilter.useOptimalPairs && !isOptimalTimeForPair(pair)) {
    return false;
  }
  
  return true;
}

/**
 * Get session information for display purposes
 */
export function getSessionInfo(session: keyof MarketSessions): MarketSessionInfo {
  return MARKET_SESSIONS[session];
}

/**
 * Get all available session names
 */
export function getAllSessionNames(): Array<keyof MarketSessions> {
  return Object.keys(MARKET_SESSIONS) as Array<keyof MarketSessions>;
}

/**
 * Get session overlap information (when multiple sessions are active)
 */
export function getSessionOverlaps(): Array<{
  sessions: Array<keyof MarketSessions>;
  start: string;
  end: string;
  description: string;
}> {
  return [
    {
      sessions: ['sydney', 'tokyo'],
      start: '00:00',
      end: '07:00',
      description: 'Asian Session Overlap'
    },
    {
      sessions: ['london', 'newYork'],
      start: '13:00',
      end: '17:00',
      description: 'London/New York Overlap (Highest Volume)'
    }
  ];
}

/**
 * Get current session context for AI strategy generation
 */
export function getCurrentSessionContext(): {
  activeSessions: Array<keyof MarketSessions>;
  isOptimalForPairs: Record<string, boolean>;
  recommendedPairs: string[];
  marketCondition: 'low' | 'medium' | 'high';
} {
  const activeSessions = getCurrentSession();
  const allPairs = Object.values(MARKET_SESSIONS).flatMap(session => session.pairs);
  const uniquePairs = Array.from(new Set(allPairs));
  
  const isOptimalForPairs: Record<string, boolean> = {};
  uniquePairs.forEach(pair => {
    isOptimalForPairs[pair] = isOptimalTimeForPair(pair);
  });
  
  const recommendedPairs = getOptimalPairsForCurrentSessions();
  
  // Determine market condition based on session activity
  let marketCondition: 'low' | 'medium' | 'high' = 'low';
  if (activeSessions.length >= 2) {
    marketCondition = 'high'; // Session overlap
  } else if (activeSessions.length === 1) {
    const session = activeSessions[0];
    if (session === 'london' || session === 'newYork') {
      marketCondition = 'high'; // Major sessions
    } else {
      marketCondition = 'medium'; // Asian sessions
    }
  }
  
  return {
    activeSessions,
    isOptimalForPairs,
    recommendedPairs,
    marketCondition
  };
}

/**
 * Default session filter configuration
 */
export const DEFAULT_SESSION_FILTER: SessionFilter = {
  enabled: false,
  allowedSessions: ['london', 'newYork'], // Default to major sessions
  useOptimalPairs: true,
  aggressivenessMultiplier: {
    optimal: 1.2,    // 20% more aggressive in optimal conditions
    suboptimal: 0.8  // 20% less aggressive in suboptimal conditions
  }
};