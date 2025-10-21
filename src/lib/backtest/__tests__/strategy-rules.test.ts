import { describe, expect, it } from '@jest/globals';

import {
  convertOperator,
  convertTimeframe,
  getDefaultStrategyRules,
  transformStrategyRules,
} from '@/lib/backtest/strategy-rules';

describe('strategy-rules utilities', () => {
  describe('convertOperator', () => {
    it('maps known operators correctly', () => {
      expect(convertOperator('greater_than')).toBe('GT');
      expect(convertOperator('less_than')).toBe('LT');
      expect(convertOperator('equals')).toBe('EQ');
      expect(convertOperator('crosses_above')).toBe('GTE');
      expect(convertOperator('crosses_below')).toBe('LTE');
      expect(convertOperator('gte')).toBe('GTE');
      expect(convertOperator('lte')).toBe('LTE');
    });

    it('defaults to EQ for unknown operators', () => {
      expect(convertOperator('unknown')).toBe('EQ');
    });
  });

  describe('convertTimeframe', () => {
    it.each([
      ['M1', '1min'],
      ['M5', '5min'],
      ['M15', '15min'],
      ['M30', '30min'],
      ['H1', '1h'],
      ['H4', '4h'],
      ['D1', '1d'],
      ['W1', '1w'],
    ])('converts %s to %s', (input, expected) => {
      expect(convertTimeframe(input)).toBe(expected);
    });

    it('defaults to 1h for unknown values', () => {
      expect(convertTimeframe('UNKNOWN')).toBe('1h');
    });
  });

  describe('getDefaultStrategyRules', () => {
    it('returns two default rules', () => {
      const rules = getDefaultStrategyRules();
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('Default Entry');
      expect(rules[1].name).toBe('Default Exit');
    });
  });

  describe('transformStrategyRules', () => {
    it('returns default rules for invalid input', () => {
      expect(transformStrategyRules(null)).toEqual(getDefaultStrategyRules());
      expect(transformStrategyRules(undefined)).toEqual(getDefaultStrategyRules());
      expect(transformStrategyRules('invalid')).toEqual(getDefaultStrategyRules());
    });

    it('transforms valid form rules', () => {
      const rules = transformStrategyRules({
        timeframe: 'H1',
        entry: {
          conditions: [
            {
              indicator: 'rsi',
              condition: 'greater_than',
              value: 60,
            },
          ],
        },
        exit: {
          takeProfit: 100,
          stopLoss: 50,
        },
        riskManagement: {
          lotSize: 0.05,
        },
      });

      expect(rules).toHaveLength(2);
      expect(rules[0]).toMatchObject({
        name: 'Entry Rule',
        action: {
          type: 'buy',
          parameters: {
            size: 0.05,
          },
        },
      });

      expect(rules[0].conditions[0]).toMatchObject({
        indicator: 'RSI',
        operator: 'GT',
        value: 60,
        timeframes: ['1h'],
      });

      expect(rules[1].action.parameters).toMatchObject({
        takeProfit: 100,
        stopLoss: 50,
      });
    });

    it('falls back to defaults when entry conditions missing', () => {
      expect(
        transformStrategyRules({
          timeframe: 'H1',
          exit: {
            takeProfit: 100,
            stopLoss: 50,
          },
        })
      ).toEqual(getDefaultStrategyRules());
    });
  });
});
