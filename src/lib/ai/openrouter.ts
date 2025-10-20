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

  async generateStrategy(prompt: string): Promise<Partial<Strategy>> {
    const systemPrompt = `You are an expert forex trading strategy generator. Generate realistic trading strategies in JSON format only.

Your response must be a valid JSON object with the following structure:
{
  "name": "Strategy Name",
  "description": "Brief description of the strategy",
  "symbol": "SYMBOL_FROM_USER_REQUEST",
  "timeframe": "M1|M5|M15|M30|H1|H4|D1",
  "rules": [
    {
      "name": "Rule name",
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
    "riskPerTrade": 0.01,
    "maxPositions": 1,
    "stopLoss": 0.002,
    "takeProfit": 0.004,
    "maxDailyLoss": 100
  }
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
        
        // Commodities
        if (promptLower.includes('xauusd') || promptLower.includes('gold') || promptLower.includes('xau')) {
          finalSymbol = 'XAUUSD';
        } else if (promptLower.includes('xagusd') || promptLower.includes('silver') || promptLower.includes('xag')) {
          finalSymbol = 'XAGUSD';
        } else if (promptLower.includes('usoil') || promptLower.includes('wti') || promptLower.includes('crude oil')) {
          finalSymbol = 'USOIL';
        } else if (promptLower.includes('ukoil') || promptLower.includes('brent')) {
          finalSymbol = 'UKOIL';
        }
        // Major Forex Pairs
        else if (promptLower.includes('eurusd') || promptLower.includes('euro')) {
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
      
      return {
        id: `ai_${Date.now()}`,
        name: strategyData.name || 'AI Generated Strategy',
        description: strategyData.description || 'Strategy generated by AI',
        symbol: finalSymbol,
        timeframe: finalTimeframe,
        rules: Array.isArray(strategyData.rules) ? strategyData.rules : [],
        parameters: {
          riskPerTrade: strategyData.parameters?.riskPerTrade || 0.01,
          maxPositions: strategyData.parameters?.maxPositions || 1,
          stopLoss,
          takeProfit,
          maxDailyLoss: strategyData.parameters?.maxDailyLoss || 100,
        },
        tags: this.generateTags(strategyData),
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      
      return {
        ...strategy,
        name: optimizedData.name || strategy.name,
        description: optimizedData.description || strategy.description,
        rules: Array.isArray(optimizedData.rules) ? optimizedData.rules : strategy.rules,
        parameters: {
          ...strategy.parameters,
          ...optimizedData.parameters,
        },
        updatedAt: new Date(),
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
