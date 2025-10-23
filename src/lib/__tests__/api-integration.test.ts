/**
 * API INTEGRATION TESTS
 * Tests for all API endpoints to ensure functionality and consistency
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock NextAuth for testing
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(() => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com'
    }
  }))
}));

// Mock fetch for Yahoo Finance
global.fetch = jest.fn();

describe('API Integration Tests', () => {
  const API_BASE = 'http://localhost:3000/api';
  
  beforeAll(() => {
    // Setup test environment
    // Note: NODE_ENV is read-only in some environments
    // This is just for test configuration
  });

  afterAll(() => {
    // Cleanup test environment
    jest.clearAllMocks();
  });

  describe('Strategy Analysis Endpoints', () => {
    describe('POST /api/strategy/analyze-market', () => {
      it('should analyze market conditions successfully', async () => {
        // Mock market data fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            // Mock Yahoo Finance response
            chart: {
              result: [{
                timestamp: [1640995200, 1641081600],
                close: [1.0850, 1.0860],
                high: [1.0860, 1.0870],
                low: [1.0840, 1.0850]
              }]
            }
          })
        });

        const response = await fetch(`${API_BASE}/strategy/analyze-market`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            symbol: 'EURUSD',
            timeframe: 'H1',
            strategyType: 'day_trading',
            riskTolerance: 'moderate'
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('marketContext');
        expect(data.data).toHaveProperty('strategyRecommendations');
      });

      it('should handle validation errors', async () => {
        const response = await fetch(`${API_BASE}/strategy/analyze-market`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            symbol: '', // Invalid empty symbol
            timeframe: 'H1'
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
      });
    });

    describe('POST /api/strategy/optimize-exits', () => {
      it('should optimize exit levels successfully', async () => {
        // Mock market data fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [{
                timestamp: [1640995200, 1641081600],
                close: [1.0850, 1.0860],
                high: [1.0860, 1.0870],
                low: [1.0840, 1.0850]
              }]
            }
          })
        });

        const response = await fetch(`${API_BASE}/strategy/optimize-exits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            symbol: 'EURUSD',
            entryPrice: 1.0850,
            tradeType: 'BUY',
            optimizationType: 'advanced',
            riskTolerance: 'moderate'
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('optimizedExitRules');
        expect(data.data).toHaveProperty('exitCalculation');
      });
    });
  });

  describe('Market Analysis Endpoints', () => {
    describe('GET /api/market/regime/[symbol]', () => {
      it('should detect market regime successfully', async () => {
        // Mock market data fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [{
                timestamp: Array.from({length: 50}, (_, i) => 1640995200 + i * 3600),
                close: Array.from({length: 50}, (_, i) => 1.0850 + i * 0.0001),
                high: Array.from({length: 50}, (_, i) => 1.0860 + i * 0.0001),
                low: Array.from({length: 50}, (_, i) => 1.0840 + i * 0.0001)
              }]
            }
          })
        });

        const response = await fetch(`${API_BASE}/market/regime/EURUSD?timeframe=H1&lookbackDays=30`, {
          headers: {
            'Cookie': 'next-auth.session-token=test-token'
          }
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('currentRegime');
        expect(data.data.currentRegime).toHaveProperty('regime');
        expect(data.data.currentRegime).toHaveProperty('confidence');
      });

      it('should handle invalid symbols', async () => {
        const response = await fetch(`${API_BASE}/market/regime/INVALID`, {
          headers: {
            'Cookie': 'next-auth.session-token=test-token'
          }
        });

        const data = await response.json();
        
        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toHaveProperty('code', 'INVALID_SYMBOL');
      });
    });

    describe('POST /api/market/context', () => {
      it('should provide market context successfully', async () => {
        // Mock market data fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [{
                timestamp: Array.from({length: 100}, (_, i) => 1640995200 + i * 3600),
                close: Array.from({length: 100}, (_, i) => 1.0850 + i * 0.0001),
                high: Array.from({length: 100}, (_, i) => 1.0860 + i * 0.0001),
                low: Array.from({length: 100}, (_, i) => 1.0840 + i * 0.0001)
              }]
            }
          })
        });

        const response = await fetch(`${API_BASE}/market/context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            symbol: 'EURUSD',
            timeframe: 'H1',
            atrPeriod: 14,
            lookbackPeriods: 100
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('marketContext');
        expect(data.data.marketContext).toHaveProperty('symbol', 'EURUSD');
      });
    });
  });

  describe('Trading & Risk Management Endpoints', () => {
    describe('POST /api/trading/position-sizing', () => {
      it('should calculate position size successfully', async () => {
        const response = await fetch(`${API_BASE}/trading/position-sizing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            accountBalance: 10000,
            symbol: 'EURUSD',
            entryPrice: 1.0850,
            tradeType: 'BUY',
            config: {
              method: 'percentage_risk',
              percentageRisk: {
                riskPercentage: 2,
                maxRiskPerTrade: 200,
                maxDailyRisk: 500
              },
              maxPositionSize: 1.0,
              minPositionSize: 0.01
            }
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('positionSize');
        expect(data.data).toHaveProperty('riskAmount');
      });
    });

    describe('POST /api/trading/smart-exits', () => {
      it('should calculate smart exits successfully', async () => {
        const response = await fetch(`${API_BASE}/trading/smart-exits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            entryPrice: 1.0850,
            tradeType: 'BUY',
            smartExitRules: {
              stopLoss: {
                type: 'atr',
                atrMultiplier: 2.0
              },
              takeProfit: {
                type: 'rr_ratio',
                rrRatio: 2.0
              }
            }
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('exitCalculation');
        expect(data.data.exitCalculation).toHaveProperty('stopLoss');
        expect(data.data.exitCalculation).toHaveProperty('takeProfit');
      });
    });
  });

  describe('Multi-Timeframe Analysis Endpoints', () => {
    describe('POST /api/mtf/analysis', () => {
      it('should perform MTF analysis successfully', async () => {
        // Mock market data fetch
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [{
                timestamp: Array.from({length: 100}, (_, i) => 1640995200 + i * 3600),
                close: Array.from({length: 100}, (_, i) => 1.0850 + i * 0.0001),
                high: Array.from({length: 100}, (_, i) => 1.0860 + i * 0.0001),
                low: Array.from({length: 100}, (_, i) => 1.0840 + i * 0.0001)
              }]
            }
          })
        });

        const response = await fetch(`${API_BASE}/mtf/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'next-auth.session-token=test-token'
          },
          body: JSON.stringify({
            strategy: {
              id: 'test-mtf-strategy',
              symbol: 'EURUSD',
              primaryTimeframe: 'H1',
              confirmationTimeframes: ['H4', 'D1'],
              rules: {
                entry: {
                  primary: [{
                    indicator: 'RSI',
                    condition: 'less_than',
                    value: 30
                  }],
                  confirmation: [{
                    timeframe: 'H4',
                    condition: {
                      indicator: 'RSI',
                      condition: 'less_than',
                      value: 50
                    },
                    required: true
                  }]
                },
                exit: {
                  takeProfit: { type: 'pips', value: 50 },
                  stopLoss: { type: 'pips', value: 25 }
                },
                riskManagement: {
                  lotSize: 0.01,
                  maxPositions: 1
                }
              }
            },
            dateRange: {
              from: '2024-01-01',
              to: '2024-01-31'
            }
          })
        });

        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('analysis');
        expect(data.data.analysis).toHaveProperty('overallSignal');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const response = await fetch(`${API_BASE}/strategy/analyze-market`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // No auth cookie
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          timeframe: 'H1'
        })
      });

      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should handle rate limiting', async () => {
      // This test would require implementing rate limiting in the test environment
      // For now, we'll just verify the error response format
      
      const response = await fetch(`${API_BASE}/strategy/analyze-market`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=test-token'
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          timeframe: 'H1'
        })
      });

      // In a real test, we'd make multiple requests to trigger rate limiting
      // For now, we'll just verify the endpoint exists
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Response Format Consistency', () => {
    it('should have consistent success response format', async () => {
      // Mock market data fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chart: {
            result: [{
              timestamp: [1640995200, 1641081600],
              close: [1.0850, 1.0860],
              high: [1.0860, 1.0870],
              low: [1.0840, 1.0850]
            }]
          }
        })
      });

      const response = await fetch(`${API_BASE}/market/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=test-token'
        },
        body: JSON.stringify({
          symbol: 'EURUSD',
          timeframe: 'H1'
        })
      });

      const data = await response.json();
      
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('timestamp');
      
      if (data.success) {
        expect(typeof data.data).toBe('object');
      }
    });

    it('should have consistent error response format', async () => {
      const response = await fetch(`${API_BASE}/strategy/analyze-market`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'next-auth.session-token=test-token'
        },
        body: JSON.stringify({
          symbol: '', // Invalid
          timeframe: 'H1'
        })
      });

      const data = await response.json();
      
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
      expect(data.error).toHaveProperty('timestamp');
    });
  });
});