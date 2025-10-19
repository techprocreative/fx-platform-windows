import { z } from 'zod';

const riskManagementSchema = z.object({
  lotSize: z.number().optional(),
});

const exitSchema = z.object({
  takeProfit: z.number().optional(),
  stopLoss: z.number().optional(),
});

const entryConditionSchema = z.object({
  indicator: z.string(),
  condition: z.string(),
  value: z.number(),
});

const strategyFormRulesSchema = z.object({
  entry: z.object({
    conditions: z.array(entryConditionSchema).nonempty(),
  }),
  exit: exitSchema,
  riskManagement: riskManagementSchema,
  timeframe: z.string().optional(),
});

export type StrategyRule = {
  name: string;
  conditions: Array<{
    indicator: string;
    operator: string;
    value: number;
    timeframes: string[];
  }>;
  action: {
    type: string;
    parameters: Record<string, number | undefined>;
  };
};

/**
 * Converts a condition operator from frontend format to backtest engine format
 * @param condition - The operator string from the strategy form
 * @returns The backtest engine operator code (GT, LT, EQ, etc.)
 */
export function convertOperator(condition: string) {
  const operatorMap: Record<string, string> = {
    greater_than: 'GT',
    less_than: 'LT',
    equals: 'EQ',
    crosses_above: 'GTE',
    crosses_below: 'LTE',
    gte: 'GTE',
    lte: 'LTE',
  };
  return operatorMap[condition] || 'EQ';
}

/**
 * Converts a timeframe from trading format to backtest engine format
 * @param timeframe - The timeframe string (M1, H1, D1, etc.)
 * @returns The backtest engine timeframe format
 */
export function convertTimeframe(timeframe: string) {
  const timeframeMap: Record<string, string> = {
    M1: '1min',
    M5: '5min',
    M15: '15min',
    M30: '30min',
    H1: '1h',
    H4: '4h',
    D1: '1d',
    W1: '1w',
  };
  return timeframeMap[timeframe] || '1h';
}

/**
 * Returns default strategy rules for when no valid rules are provided
 * @returns An array of two default RSI-based rules
 */
export function getDefaultStrategyRules(): StrategyRule[] {
  return [
    {
      name: 'Default Entry',
      conditions: [
        {
          indicator: 'RSI',
          operator: 'LT',
          value: 30,
          timeframes: ['1H'],
        },
      ],
      action: {
        type: 'buy',
        parameters: {
          size: 0.01,
        },
      },
    },
    {
      name: 'Default Exit',
      conditions: [
        {
          indicator: 'RSI',
          operator: 'GT',
          value: 70,
          timeframes: ['1H'],
        },
      ],
      action: {
        type: 'close',
        parameters: {},
      },
    },
  ];
}

/**
 * Transforms strategy rules from frontend format to backtest engine format
 * @param rules - The strategy rules object from the form
 * @returns An array of BacktestRule objects for the engine
 */
export function transformStrategyRules(rules: unknown): StrategyRule[] {
  try {
    if (!rules || typeof rules !== 'object') {
      return getDefaultStrategyRules();
    }

    const parsed = strategyFormRulesSchema.safeParse(rules);

    if (!parsed.success) {
      return getDefaultStrategyRules();
    }

    const { entry, exit, riskManagement, timeframe } = parsed.data;

    return [
      {
        name: 'Entry Rule',
        conditions: entry.conditions.map((condition) => ({
          indicator: condition.indicator.toUpperCase(),
          operator: convertOperator(condition.condition),
          value: condition.value,
          timeframes: [convertTimeframe(timeframe || 'H1')],
        })),
        action: {
          type: 'buy',
          parameters: {
            size: riskManagement.lotSize || 0.01,
          },
        },
      },
      {
        name: 'Exit Rule',
        conditions: [
          {
            indicator: 'PRICE',
            operator: 'GTE',
            value: 999999,
            timeframes: [convertTimeframe(timeframe || 'H1')],
          },
        ],
        action: {
          type: 'close',
          parameters: {
            takeProfit: exit.takeProfit,
            stopLoss: exit.stopLoss,
          },
        },
      },
    ];
  } catch (error) {
    console.error('Error transforming strategy rules:', error);
    return getDefaultStrategyRules();
  }
}
