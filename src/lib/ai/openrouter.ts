import { Strategy } from '../../types';

// OpenRouter AI configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-3-haiku:beta';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export class OpenRouterAI {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.model = model;

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
  }

  private async makeRequest(messages: OpenRouterMessage[]): Promise<string> {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'NexusTrade FX Platform',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OpenRouterResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw new Error(`Failed to generate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate strategy conditions to reject invalid/meaningless rules
   */
  private validateStrategyConditions(strategyData: any): void {
    if (!strategyData.rules || !Array.isArray(strategyData.rules)) {
      return; // No rules to validate
    }

    const errors: string[] = [];

    strategyData.rules.forEach((rule: any, ruleIndex: number) => {
      if (!rule.conditions || !Array.isArray(rule.conditions)) {
        return;
      }

      rule.conditions.forEach((condition: any, condIndex: number) => {
        const { indicator, operator, value } = condition;

        // Validate moving averages (EMA, SMA) not compared to small numbers
        if (indicator && (indicator.includes('ema') || indicator.includes('sma'))) {
          if (typeof value === 'number') {
            // Check if value is too small (likely invalid)
            if (value >= 0 && value < 100) {
              errors.push(
                `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
                `Invalid condition "${indicator} ${operator} ${value}". ` +
                `Moving averages should be compared to other indicators (e.g., "ema_21") ` +
                `or price, not small numbers. For crypto/forex, prices are typically > 1000.`
              );
            }
          }
        }

        // Validate price not compared to 0 or very small numbers
        if (indicator === 'price' && typeof value === 'number') {
          if (value >= 0 && value < 100) {
            errors.push(
              `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
              `Invalid condition "price ${operator} ${value}". ` +
              `Price comparisons to near-zero values are meaningless. ` +
              `Use price vs moving average comparisons instead (e.g., "price > ema_50").`
            );
          }
        }

        // Validate RSI range (should be 0-100)
        if (indicator === 'rsi' && typeof value === 'number') {
          if (value < 0 || value > 100) {
            errors.push(
              `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
              `Invalid RSI value "${value}". RSI must be between 0-100. ` +
              `Use 30 for oversold, 70 for overbought.`
            );
          }
        }

        // Validate CCI range (typically -200 to +200)
        if (indicator === 'cci' && typeof value === 'number') {
          if (value < -300 || value > 300) {
            errors.push(
              `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
              `Invalid CCI value "${value}". CCI typically ranges from -200 to +200. ` +
              `Use -100 for oversold, +100 for overbought.`
            );
          }
        }

        // Validate Stochastic range (should be 0-100)
        if ((indicator === 'stochastic' || indicator === 'stochastic_k' || indicator === 'stochastic_d') && 
            typeof value === 'number') {
          if (value < 0 || value > 100) {
            errors.push(
              `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
              `Invalid Stochastic value "${value}". Stochastic must be between 0-100. ` +
              `Use 20 for oversold, 80 for overbought.`
            );
          }
        }

        // Warn about always-true conditions
        if (indicator && indicator.includes('ema') && value === 0 && operator === 'gt') {
          errors.push(
            `Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ` +
            `Condition "${indicator} > 0" is ALWAYS TRUE for positive prices! ` +
            `This is NOT a valid trading signal. ` +
            `Use crossover conditions like "ema_9 > ema_21" instead.`
          );
        }
      });
    });

    if (errors.length > 0) {
      console.error('❌ Strategy Validation Errors:', errors);
      throw new Error(
        `AI generated invalid strategy conditions:\n\n${errors.join('\n\n')}\n\n` +
        `Please regenerate the strategy with valid conditions.`
      );
    }

    console.log('✅ Strategy conditions validated successfully');
  }

  async generateStrategy(prompt: string): Promise<Partial<Strategy>> {
    const systemPrompt = `You are an expert forex trading strategy generator. Generate realistic trading strategies in JSON format only.

CRITICAL: READ USER PROMPT CAREFULLY!
- Extract SYMBOL (e.g., XAUUSD, EURUSD) from user's text
- Extract TIMEFRAME (e.g., 15M = M15, 1H = H1) from user's text
- If user mentions "gold" = XAUUSD
- If user mentions "15 minute" or "15M" = M15
- Pay close attention to what the user actually requested!

Your response must be a valid JSON object with the following structure:
{
  "name": "Strategy Name",
  "description": "Brief description of the strategy",
  "symbol": "SYMBOL_EXTRACTED_FROM_USER_REQUEST",
  "timeframe": "TIMEFRAME_EXTRACTED_FROM_USER_REQUEST",
  "rules": [
    {
      "name": "Rule name",
      "conditions": [
        {
          "indicator": "price|sma_20|sma_50|ema_9|ema_12|ema_21|ema_26|ema_50|rsi|macd|cci|atr|stochastic",
          "operator": "gt|lt|eq|gte|lte|crosses_above|crosses_below",
          "value": "number OR another_indicator",
          "timeframes": ["M15", "H1", "H4", "D1"]
        }
      ],
      "action": {
        "type": "buy|sell|close",
        "parameters": {
          "size": 0.01
        }
      }
    }
  ],

CRITICAL - VALID CONDITION EXAMPLES:

✅ CORRECT CROSSOVER CONDITIONS (Most Common):
{
  "indicator": "ema_9",
  "operator": "gt",
  "value": "ema_21",  // Fast EMA crosses above Slow EMA
  "description": "Fast EMA crosses above Slow EMA - Bullish signal"
}

{
  "indicator": "price",
  "operator": "gt", 
  "value": "ema_50",  // Price breaks above EMA
  "description": "Price crosses above EMA 50 - Trend continuation"
}

✅ CORRECT RSI CONDITIONS:
{
  "indicator": "rsi",
  "operator": "lt",
  "value": 30,  // RSI oversold (use values 0-100)
  "description": "RSI below 30 - Oversold condition"
}

{
  "indicator": "rsi",
  "operator": "gt",
  "value": 70,  // RSI overbought
  "description": "RSI above 70 - Overbought condition"
}

✅ CORRECT CCI CONDITIONS:
{
  "indicator": "cci",
  "operator": "lt",
  "value": -100,  // CCI oversold (use values -200 to +200)
  "description": "CCI below -100 - Oversold"
}

✅ CORRECT MACD CONDITIONS:
{
  "indicator": "macd",
  "operator": "gt",
  "value": "macd_signal",  // MACD crosses above signal line
  "description": "MACD crosses above signal - Bullish"
}

✅ CORRECT STOCHASTIC CONDITIONS:
{
  "indicator": "stochastic_k",
  "operator": "lt",
  "value": 20,  // Stochastic oversold (use values 0-100)
  "description": "Stochastic below 20 - Oversold"
}

✅ CORRECT PRICE vs MOVING AVERAGE:
{
  "indicator": "price",
  "operator": "gt",
  "value": "sma_20",  // Price above SMA
  "description": "Price above 20-period SMA - Uptrend"
}

❌ INVALID CONDITIONS - NEVER USE THESE:

❌ {
  "indicator": "ema_9",
  "operator": "gt",
  "value": 0  // ❌ WRONG! EMA is always > 0 for positive prices!
}

❌ {
  "indicator": "sma_20",
  "operator": "gt", 
  "value": 1  // ❌ WRONG! SMA for BTCUSD is ~$67000, not near 0!
}

❌ {
  "indicator": "price",
  "operator": "gt",
  "value": 0  // ❌ WRONG! Price is always > 0!
}

❌ {
  "indicator": "ema_21",
  "operator": "lt",
  "value": 100  // ❌ WRONG! For BTCUSD, EMA ~$67000, not < 100!
}

VALIDATION RULES - MUST FOLLOW:

1. For CROSSOVER strategies: Use indicator vs indicator (e.g., "ema_9" vs "ema_21")
2. For OSCILLATORS (RSI, CCI, Stochastic): Use numeric values in valid ranges:
   - RSI: 0-100 (oversold < 30, overbought > 70)
   - CCI: -200 to +200 (oversold < -100, overbought > +100)
   - Stochastic: 0-100 (oversold < 20, overbought > 80)
3. For PRICE vs MA: Compare "price" to "sma_X" or "ema_X"
4. NEVER compare moving averages or price to small numbers like 0, 1, 10
5. NEVER use absolute price values unless symbol-specific (e.g., BTCUSD ~67000)

INDICATOR VALUE FORMATS:

When value is ANOTHER INDICATOR (crossover):
- Use string: "ema_21", "sma_50", "macd_signal", "price"

When value is NUMERIC (oscillator threshold):
- Use number: 30, 70, -100, +100, 20, 80

TRIPLE MOVING AVERAGE STRATEGY EXAMPLE:

For "Triple EMA" or "Triple MA" strategies, use THIS format:
{
  "name": "Triple EMA Strategy",
  "rules": [
    {
      "name": "Bullish Alignment Entry",
      "conditions": [
        {
          "indicator": "ema_9",
          "operator": "gt",
          "value": "ema_21",
          "description": "Fast EMA above Medium EMA"
        },
        {
          "indicator": "ema_21", 
          "operator": "gt",
          "value": "ema_50",
          "description": "Medium EMA above Slow EMA"
        },
        {
          "indicator": "price",
          "operator": "gt", 
          "value": "ema_9",
          "description": "Price above Fast EMA"
        }
      ],
      "logic": "AND",
      "action": { "type": "buy" }
    }
  ]
}
  "parameters": {
    "riskPerTrade": 0.01,
    "maxPositions": 1,
    "stopLoss": 30,
    "takeProfit": 50,
    "maxDailyLoss": 100
  }

IMPORTANT - TP/SL VALUES IN PIPS:
- Return stopLoss and takeProfit as PIP VALUES (numbers)
- For XAUUSD (Gold): Use 30-100 pips for scalping (e.g., stopLoss: 30, takeProfit: 50)
- For EURUSD: Use 20-50 pips for scalping (e.g., stopLoss: 20, takeProfit: 40)
- For GBPUSD: Use 30-60 pips for scalping (e.g., stopLoss: 25, takeProfit: 50)
- For Indices (US30, NAS100): Use 50-200 pips (e.g., stopLoss: 100, takeProfit: 200)
- Scale values based on symbol volatility and timeframe

ADVANCED FEATURES (CRITICAL - MUST INCLUDE):

Your response MUST also include these ADVANCED PARAMETERS for professional-grade strategies:

{
  "name": "Strategy Name",
  "description": "Brief description",
  "symbol": "EXTRACTED_SYMBOL",
  "timeframe": "EXTRACTED_TIMEFRAME",
  "rules": [...entry rules as above...],
  "parameters": {
    "riskPerTrade": 0.01,
    "maxPositions": 1,
    "stopLoss": 30,
    "takeProfit": 50,
    "maxDailyLoss": 100,
    
    "smartExit": {
      "stopLoss": {
        "type": "atr",
        "atrMultiplier": 2.0,
        "maxHoldingHours": 24
      },
      "takeProfit": {
        "type": "partial",
        "rrRatio": 2.0,
        "partialExits": [
          { "percentage": 50, "atRR": 1.0 },
          { "percentage": 30, "atRR": 2.0 },
          { "percentage": 20, "atRR": 3.0 }
        ]
      }
    },
    
    "dynamicRisk": {
      "useATRSizing": true,
      "atrMultiplier": 1.5,
      "riskPercentage": 1.0,
      "autoAdjustLotSize": true,
      "reduceInHighVolatility": true,
      "volatilityThreshold": 0.02
    },
    
    "sessionFilter": {
      "enabled": true,
      "allowedSessions": ["London", "NewYork"],
      "useOptimalPairs": true,
      "aggressivenessMultiplier": {
        "optimal": 1.0,
        "suboptimal": 0.5
      }
    },
    
    "correlationFilter": {
      "enabled": true,
      "maxCorrelation": 0.7,
      "lookbackPeriod": 30,
      "timeframes": ["H1", "H4", "D1"]
    },
    
    "regimeDetection": {
      "trendPeriod": 20,
      "trendThreshold": 0.02,
      "volatilityPeriod": 14,
      "volatilityThreshold": 0.015,
      "enableMTFAnalysis": true,
      "primaryTimeframe": "H1",
      "confirmationTimeframes": ["H4", "D1"],
      "weightTrend": 0.4,
      "weightVolatility": 0.3,
      "weightRange": 0.3,
      "minConfidence": 70,
      "lookbackPeriod": 30,
      "updateFrequency": 15,
      "minDataPoints": 50,
      "enableTransitionDetection": true
    }
  }
}

ADVANCED FEATURES RULES:

1. **Smart Exit** - ALWAYS INCLUDE:
   - For XAUUSD, XAGUSD, commodities: Use "atr" stop loss with multiplier 2.5-3.0
   - For trending strategies: Use "partial" take profit with 3 levels
   - For scalping strategies: Use "rr_ratio" with ratio 1.5-2.0
   - For swing trading: Use "resistance" based take profit

2. **Dynamic Risk** - ALWAYS ENABLE:
   - useATRSizing: true for all commodity symbols (XAUUSD, XAGUSD, USOIL)
   - atrMultiplier: 1.5 for normal volatility, 2.0 for high volatility symbols
   - riskPercentage: 1.0% default, 0.5% for aggressive, 2.0% for conservative
   - reduceInHighVolatility: true always

3. **Session Filter** - ENABLE FOR FOREX:
   - For EURUSD, GBPUSD: ["London", "NewYork"]
   - For USDJPY, AUDJPY: ["Tokyo", "London"]
   - For AUDUSD: ["Sydney", "Tokyo", "London"]
   - useOptimalPairs: true always

4. **Correlation Filter** - ENABLE ALWAYS:
   - maxCorrelation: 0.7 (avoid 70%+ correlated trades)
   - lookbackPeriod: 30 days
   - timeframes: ["H1", "H4", "D1"] for multi-timeframe check

5. **Regime Detection** - ENABLE FOR ADAPTIVE STRATEGIES:
   - enableMTFAnalysis: true always
   - primaryTimeframe: Use the strategy's timeframe
   - confirmationTimeframes: Add H4 and D1 for confirmation
   - Use higher weights (0.4-0.5) for trend in trending strategies
   - Use higher weights (0.4-0.5) for volatility in breakout strategies

MARKET CONTEXT INTEGRATION:
If market context is provided, adjust advanced parameters:
- High volatility (ATR > 0.002): Set reduceInHighVolatility: true, riskPercentage: 0.5%
- Strong trend (strength > 70): Use partial exits with 4 levels
- Optimal session: Set aggressivenessMultiplier.optimal: 1.5
- Sideways market: Enable regime detection with higher range weight

}

CRITICAL INSTRUCTIONS:
1. SYMBOL: Extract the trading symbol from user request

   MAJOR FOREX PAIRS:
   - Euro: EURUSD (keywords: "euro", "eur", "eurusd")
   - Pound: GBPUSD (keywords: "pound", "gbp", "cable", "sterling")
   - Yen: USDJPY (keywords: "yen", "jpy", "usdjpy")
   - Swiss: USDCHF (keywords: "swiss", "chf", "swissy")
   - Aussie: AUDUSD (keywords: "aussie", "aud", "audusd")
   - Loonie: USDCAD (keywords: "cad", "loonie", "usdcad")
   - Kiwi: NZDUSD (keywords: "kiwi", "nzd", "nzdusd")

   CROSS PAIRS:
   - EURJPY, GBPJPY, EURGBP, AUDJPY, EURAUD, EURCHF, AUDNZD, etc.

   COMMODITIES:
   - Gold: XAUUSD (keywords: "gold", "xau", "xauusd")
   - Silver: XAGUSD (keywords: "silver", "xag", "xagusd")
   - Oil: USOIL/UKOIL (keywords: "oil", "crude", "wti", "brent")

   INDICES:
   - US30 (Dow Jones), NAS100 (NASDAQ), SPX500 (S&P 500)
   - UK100 (FTSE), GER40 (DAX), JPN225 (Nikkei)

   CRYPTO:
   - BTCUSD (keywords: "bitcoin", "btc"), ETHUSD (keywords: "ethereum", "eth")

   If user doesn't specify → use EURUSD as default

2. TIMEFRAME: Extract timeframe from user request or use H1 as default
   - Valid values: M1, M5, M15, M30, H1, H4, D1, W1

3. Use realistic indicators and values appropriate for the symbol:
   - For XAUUSD (gold): larger pip values (100-200), higher volatility
   - For XAGUSD (silver): medium pip values (50-100), high volatility
   - For major forex pairs: typical RSI 30-70, SMAs, 20-50 pips TP/SL
   - For indices: larger point values
   - For oil: medium pip values

4. Keep strategies simple and executable
5. Risk management is important (position sizes 0.01-0.1)
6. Generate ONLY JSON, no additional text`;

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Generate a forex trading strategy based on this request: ${prompt}

CRITICAL REQUIREMENTS:
1. Extract the EXACT symbol from my request (XAUUSD, EURUSD, GBPUSD, etc.)
2. Extract the EXACT timeframe from my request (M1, M5, M15, M30, H1, H4, D1, W1)
3. Include ALL indicators mentioned (RSI, MACD, EMA, SMA, etc.)
4. Use the symbol and timeframe I specify - DO NOT use defaults unless I don't specify them`,
      },
    ];

    const response = await this.makeRequest(messages);

    try {
      const strategyData = JSON.parse(response);
      
      // Validate strategy conditions
      this.validateStrategyConditions(strategyData);

      // Debug: Log raw AI response
      console.log('🤖 Raw AI Response (Full):', JSON.stringify(strategyData, null, 2));
      console.log('🤖 Raw AI Response (Summary):', {
        name: strategyData.name,
        symbol: strategyData.symbol,
        timeframe: strategyData.timeframe,
        rulesCount: Array.isArray(strategyData.rules) ? strategyData.rules.length : 0,
        exitParams: strategyData.parameters?.exit,
        riskParams: strategyData.parameters?.riskManagement,
      });

      // Validate and enhance the strategy
      // ALWAYS extract symbol from user prompt to override AI if needed
      const promptLower = prompt.toLowerCase();
      let finalSymbol = null;

        // IMPORTANT: Check most specific matches FIRST
        // Commodities (check these FIRST - high priority)
        if (promptLower.match(/\bxauusd\b/)) {
          finalSymbol = 'XAUUSD';
        } else if (promptLower.match(/\bgold\b/)) {
          finalSymbol = 'XAUUSD';
        } else if (promptLower.match(/\bxau\b/)) {
          finalSymbol = 'XAUUSD';
        } else if (promptLower.match(/\bxagusd\b/) || promptLower.match(/\bsilver\b/) || promptLower.match(/\bxag\b/)) {
          finalSymbol = 'XAGUSD';
        } else if (promptLower.match(/\busoil\b/) || promptLower.match(/\bwti\b/) || promptLower.includes('crude oil')) {
          finalSymbol = 'USOIL';
        } else if (promptLower.match(/\bukoil\b/) || promptLower.match(/\bbrent\b/)) {
          finalSymbol = 'UKOIL';
        }
        // Major Forex Pairs (more specific matches)
        else if (promptLower.match(/\beurusd\b/) || promptLower.match(/\beur\s*\/\s*usd\b/) || (promptLower.includes('euro') && promptLower.includes('dollar'))) {
          finalSymbol = 'EURUSD';
        } else if (promptLower.includes('gbpusd') || promptLower.includes('pound') || promptLower.includes('cable') || promptLower.includes('sterling')) {
          finalSymbol = 'GBPUSD';
        } else if (promptLower.includes('usdjpy') || promptLower.includes('yen')) {
          finalSymbol = 'USDJPY';
        } else if (promptLower.includes('usdchf') || promptLower.includes('swiss') || promptLower.includes('swissy')) {
          finalSymbol = 'USDCHF';
        } else if (promptLower.includes('audusd') || promptLower.includes('aussie')) {
          finalSymbol = 'AUDUSD';
        } else if (promptLower.includes('usdcad') || promptLower.includes('loonie')) {
          finalSymbol = 'USDCAD';
        } else if (promptLower.includes('nzdusd') || promptLower.includes('kiwi')) {
          finalSymbol = 'NZDUSD';
        }
        // Cross Pairs
        else if (promptLower.includes('eurjpy')) {
          finalSymbol = 'EURJPY';
        } else if (promptLower.includes('gbpjpy')) {
          finalSymbol = 'GBPJPY';
        } else if (promptLower.includes('eurgbp')) {
          finalSymbol = 'EURGBP';
        } else if (promptLower.includes('audjpy')) {
          finalSymbol = 'AUDJPY';
        } else if (promptLower.includes('euraud')) {
          finalSymbol = 'EURAUD';
        } else if (promptLower.includes('eurchf')) {
          finalSymbol = 'EURCHF';
        } else if (promptLower.includes('audnzd')) {
          finalSymbol = 'AUDNZD';
        }
        // Indices
        else if (promptLower.includes('us30') || promptLower.includes('dow jones') || promptLower.includes('dow')) {
          finalSymbol = 'US30';
        } else if (promptLower.includes('nas100') || promptLower.includes('nasdaq')) {
          finalSymbol = 'NAS100';
        } else if (promptLower.includes('spx500') || promptLower.includes('sp500') || promptLower.includes('s&p')) {
          finalSymbol = 'SPX500';
        } else if (promptLower.includes('uk100') || promptLower.includes('ftse')) {
          finalSymbol = 'UK100';
        } else if (promptLower.includes('ger40') || promptLower.includes('dax')) {
          finalSymbol = 'GER40';
        } else if (promptLower.includes('jpn225') || promptLower.includes('nikkei')) {
          finalSymbol = 'JPN225';
        }
        // Crypto
        else if (promptLower.includes('btcusd') || promptLower.includes('bitcoin') || promptLower.includes('btc')) {
          finalSymbol = 'BTCUSD';
        } else if (promptLower.includes('ethusd') || promptLower.includes('ethereum') || promptLower.includes('eth')) {
          finalSymbol = 'ETHUSD';
        }
        // Use AI response if available, otherwise default
        if (!finalSymbol) {
          finalSymbol = strategyData.symbol || 'EURUSD';
        }

      // Extract timeframe from prompt (prioritize user input over AI)
      // IMPORTANT: Check longer strings FIRST to avoid false matches (m15 contains m1!)
      let finalTimeframe = null;
      if (promptLower.includes('m30') || promptLower.includes('30 minute') || promptLower.includes('30-minute')) {
        finalTimeframe = 'M30';
      } else if (promptLower.includes('m15') || promptLower.includes('15 minute') || promptLower.includes('15-minute')) {
        finalTimeframe = 'M15';
      } else if (promptLower.includes('m5') || promptLower.includes('5 minute') || promptLower.includes('5-minute')) {
        finalTimeframe = 'M5';
      } else if (promptLower.includes('m1') || promptLower.includes('1 minute') || promptLower.includes('1-minute')) {
        finalTimeframe = 'M1';
      } else if (promptLower.includes('h4') || promptLower.includes('4 hour') || promptLower.includes('4-hour')) {
        finalTimeframe = 'H4';
      } else if (promptLower.includes('h1') || promptLower.includes('1 hour') || promptLower.includes('1-hour') || promptLower.includes('hourly')) {
        finalTimeframe = 'H1';
      } else if (promptLower.includes('w1') || promptLower.includes('weekly') || promptLower.includes('1 week')) {
        finalTimeframe = 'W1';
      } else if (promptLower.includes('d1') || promptLower.includes('daily') || promptLower.includes('1 day')) {
        finalTimeframe = 'D1';
      }

      // Use AI response if no timeframe found in prompt
      if (!finalTimeframe) {
        finalTimeframe = strategyData.timeframe || 'H1';
      }

      // Debug: Log extraction results
      console.log('🔍 Extraction Results:', {
        prompt: prompt.substring(0, 50) + '...',
        aiSymbol: strategyData.symbol,
        aiTimeframe: strategyData.timeframe,
        extractedSymbol: finalSymbol,
        extractedTimeframe: finalTimeframe,
      });

      // Convert AI response to proper pip values
      // AI may return large numbers (100 meaning 100 pips) or decimals (0.01)
      // We need to normalize to decimal format (pips / 10000 for most pairs)
      const rawStopLoss = strategyData.parameters?.stopLoss || 0.002;
      const rawTakeProfit = strategyData.parameters?.takeProfit || 0.004;

      // If AI returns values >= 1, assume they are in pips and convert to decimal
      // e.g., 30 pips = 0.0030, 50 pips = 0.0050
      const stopLoss = rawStopLoss >= 1 ? rawStopLoss / 10000 : rawStopLoss;
      const takeProfit = rawTakeProfit >= 1 ? rawTakeProfit / 10000 : rawTakeProfit;

      console.log('💰 TP/SL Conversion:', {
        rawStopLoss,
        rawTakeProfit,
        convertedStopLoss: stopLoss,
        convertedTakeProfit: takeProfit,
      });

      // Store parameters within rules Json structure
      const rulesWithParameters = {
        rules: Array.isArray(strategyData.rules) ? strategyData.rules : [],
        parameters: {
          riskPerTrade: strategyData.parameters?.riskPerTrade || 0.01,
          maxPositions: strategyData.parameters?.maxPositions || 1,
          stopLoss,
          takeProfit,
          maxDailyLoss: strategyData.parameters?.maxDailyLoss || 100,
        },
      };

      return {
        name: strategyData.name || 'AI Generated Strategy',
        description: strategyData.description || 'Strategy generated by AI',
        symbol: finalSymbol,
        timeframe: finalTimeframe,
        rules: rulesWithParameters as any,
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Invalid strategy format received from AI');
    }
  }

  async optimizeStrategy(strategy: Partial<Strategy>, performanceData: any): Promise<Partial<Strategy>> {
    const systemPrompt = `You are an expert forex strategy optimizer. Optimize the given strategy based on performance data.

Your response must be a valid JSON object with the following structure:
{
  "name": "Optimized Strategy Name",
  "description": "Description of optimization",
  "rules": [
    {
      "name": "Optimized rule name",
      "conditions": [
        {
          "indicator": "price|sma_20|sma_50|ema_12|ema_26|rsi",
          "operator": "gt|lt|eq|gte|lte",
          "value": number,
          "timeframes": ["1h", "4h", "1d"]
        }
      ],
      "action": {
        "type": "buy|sell|close",
        "parameters": {
          "size": 0.01
        }
      }
    }
  ],
  "parameters": {
    "riskPerTrade": 0.02,
    "maxPositions": 1,
    "stopLoss": 0.002,
    "takeProfit": 0.004
  }
}

Optimization guidelines:
- Analyze performance metrics (win rate, drawdown, profit factor)
- Adjust indicator values for better performance
- Improve risk management parameters
- Focus on realistic forex market conditions
- Keep strategy complexity manageable`;

    const userPrompt = `Optimize this strategy:
${JSON.stringify(strategy, null, 2)}

Performance data:
${JSON.stringify(performanceData, null, 2)}`;

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    const response = await this.makeRequest(messages);

    try {
      const optimizedData = JSON.parse(response);

      // Extract parameters from strategy rules if stored there
      const strategyRulesData = strategy.rules as any;
      const existingParams = strategyRulesData?.parameters || {};

      // Store parameters within rules Json structure
      const optimizedRulesWithParameters = {
        rules: Array.isArray(optimizedData.rules) ? optimizedData.rules : (strategyRulesData?.rules || []),
        parameters: {
          ...existingParams,
          ...optimizedData.parameters,
        },
      };

      return {
        name: optimizedData.name || strategy.name,
        description: optimizedData.description || strategy.description,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        rules: optimizedRulesWithParameters as any,
      };
    } catch (parseError) {
      console.error('Failed to parse optimization response:', parseError);
      throw new Error('Invalid optimization format received from AI');
    }
  }

  async analyzeMarketSentiment(symbol: string, timeframe: string): Promise<any> {
    const systemPrompt = `You are an expert forex market analyst. Analyze market sentiment and provide trading signals.

Your response must be a valid JSON object with the following structure:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.85,
  "keyLevels": {
    "support": [1.0800, 1.0750],
    "resistance": [1.0900, 1.0950]
  },
  "recommendedActions": [
    {
      "action": "buy|sell|hold",
      "reason": "Brief explanation",
      "confidence": 0.80
    }
  ],
  "marketConditions": {
    "trend": "uptrend|downtrend|sideways",
    "volatility": "low|medium|high",
    "volume": "below_average|average|above_average"
  }
}

Analysis guidelines:
- Focus on major forex pairs (EUR/USD, GBP/USD, USD/JPY)
- Consider technical and fundamental factors
- Provide realistic support/resistance levels
- Give actionable recommendations with confidence scores
- Consider current market conditions and risk factors`;

    const userPrompt = `Analyze market sentiment for ${symbol} on ${timeframe} timeframe`;

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    const response = await this.makeRequest(messages);

    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse sentiment analysis:', parseError);
      throw new Error('Invalid sentiment analysis format received from AI');
    }
  }

  private generateTags(strategyData: any): string[] {
    const tags = ['ai-generated'];

    // Extract indicators used
    if (strategyData.rules) {
      strategyData.rules.forEach((rule: any) => {
        if (rule.conditions) {
          rule.conditions.forEach((condition: any) => {
            if (condition.indicator) {
              tags.push(condition.indicator);
            }
          });
        }
      });
    }

    // Add general strategy characteristics
    if (strategyData.description) {
      const desc = strategyData.description.toLowerCase();
      if (desc.includes('trend')) tags.push('trend-following');
      if (desc.includes('mean')) tags.push('mean-reversion');
      if (desc.includes('momentum')) tags.push('momentum');
      if (desc.includes('scalp')) tags.push('scalping');
      if (desc.includes('swing')) tags.push('swing-trading');
      if (desc.includes('breakout')) tags.push('breakout');
    }

    // Remove duplicates and limit to 10 tags
    return [...new Set(tags)].slice(0, 10);
  }

  async explainTrade(strategy: Partial<Strategy>, tradeData: any): Promise<string> {
    const systemPrompt = `You are an expert forex trading analyst. Explain trading decisions in simple, clear language.

Your response should be:
- Clear and concise (1-2 paragraphs)
- Educational for traders
- Explain the reasoning behind the trade
- Mention key indicators and market conditions
- Include risk considerations`;

    const userPrompt = `Explain this trade:

Strategy: ${JSON.stringify(strategy, null, 2)}

Trade Details:
${JSON.stringify(tradeData, null, 2)}`;

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    return await this.makeRequest(messages);
  }

  // List of available models
  static getAvailableModels(): string[] {
    return [
      'anthropic/claude-3-haiku:beta',
      'anthropic/claude-3-sonnet:beta',
      'anthropic/claude-3-opus:beta',
      'openai/gpt-4-turbo-preview',
      'openai/gpt-4',
      'openai/gpt-3.5-turbo',
      'google/gemini-pro',
      'meta-llama/llama-3-70b-instruct',
    ];
  }
}

// Helper function to create AI instance
export function createOpenRouterAI(apiKey?: string, model?: string): OpenRouterAI {
  return new OpenRouterAI(apiKey, model);
}

// Lazy-loaded default instance
let defaultAI: OpenRouterAI | null = null;

export function getDefaultAI(): OpenRouterAI {
  if (!defaultAI) {
    defaultAI = new OpenRouterAI();
  }
  return defaultAI;
}
