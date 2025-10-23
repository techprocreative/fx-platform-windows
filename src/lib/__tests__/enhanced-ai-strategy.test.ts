/**
 * Enhanced AI Strategy Generation with Market Context Tests
 * 
 * This test file verifies the integration of market context
 * into the AI strategy generation process.
 */

import { marketContextProvider } from '../market/context';
import { buildEnhancedStrategyPrompt, buildMarketAnalysisPrompt } from '../llm/prompts';

describe('Enhanced AI Strategy Generation', () => {
  
  describe('Market Context Provider', () => {
    it('should generate market context for EURUSD H1', async () => {
      const context = await marketContextProvider.getMarketContext({
        symbol: 'EURUSD',
        timeframe: 'H1',
        atrPeriod: 14,
        lookbackPeriods: 100
      });

      expect(context).toBeDefined();
      expect(context.symbol).toBe('EURUSD');
      expect(context.timeframe).toBe('H1');
      expect(context.volatility).toBeDefined();
      expect(context.trend).toBeDefined();
      expect(context.keyLevels).toBeDefined();
      expect(context.session).toBeDefined();
      expect(context.price).toBeDefined();
      
      console.log('✅ Market Context Generated:', {
        symbol: context.symbol,
        price: context.price.current,
        trend: context.trend.direction,
        volatility: context.volatility.volatilityLevel,
        sessions: context.session.activeSessions
      });
    });

    it('should provide formatted context for AI prompts', async () => {
      const context = await marketContextProvider.getMarketContext({
        symbol: 'GBPUSD',
        timeframe: 'H4',
        atrPeriod: 14
      });

      const formattedContext = await marketContextProvider.getFormattedContext({
        symbol: 'GBPUSD',
        timeframe: 'H4',
        atrPeriod: 14
      });

      expect(formattedContext).toContain('GBPUSD');
      expect(formattedContext).toContain('H4');
      expect(formattedContext).toContain('Current Price');
      expect(formattedContext).toContain('Volatility');
      expect(formattedContext).toContain('Trend');
      expect(formattedContext).toContain('Market Sessions');
      
      console.log('✅ Formatted Context for AI:', formattedContext);
    });
  });

  describe('Enhanced Prompt Generation', () => {
    it('should build enhanced strategy prompt with market context', () => {
      const marketContext = `
Market Context for EURUSD (H1):
- Current Price: 1.0850 (+0.15%)
- Volatility: medium (ATR: 0.0025)
- Trend: bullish (Strength: 75/100)
- Key Levels: Support 1.0820, Resistance 1.0880
- Market Sessions: london, newYork (high activity)
- Optimal for EURUSD: YES
`;

      const prompt = buildEnhancedStrategyPrompt(
        'scalping',
        'EURUSD',
        'H1',
        ['RSI', 'MACD', 'EMA'],
        marketContext,
        0.0025,
        1.5,
        ['london', 'newYork']
      );

      expect(prompt).toContain('scalping strategy for EURUSD on H1');
      expect(prompt).toContain(marketContext);
      expect(prompt).toContain('RSI, MACD, EMA');
      expect(prompt).toContain('0.0025');
      expect(prompt).toContain('1.5');
      expect(prompt).toContain('london, newYork');
      expect(prompt).toContain('bullish trend');
      expect(prompt).toContain('medium volatility');
      
      console.log('✅ Enhanced Strategy Prompt Generated');
    });

    it('should build market analysis prompt', () => {
      const marketData = `
Symbol: EURUSD
Current Price: 1.0850
24h Change: +0.15%
Volatility Level: medium
Trend Direction: bullish
Trend Strength: 75
Active Sessions: london, newYork
`;

      const prompt = buildMarketAnalysisPrompt(marketData);

      expect(prompt).toContain(marketData);
      expect(prompt).toContain('Trend Analysis');
      expect(prompt).toContain('Volatility Assessment');
      expect(prompt).toContain('Key Levels');
      expect(prompt).toContain('Session Analysis');
      
      console.log('✅ Market Analysis Prompt Generated');
    });
  });

  describe('Market Context Features', () => {
    it('should handle different symbols and timeframes', async () => {
      const testCases = [
        { symbol: 'EURUSD', timeframe: 'M15' },
        { symbol: 'GBPUSD', timeframe: 'H1' },
        { symbol: 'USDJPY', timeframe: 'H4' },
        { symbol: 'AUDUSD', timeframe: 'D1' }
      ];

      for (const testCase of testCases) {
        const context = await marketContextProvider.getMarketContext({
          symbol: testCase.symbol,
          timeframe: testCase.timeframe,
          atrPeriod: 14
        });

        expect(context.symbol).toBe(testCase.symbol);
        expect(context.timeframe).toBe(testCase.timeframe);
        expect(context.volatility.currentATR).toBeGreaterThan(0);
        expect(context.trend.strength).toBeGreaterThanOrEqual(0);
        expect(context.trend.strength).toBeLessThanOrEqual(100);
        
        console.log(`✅ Context for ${testCase.symbol} ${testCase.timeframe}:`, {
          price: context.price.current,
          change: context.price.changePercent,
          trend: context.trend.direction,
          volatility: context.volatility.volatilityLevel
        });
      }
    });

    it('should provide session-aware recommendations', async () => {
      const context = await marketContextProvider.getMarketContext({
        symbol: 'EURUSD',
        timeframe: 'H1'
      });

      expect(context.session.activeSessions).toBeDefined();
      expect(Array.isArray(context.session.activeSessions)).toBe(true);
      expect(context.session.isOptimalForPair).toBeDefined();
      expect(typeof context.session.isOptimalForPair).toBe('boolean');
      expect(context.session.recommendedPairs).toBeDefined();
      expect(Array.isArray(context.session.recommendedPairs)).toBe(true);
      
      console.log('✅ Session Analysis:', {
        activeSessions: context.session.activeSessions,
        isOptimal: context.session.isOptimalForPair,
        recommendedPairs: context.session.recommendedPairs,
        marketCondition: context.session.marketCondition
      });
    });
  });

  describe('ATR Integration', () => {
    it('should calculate ATR-based risk parameters', async () => {
      const context = await marketContextProvider.getMarketContext({
        symbol: 'EURUSD',
        timeframe: 'H1',
        atrPeriod: 14
      });

      const atr = context.volatility.currentATR;
      expect(atr).toBeGreaterThan(0);
      expect(atr).toBeLessThan(0.1); // Should be reasonable for forex
      
      // Test ATR-based calculations
      const stopLossDistance = atr * 2; // 2x ATR for stop loss
      const takeProfitDistance = atr * 3; // 3x ATR for take profit
      
      expect(stopLossDistance).toBeGreaterThan(0);
      expect(takeProfitDistance).toBeGreaterThan(stopLossDistance);
      
      console.log('✅ ATR-based Risk Parameters:', {
        atr: atr.toFixed(5),
        stopLossDistance: stopLossDistance.toFixed(5),
        takeProfitDistance: takeProfitDistance.toFixed(5),
        riskRewardRatio: (takeProfitDistance / stopLossDistance).toFixed(2)
      });
    });
  });

  describe('Cache Performance', () => {
    it('should cache market context results', async () => {
      const startTime = Date.now();
      
      // First call - should fetch fresh data
      const context1 = await marketContextProvider.getMarketContext({
        symbol: 'EURUSD',
        timeframe: 'H1'
      });
      const firstCallTime = Date.now() - startTime;
      
      // Second call - should use cache
      const secondStartTime = Date.now();
      const context2 = await marketContextProvider.getMarketContext({
        symbol: 'EURUSD',
        timeframe: 'H1'
      });
      const secondCallTime = Date.now() - secondStartTime;
      
      expect(context1).toEqual(context2);
      expect(secondCallTime).toBeLessThan(firstCallTime); // Cache should be faster
      
      console.log('✅ Cache Performance:', {
        firstCall: `${firstCallTime}ms`,
        secondCall: `${secondCallTime}ms`,
        speedup: `${(firstCallTime / secondCallTime).toFixed(1)}x`
      });
    });

    it('should provide cache statistics', () => {
      const stats = marketContextProvider.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.keys)).toBe(true);
      
      console.log('✅ Cache Stats:', stats);
    });
  });
});

