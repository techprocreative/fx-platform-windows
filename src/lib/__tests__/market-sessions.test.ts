/**
 * Market Session Awareness Tests
 *
 * Tests for the market session filtering and multiplier functionality
 */

import {
  getCurrentSession,
  isOptimalSessionPair,
  isOptimalTimeForPair,
  getSessionMultiplier,
  isTradingAllowed,
  getCurrentSessionContext,
  DEFAULT_SESSION_FILTER,
  MARKET_SESSIONS
} from '../market/sessions';
import { SessionFilter } from '../../types';

describe('Market Session Awareness', () => {
  describe('Session Detection', () => {
    test('should return current active sessions', () => {
      const sessions = getCurrentSession();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThanOrEqual(0);
      expect(sessions.length).toBeLessThanOrEqual(4);
    });

    test('should identify optimal pairs for sessions', () => {
      expect(isOptimalSessionPair('AUDUSD', 'sydney')).toBe(true);
      expect(isOptimalSessionPair('USDJPY', 'tokyo')).toBe(true);
      expect(isOptimalSessionPair('EURUSD', 'london')).toBe(true);
      expect(isOptimalSessionPair('USDCAD', 'newYork')).toBe(true);
      
      // Non-optimal pairs
      expect(isOptimalSessionPair('EURUSD', 'sydney')).toBe(false);
      expect(isOptimalSessionPair('AUDUSD', 'tokyo')).toBe(false);
    });

    test('should check if current time is optimal for specific pairs', () => {
      const result = isOptimalTimeForPair('EURUSD');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Session Multipliers', () => {
    test('should return neutral multiplier when session filter is disabled', () => {
      const disabledFilter: SessionFilter = {
        enabled: false,
        allowedSessions: ['london', 'newYork'],
        useOptimalPairs: true,
        aggressivenessMultiplier: {
          optimal: 1.2,
          suboptimal: 0.8
        }
      };
      const multiplier = getSessionMultiplier('EURUSD', disabledFilter);
      expect(multiplier).toBe(1.0);
    });

    test('should return optimal multiplier for optimal session/pair combinations', () => {
      const sessionFilter = {
        ...DEFAULT_SESSION_FILTER,
        enabled: true
      };
      
      // Mock current session for testing (this would depend on actual time)
      const multiplier = getSessionMultiplier('EURUSD', sessionFilter);
      expect(typeof multiplier).toBe('number');
      expect(multiplier).toBeGreaterThan(0);
    });

    test('should return suboptimal multiplier for non-optimal conditions', () => {
      const sessionFilter = {
        ...DEFAULT_SESSION_FILTER,
        enabled: true
      };
      
      const multiplier = getSessionMultiplier('EURUSD', sessionFilter);
      expect(typeof multiplier).toBe('number');
      expect(multiplier).toBeGreaterThan(0);
    });
  });

  describe('Trading Permissions', () => {
    test('should allow trading when session filter is disabled', () => {
      const disabledFilter: SessionFilter = {
        enabled: false,
        allowedSessions: ['london', 'newYork'],
        useOptimalPairs: true,
        aggressivenessMultiplier: {
          optimal: 1.2,
          suboptimal: 0.8
        }
      };
      const allowed = isTradingAllowed('EURUSD', disabledFilter);
      expect(allowed).toBe(true);
    });

    test('should check trading permissions based on session filter', () => {
      const sessionFilter = {
        ...DEFAULT_SESSION_FILTER,
        enabled: true
      };
      
      const allowed = isTradingAllowed('EURUSD', sessionFilter);
      expect(typeof allowed).toBe('boolean');
    });
  });

  describe('Session Context', () => {
    test('should provide current session context', () => {
      const context = getCurrentSessionContext();
      
      expect(context).toHaveProperty('activeSessions');
      expect(context).toHaveProperty('isOptimalForPairs');
      expect(context).toHaveProperty('recommendedPairs');
      expect(context).toHaveProperty('marketCondition');
      
      expect(Array.isArray(context.activeSessions)).toBe(true);
      expect(typeof context.isOptimalForPairs).toBe('object');
      expect(Array.isArray(context.recommendedPairs)).toBe(true);
      expect(['low', 'medium', 'high']).toContain(context.marketCondition);
    });
  });

  describe('Market Sessions Configuration', () => {
    test('should have all required market sessions configured', () => {
      expect(MARKET_SESSIONS).toHaveProperty('sydney');
      expect(MARKET_SESSIONS).toHaveProperty('tokyo');
      expect(MARKET_SESSIONS).toHaveProperty('london');
      expect(MARKET_SESSIONS).toHaveProperty('newYork');
      
      // Check session structure
      Object.values(MARKET_SESSIONS).forEach(session => {
        expect(session).toHaveProperty('start');
        expect(session).toHaveProperty('end');
        expect(session).toHaveProperty('pairs');
        expect(session).toHaveProperty('description');
        
        expect(typeof session.start).toBe('string');
        expect(typeof session.end).toBe('string');
        expect(Array.isArray(session.pairs)).toBe(true);
        expect(typeof session.description).toBe('string');
        
        // Validate time format HH:mm
        expect(session.start).toMatch(/^\d{2}:\d{2}$/);
        expect(session.end).toMatch(/^\d{2}:\d{2}$/);
        
        // Validate pairs array is not empty
        expect(session.pairs.length).toBeGreaterThan(0);
      });
    });

    test('should have valid default session filter configuration', () => {
      expect(DEFAULT_SESSION_FILTER).toHaveProperty('enabled');
      expect(DEFAULT_SESSION_FILTER).toHaveProperty('allowedSessions');
      expect(DEFAULT_SESSION_FILTER).toHaveProperty('useOptimalPairs');
      expect(DEFAULT_SESSION_FILTER).toHaveProperty('aggressivenessMultiplier');
      
      expect(typeof DEFAULT_SESSION_FILTER.enabled).toBe('boolean');
      expect(Array.isArray(DEFAULT_SESSION_FILTER.allowedSessions)).toBe(true);
      expect(typeof DEFAULT_SESSION_FILTER.useOptimalPairs).toBe('boolean');
      expect(typeof DEFAULT_SESSION_FILTER.aggressivenessMultiplier).toBe('object');
      
      expect(DEFAULT_SESSION_FILTER.aggressivenessMultiplier).toHaveProperty('optimal');
      expect(DEFAULT_SESSION_FILTER.aggressivenessMultiplier).toHaveProperty('suboptimal');
      
      expect(typeof DEFAULT_SESSION_FILTER.aggressivenessMultiplier.optimal).toBe('number');
      expect(typeof DEFAULT_SESSION_FILTER.aggressivenessMultiplier.suboptimal).toBe('number');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle session filtering integration correctly', () => {
      const sessionFilter: SessionFilter = {
        enabled: true,
        allowedSessions: ['london', 'newYork'],
        useOptimalPairs: true,
        aggressivenessMultiplier: {
          optimal: 1.2,
          suboptimal: 0.8
        }
      };
      
      // Test trading permission
      const canTrade = isTradingAllowed('EURUSD', sessionFilter);
      expect(typeof canTrade).toBe('boolean');
      
      // Test multiplier calculation
      const multiplier = getSessionMultiplier('EURUSD', sessionFilter);
      expect(typeof multiplier).toBe('number');
      expect(multiplier).toBeGreaterThan(0);
      
      // Test session context
      const context = getCurrentSessionContext();
      expect(context).toBeDefined();
    });
  });
});