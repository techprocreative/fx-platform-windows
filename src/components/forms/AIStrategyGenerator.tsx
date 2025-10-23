"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { TRADING_CONFIG } from "@/lib/config";

// Market context types
interface MarketContext {
  symbol: string;
  timeframe: string;
  volatility: {
    currentATR: number;
    volatilityLevel: 'low' | 'medium' | 'high';
  };
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: number;
  };
  keyLevels: {
    nearestSupport?: number;
    nearestResistance?: number;
  };
  session: {
    activeSessions: string[];
    isOptimalForPair: boolean;
    marketCondition: 'low' | 'medium' | 'high';
  };
  price: {
    current: number;
    changePercent: number;
  };
}

interface AIStrategyGeneratorProps {
  onGenerate: (data: { 
    name: string; 
    description: string; 
    symbol?: string; 
    timeframe?: string;
    rules: any;
    parameters?: any;
  }) => void;
}

export function AIStrategyGenerator({ onGenerate }: AIStrategyGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{
    used: number;
    remaining: number;
    dailyLimit: number;
  } | null>(null);
  
  // Enhanced states for market context
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("H1");
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [enableMarketContext, setEnableMarketContext] = useState(true);

  // Fixed model - Grok (from OpenRouter)
  const AI_MODEL = "x-ai/grok-4-fast";

  // Load usage info on mount
  useEffect(() => {
    fetch("/api/ai/generate-strategy-preview")
      .then((res) => res.json())
      .then((data) => {
        if (data.usage) setUsage(data.usage);
      })
      .catch((err) => console.error("Failed to load usage info:", err));
  }, []);

  // Fetch market context when symbol or timeframe changes
  useEffect(() => {
    if (enableMarketContext && symbol && timeframe) {
      fetchMarketContext();
    }
  }, [symbol, timeframe, enableMarketContext]);

  // Fetch market context from API
  const fetchMarketContext = async () => {
    setLoadingContext(true);
    setContextError(null);
    
    try {
      const response = await fetch(
        `/api/market/context?symbol=${symbol}&timeframe=${timeframe}&includeAnalysis=false`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch market context');
      }
      
      const data = await response.json();
      if (data.success && data.data.marketContext) {
        setMarketContext(data.data.marketContext);
      }
    } catch (error) {
      console.error('Failed to fetch market context:', error);
      setContextError(error instanceof Error ? error.message : 'Unknown error');
      setMarketContext(null);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe what strategy you want to create");
      return;
    }

    if (prompt.length < 10) {
      toast.error(
        "Please provide a more detailed description (at least 10 characters)",
      );
      return;
    }

    setLoading(true);

    try {
      // Build enhanced prompt with market context if available
      let enhancedPrompt = prompt.trim();
      
      if (enableMarketContext && marketContext) {
        const contextString = formatMarketContextForPrompt(marketContext);
        enhancedPrompt = `${prompt.trim()}

Market Context for ${marketContext.symbol} (${marketContext.timeframe}):
${contextString}

Please create a strategy that takes this current market situation into account.`;
      }

      const response = await fetch("/api/ai/generate-strategy-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          model: AI_MODEL,
          symbol: symbol,
          timeframe: timeframe,
          includeMarketContext: enableMarketContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "LIMIT_REACHED") {
          toast.error(data.error || "Daily limit reached");
        } else if (
          data.code === "SERVICE_UNAVAILABLE" ||
          data.code === "AUTH_ERROR"
        ) {
          toast.error(
            "AI service is temporarily unavailable. Please try again later or contact support.",
          );
        } else {
          toast.error(data.error || "Failed to generate strategy");
        }
        return;
      }

      if (data.usage) {
        setUsage(data.usage);
      }

      // Convert AI-generated data to form format
      const strategy = data.strategy;
      
      // Debug log to verify what we received from API
      console.log('✅ AI Strategy Received:', {
        name: strategy.name,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        rulesCount: strategy.rules?.length || 0,
        hasParameters: !!strategy.parameters,
        marketContextUsed: enableMarketContext
      });
      
      onGenerate({
        name: strategy.name,
        description: strategy.description,
        symbol: strategy.symbol || symbol,         // Use selected symbol if not provided
        timeframe: strategy.timeframe || timeframe,   // Use selected timeframe if not provided
        rules: strategy.rules,
        parameters: strategy.parameters, // IMPORTANT: Pass parameters!
      });

      toast.success("Strategy generated! Review and customize it below.");
      setPrompt(""); // Clear prompt after successful generation
    } catch (error) {
      console.error("AI Generation error:", error);
      toast.error("An error occurred while generating strategy");
    } finally {
      setLoading(false);
    }
  };

  // Format market context for prompt
  const formatMarketContextForPrompt = (context: MarketContext): string => {
    return `- Current Price: ${context.price.current.toFixed(5)} (${context.price.changePercent >= 0 ? '+' : ''}${context.price.changePercent.toFixed(2)}%)
- Trend: ${context.trend.direction} (Strength: ${context.trend.strength}/100)
- Volatility: ${context.volatility.volatilityLevel} (ATR: ${context.volatility.currentATR.toFixed(5)})
- Key Levels: Support ${context.keyLevels.nearestSupport?.toFixed(5) || 'N/A'}, Resistance ${context.keyLevels.nearestResistance?.toFixed(5) || 'N/A'}
- Market Sessions: ${context.session.activeSessions.join(', ')} (${context.session.marketCondition} activity)
- Optimal for ${context.symbol}: ${context.session.isOptimalForPair ? 'YES' : 'NO'}`;
  };

  const promptExamples = [
    "Create a scalping strategy using RSI and MACD for EURUSD on 5-minute timeframe",
    "Build a trend-following strategy with EMA crossover and ADX filter for GBPUSD daily chart",
    "Generate a breakout strategy using Bollinger Bands with tight risk management",
    "Create a mean-reversion strategy using RSI oversold/overbought conditions",
  ];

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <CardTitle>AI Strategy Generator</CardTitle>
        </div>
        <CardDescription>
          Describe your trading strategy idea and let AI create it for you with real-time market context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Info & AI Model */}
        <div className="rounded-lg bg-white border border-purple-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-neutral-700">
                Enhanced AI with Market Context
              </span>
            </div>
            {usage && (
              <span className="text-sm font-semibold text-purple-600">
                {usage.remaining} / {usage.dailyLimit} remaining
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Using xAI's Grok 4 Fast with real-time market analysis for optimal strategy generation
          </p>
        </div>

        {/* Symbol and Timeframe Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Trading Symbol <span className="text-red-600">*</span>
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              disabled={loading}
            >
              {TRADING_CONFIG.SUPPORTED_SYMBOLS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Timeframe <span className="text-red-600">*</span>
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              disabled={loading}
            >
              <option value="M5">M5 (5 minutes)</option>
              <option value="M15">M15 (15 minutes)</option>
              <option value="M30">M30 (30 minutes)</option>
              <option value="H1">H1 (1 hour)</option>
              <option value="H4">H4 (4 hours)</option>
              <option value="D1">D1 (Daily)</option>
            </select>
          </div>
        </div>

        {/* Market Context Display */}
        {enableMarketContext && (
          <div className="rounded-lg bg-white border border-blue-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-neutral-700">
                  Market Context
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnableMarketContext(!enableMarketContext)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {enableMarketContext ? 'Disable' : 'Enable'} Context
              </button>
            </div>
            
            {loadingContext ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading market context...
              </div>
            ) : contextError ? (
              <div className="text-sm text-red-600">
                Failed to load market context: {contextError}
              </div>
            ) : marketContext ? (
              <div className="space-y-2">
                {/* Price and Trend */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{marketContext.symbol}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      marketContext.price.changePercent >= 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {marketContext.price.current.toFixed(5)}
                      ({marketContext.price.changePercent >= 0 ? '+' : ''}{marketContext.price.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {marketContext.trend.direction === 'bullish' && <TrendingUp className="h-3 w-3 text-green-600" />}
                    {marketContext.trend.direction === 'bearish' && <TrendingDown className="h-3 w-3 text-red-600" />}
                    <span className="text-xs capitalize">{marketContext.trend.direction}</span>
                    <span className="text-xs text-neutral-500">({marketContext.trend.strength}/100)</span>
                  </div>
                </div>

                {/* Volatility and Sessions */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Volatility:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      marketContext.volatility.volatilityLevel === 'high'
                        ? 'bg-red-100 text-red-700'
                        : marketContext.volatility.volatilityLevel === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {marketContext.volatility.volatilityLevel.toUpperCase()}
                    </span>
                    <span className="text-xs text-neutral-500">(ATR: {marketContext.volatility.currentATR.toFixed(5)})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-600" />
                    <span className="text-xs text-neutral-500">
                      {marketContext.session.activeSessions.length > 0
                        ? marketContext.session.activeSessions.join(', ')
                        : 'No active sessions'}
                    </span>
                  </div>
                </div>

                {/* Key Levels */}
                {(marketContext.keyLevels.nearestSupport || marketContext.keyLevels.nearestResistance) && (
                  <div className="flex items-center justify-between text-sm">
                    {marketContext.keyLevels.nearestSupport && (
                      <span className="text-xs text-green-600">
                        S: {marketContext.keyLevels.nearestSupport.toFixed(5)}
                      </span>
                    )}
                    {marketContext.keyLevels.nearestResistance && (
                      <span className="text-xs text-red-600">
                        R: {marketContext.keyLevels.nearestResistance.toFixed(5)}
                      </span>
                    )}
                  </div>
                )}

                {/* Optimal Trading Indicator */}
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${
                    marketContext.session.isOptimalForPair
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {marketContext.session.isOptimalForPair ? 'OPTIMAL' : 'SUBOPTIMAL'}
                  </span>
                  <span className="text-neutral-500">
                    for {marketContext.symbol} at this time
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">
                Market context will appear here once loaded
              </div>
            )}
          </div>
        )}

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Describe Your Strategy <span className="text-red-600">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Example: Create a trend-following strategy using 50 and 200 EMA crossover for ${symbol} on ${timeframe} timeframe...`}
            rows={4}
            className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            disabled={loading}
            maxLength={1000}
          />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{prompt.length}/1000 characters</span>
            {prompt.length < 10 && prompt.length > 0 && (
              <span className="text-amber-600">
                Minimum 10 characters required
              </span>
            )}
          </div>
        </div>

        {/* Example Prompts */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            Example Prompts:
          </p>
          <div className="grid gap-2">
            {promptExamples.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(example)}
                className="text-left rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={
            loading ||
            prompt.length < 10 ||
            (usage && usage.remaining === 0) ||
            false
          }
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Strategy...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate Enhanced Strategy with AI
            </>
          )}
        </Button>

        {usage && usage.remaining === 0 && (
          <p className="text-sm text-center text-red-600">
            Daily AI generation limit reached. Try again tomorrow!
          </p>
        )}

        {/* Enhanced Info Box */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="space-y-1 text-sm text-purple-900">
            <p className="font-medium">💡 Enhanced AI Features:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Real-time market context integration</li>
              <li>ATR-based volatility analysis</li>
              <li>Session-aware strategy generation</li>
              <li>Key support/resistance level identification</li>
              <li>Be specific about indicators and trading style</li>
              <li>AI will optimize for current market conditions</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