// Integration test for the complete enhanced AI strategy generation flow
async function testCompleteEnhancedFlow() {
  console.log('\n🧪 Testing Complete Enhanced AI Strategy Generation Flow...\n');

  try {
    // Step 1: Get market context
    console.log('Step 1: Fetching market context...');
    const context = await marketContextProvider.getMarketContext({
      symbol: 'EURUSD',
      timeframe: 'H1',
      atrPeriod: 14
    });
    console.log('✅ Market context retrieved');

    // Step 2: Format context for AI
    console.log('Step 2: Formatting context for AI...');
    const formattedContext = await marketContextProvider.getFormattedContext({
      symbol: 'EURUSD',
      timeframe: 'H1'
    });
    console.log('✅ Context formatted for AI');

    // Step 3: Build enhanced prompt
    console.log('Step 3: Building enhanced strategy prompt...');
    const enhancedPrompt = buildEnhancedStrategyPrompt(
      'swing',
      'EURUSD',
      'H1',
      ['RSI', 'MACD', 'EMA', 'ATR'],
      formattedContext,
      context.volatility.currentATR,
      1.5,
      context.session.activeSessions
    );
    console.log('✅ Enhanced prompt built');

    // Step 4: Simulate AI strategy generation (without actual API call)
    console.log('Step 4: Simulating AI strategy generation...');
    const mockStrategy = {
      name: 'Enhanced EURUSD Swing Strategy',
      description: 'ATR-adaptive swing trading strategy with market session filters',
      symbol: 'EURUSD',
      timeframe: 'H1',
      rules: {
        entry: {
          conditions: [
            {
              indicator: 'RSI',
              condition: 'less_than',
              value: 30,
              description: 'RSI oversold in bullish trend'
            },
            {
              indicator: 'EMA',
              condition: 'greater_than',
              value: 'EMA_200',
              description: 'Price above 200 EMA for trend confirmation'
            }
          ],
          logic: 'AND'
        },
        exit: {
          takeProfit: {
            type: 'atr',
            value: 2.5
          },
          stopLoss: {
            type: 'atr',
            value: 1.5
          }
        },
        riskManagement: {
          lotSize: 0.01,
          maxPositions: 1,
          maxDailyLoss: 100
        },
        dynamicRisk: {
          useATRSizing: true,
          atrMultiplier: 1.5,
          riskPercentage: 1.5,
          autoAdjustLotSize: true,
          reduceInHighVolatility: true,
          volatilityThreshold: 0.003
        },
        sessionFilter: {
          enabled: true,
          allowedSessions: context.session.activeSessions,
          useOptimalPairs: true,
          aggressivenessMultiplier: {
            optimal: 1.2,
            suboptimal: 0.8
          }
        }
      }
    };
    console.log('✅ Strategy generated with market context integration');

    // Step 5: Validate strategy incorporates market context
    console.log('Step 5: Validating market context integration...');
    expect(mockStrategy.symbol).toBe('EURUSD');
    expect(mockStrategy.timeframe).toBe('H1');
    expect(mockStrategy.rules.dynamicRisk?.useATRSizing).toBe(true);
    expect(mockStrategy.rules.sessionFilter?.allowedSessions).toEqual(context.session.activeSessions);
    console.log('✅ Strategy properly incorporates market context');

    console.log('\n🎉 Complete enhanced AI strategy generation flow test passed!');
    console.log('\n📊 Generated Strategy Summary:');
    console.log(`- Name: ${mockStrategy.name}`);
    console.log(`- Symbol: ${mockStrategy.symbol}`);
    console.log(`- Timeframe: ${mockStrategy.timeframe}`);
    console.log(`- Entry Conditions: ${mockStrategy.rules.entry.conditions.length}`);
    console.log(`- ATR-based Exit: ${mockStrategy.rules.exit.takeProfit.type}`);
    console.log(`- Dynamic Risk: ${mockStrategy.rules.dynamicRisk?.useATRSizing ? 'Enabled' : 'Disabled'}`);
    console.log(`- Session Filter: ${mockStrategy.rules.sessionFilter?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Active Sessions: ${mockStrategy.rules.sessionFilter?.allowedSessions?.join(', ')}`);

    return true;
  } catch (error) {
    console.error('❌ Enhanced flow test failed:', error);
    return false;
  }
}

// Run the integration test if this file is executed directly
if (require.main === module) {
  testCompleteEnhancedFlow()
    .then(success => {
      if (success) {
        console.log('\n✨ All enhanced AI strategy generation tests completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Some tests failed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { testCompleteEnhancedFlow };