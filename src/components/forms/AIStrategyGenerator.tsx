"use client";

import { useState, useEffect, useRef } from "react";
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
import { getCategorizedSymbols } from "@/lib/market/symbols";

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
  
  // State for generated strategy summary
  const [generatedStrategy, setGeneratedStrategy] = useState<any | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Fixed model - AI NusaNexus (powered by OpenRouter)
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
      
      // Store generated strategy for summary display with user-selected values
      const enrichedStrategy = {
        ...strategy,
        symbol: symbol,  // ALWAYS use user-selected symbol
        timeframe: timeframe,  // ALWAYS use user-selected timeframe
      };
      setGeneratedStrategy(enrichedStrategy);
      
      onGenerate({
        name: strategy.name,
        description: strategy.description,
        symbol: symbol,  // Use user-selected symbol
        timeframe: timeframe,  // Use user-selected timeframe
        rules: strategy.rules,
        parameters: strategy.parameters, // IMPORTANT: Pass parameters!
      });

      toast.success("Strategy generated! Review the summary below and customize if needed.");
      setPrompt(""); // Clear prompt after successful generation
      
      // Auto-scroll to summary after a brief delay
      setTimeout(() => {
        summaryRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 300);
    } catch (error) {
      console.error("AI Generation error:", error);
      toast.error("An error occurred while generating strategy");
    } finally {
      setLoading(false);
    }
  };

  // Format market context for prompt
  const formatMarketContextForPrompt = (context: MarketContext): string => {
    return `- Current Price: ${context.price?.current?.toFixed(5) || 'N/A'} (${context.price?.changePercent ? (context.price.changePercent >= 0 ? '+' : '') + context.price.changePercent.toFixed(2) : '0.00'}%)
- Trend: ${context.trend?.direction || 'unknown'} (Strength: ${context.trend?.strength || 0}/100)
- Volatility: ${context.volatility?.volatilityLevel || 'unknown'} (ATR: ${context.volatility?.currentATR?.toFixed(5) || 'N/A'})
- Key Levels: Support ${context.keyLevels?.nearestSupport?.toFixed(5) || 'N/A'}, Resistance ${context.keyLevels?.nearestResistance?.toFixed(5) || 'N/A'}
- Market Sessions: ${context.session?.activeSessions?.join(', ') || 'N/A'} (${context.session?.marketCondition || 'unknown'} activity)
- Optimal for ${context.symbol}: ${context.session?.isOptimalForPair ? 'YES' : 'NO'}`;
  };

  // Extract indicators from strategy rules
  const extractIndicators = (strategy: any): string[] => {
    const indicators = new Set<string>();
    
    if (strategy.rules && Array.isArray(strategy.rules)) {
      strategy.rules.forEach((rule: any) => {
        if (rule.conditions && Array.isArray(rule.conditions)) {
          rule.conditions.forEach((condition: any) => {
            if (condition.indicator) {
              indicators.add(condition.indicator.toUpperCase());
            }
          });
        }
      });
    }
    
    return Array.from(indicators);
  };

  // Count entry conditions
  const countConditions = (strategy: any): number => {
    let count = 0;
    if (strategy.rules && Array.isArray(strategy.rules)) {
      strategy.rules.forEach((rule: any) => {
        if (rule.conditions && Array.isArray(rule.conditions)) {
          count += rule.conditions.length;
        }
      });
    }
    return count;
  };

  // Get all market sessions with status
  const getAllSessionsStatus = () => {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const currentTimeMinutes = utcHours * 60 + utcMinutes;

    const sessions = [
      {
        name: 'Sydney',
        emoji: '🇦🇺',
        start: 22 * 60, // 22:00 UTC
        end: 7 * 60,    // 07:00 UTC (next day)
        volume: 'Low',
        wibTime: '05:00-14:00 WIB'
      },
      {
        name: 'Tokyo',
        emoji: '🇯🇵',
        start: 0 * 60,  // 00:00 UTC
        end: 9 * 60,    // 09:00 UTC
        volume: 'Medium',
        wibTime: '07:00-16:00 WIB'
      },
      {
        name: 'London',
        emoji: '🇬🇧',
        start: 8 * 60,  // 08:00 UTC
        end: 17 * 60,   // 17:00 UTC
        volume: 'High',
        wibTime: '15:00-00:00 WIB'
      },
      {
        name: 'NewYork',
        emoji: '🇺🇸',
        start: 13 * 60, // 13:00 UTC
        end: 22 * 60,   // 22:00 UTC
        volume: 'High',
        wibTime: '20:00-05:00 WIB'
      }
    ];

    return sessions.map(session => {
      let isActive = false;
      let minutesRemaining = 0;
      let minutesToOpen = 0;

      // Check if session is active (handles midnight crossover)
      if (session.start < session.end) {
        isActive = currentTimeMinutes >= session.start && currentTimeMinutes < session.end;
        if (isActive) {
          minutesRemaining = session.end - currentTimeMinutes;
        } else if (currentTimeMinutes < session.start) {
          minutesToOpen = session.start - currentTimeMinutes;
        } else {
          minutesToOpen = (24 * 60 - currentTimeMinutes) + session.start;
        }
      } else {
        // Session crosses midnight (Sydney)
        isActive = currentTimeMinutes >= session.start || currentTimeMinutes < session.end;
        if (isActive) {
          if (currentTimeMinutes >= session.start) {
            minutesRemaining = (24 * 60 - currentTimeMinutes) + session.end;
          } else {
            minutesRemaining = session.end - currentTimeMinutes;
          }
        } else {
          minutesToOpen = session.start - currentTimeMinutes;
        }
      }

      const hoursRemaining = Math.floor(minutesRemaining / 60);
      const minsRemaining = minutesRemaining % 60;
      const hoursToOpen = Math.floor(minutesToOpen / 60);
      const minsToOpen = minutesToOpen % 60;

      return {
        ...session,
        isActive,
        timeRemaining: isActive ? `${hoursRemaining}h ${minsRemaining}m` : null,
        opensIn: !isActive ? `${hoursToOpen}h ${minsToOpen}m` : null
      };
    });
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
            Using AI NusaNexus with real-time market analysis for optimal strategy generation
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
              {(() => {
                const categorized = getCategorizedSymbols();
                return (
                  <>
                    {categorized.forex.major.length > 0 && (
                      <optgroup label="📊 Forex - Major Pairs">
                        {categorized.forex.major.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.forex.minor.length > 0 && (
                      <optgroup label="📊 Forex - Minor Pairs">
                        {categorized.forex.minor.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.forex.exotic.length > 0 && (
                      <optgroup label="📊 Forex - Exotic Pairs">
                        {categorized.forex.exotic.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.commodities.preciousMetals.length > 0 && (
                      <optgroup label="🥇 Commodities - Precious Metals">
                        {categorized.commodities.preciousMetals.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.commodities.energy.length > 0 && (
                      <optgroup label="⚡ Commodities - Energy">
                        {categorized.commodities.energy.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.commodities.baseMetals.length > 0 && (
                      <optgroup label="🔩 Commodities - Base Metals">
                        {categorized.commodities.baseMetals.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.commodities.agricultural.length > 0 && (
                      <optgroup label="🌾 Commodities - Agricultural">
                        {categorized.commodities.agricultural.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                    {categorized.crypto.cryptocurrency.length > 0 && (
                      <optgroup label="₿ Cryptocurrency">
                        {categorized.crypto.cryptocurrency.map((sym) => (
                          <option key={sym} value={sym}>{sym}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
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
              <div className="space-y-3">
                {/* Price and Trend */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{marketContext.symbol}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      marketContext.price.changePercent >= 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {marketContext.price?.current?.toFixed(5) || 'N/A'}
                      ({marketContext.price?.changePercent ? (marketContext.price.changePercent >= 0 ? '+' : '') + marketContext.price.changePercent.toFixed(2) : '0.00'}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {marketContext.trend?.direction === 'bullish' && <TrendingUp className="h-3 w-3 text-green-600" />}
                    {marketContext.trend?.direction === 'bearish' && <TrendingDown className="h-3 w-3 text-red-600" />}
                    <span className="text-xs capitalize">{marketContext.trend?.direction || 'unknown'}</span>
                    <span className="text-xs text-neutral-500">({marketContext.trend?.strength || 0}/100)</span>
                  </div>
                </div>

                {/* Volatility */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-neutral-500">Volatility:</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    marketContext.volatility?.volatilityLevel === 'high'
                      ? 'bg-red-100 text-red-700'
                      : marketContext.volatility?.volatilityLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {marketContext.volatility?.volatilityLevel?.toUpperCase() || 'N/A'}
                  </span>
                  <span className="text-xs text-neutral-500">(ATR: {marketContext.volatility?.currentATR?.toFixed(5) || 'N/A'})</span>
                </div>

                {/* All Market Sessions with Status */}
                <div className="border-t border-blue-200 pt-2 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-700">MARKET SESSIONS (24/7)</span>
                    <span className="text-xs text-blue-600">Live Status</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {getAllSessionsStatus().map((session, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border ${
                          session.isActive
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className={`text-lg`}>{session.emoji}</span>
                            <span className={`text-xs font-semibold ${
                              session.isActive ? 'text-green-700' : 'text-gray-500'
                            }`}>
                              {session.name}
                            </span>
                          </div>
                          <div className={`h-2 w-2 rounded-full ${
                            session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                          }`} />
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          {session.wibTime}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className={`text-xs font-medium ${
                            session.volume === 'High' ? 'text-red-600' :
                            session.volume === 'Medium' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {session.volume} Vol
                          </span>
                          {session.isActive ? (
                            <span className="text-xs text-green-600">
                              {session.timeRemaining} left
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Opens in {session.opensIn}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Golden Hour Indicator */}
                  {(() => {
                    const sessions = getAllSessionsStatus();
                    const londonActive = sessions.find(s => s.name === 'London')?.isActive;
                    const nyActive = sessions.find(s => s.name === 'NewYork')?.isActive;
                    if (londonActive && nyActive) {
                      return (
                        <div className="mt-2 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 rounded">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⭐</span>
                            <div className="flex-1">
                              <div className="text-xs font-bold text-orange-700">GOLDEN HOUR - HIGHEST VOLUME!</div>
                              <div className="text-xs text-orange-600">London + NewYork Overlap (70% daily volume)</div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Next High Volume Session */}
                  <div className="mt-2 text-xs text-neutral-600 bg-blue-50 p-2 rounded">
                    <span className="font-semibold text-blue-700">💡 Best Trading Time:</span> 20:00-00:00 WIB (London+NY Overlap)
                  </div>
                </div>

                {/* Key Levels with Explanation */}
                {(marketContext.keyLevels.nearestSupport || marketContext.keyLevels.nearestResistance) && (
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-700">KEY PRICE LEVELS</span>
                      <span className="text-xs text-blue-600">Technical Analysis</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {marketContext.keyLevels.nearestSupport && (
                        <div className="p-2 rounded border border-green-200 bg-green-50">
                          <div className="text-xs font-semibold text-green-700 mb-1">Support (S)</div>
                          <div className="text-sm font-bold text-green-600">
                            {marketContext.keyLevels.nearestSupport?.toFixed(5) || 'N/A'}
                          </div>
                          <div className="text-xs text-green-600 mt-1">Buy zone / Stop loss</div>
                        </div>
                      )}
                      {marketContext.keyLevels.nearestResistance && (
                        <div className="p-2 rounded border border-red-200 bg-red-50">
                          <div className="text-xs font-semibold text-red-700 mb-1">Resistance (R)</div>
                          <div className="text-sm font-bold text-red-600">
                            {marketContext.keyLevels.nearestResistance?.toFixed(5) || 'N/A'}
                          </div>
                          <div className="text-xs text-red-600 mt-1">Sell zone / Take profit</div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-neutral-600 bg-purple-50 p-2 rounded">
                      <span className="font-semibold text-purple-700">ℹ️ What is S & R?</span>
                      <ul className="mt-1 space-y-0.5 text-neutral-600">
                        <li>• <strong>Support (S):</strong> Level dimana harga cenderung berhenti turun (demand zone)</li>
                        <li>• <strong>Resistance (R):</strong> Level dimana harga cenderung berhenti naik (supply zone)</li>
                        <li>• Digunakan untuk menentukan entry/exit points dan stop loss/take profit</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Optimal Trading Indicator */}
                <div className="flex items-center gap-2 text-xs pt-2 border-t border-blue-200">
                  <span className={`px-2 py-1 rounded ${
                    marketContext.session?.isOptimalForPair
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {marketContext.session?.isOptimalForPair ? '✅ OPTIMAL' : '⚠️ SUBOPTIMAL'}
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

        {/* Strategy Summary Display */}
        {generatedStrategy && (
          <div 
            ref={summaryRef}
            className="mt-6 space-y-4 rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-900">✅ Strategy Generated Successfully!</h3>
                <p className="text-sm text-green-700">Review the complete details below and customize as needed</p>
              </div>
            </div>

            {/* Strategy Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-white border border-green-200 p-4">
                <div className="text-xs font-semibold text-green-700 mb-1">STRATEGY NAME</div>
                <div className="text-sm font-bold text-neutral-900">{generatedStrategy.name}</div>
              </div>
              <div className="rounded-lg bg-white border border-green-200 p-4">
                <div className="text-xs font-semibold text-green-700 mb-1">SYMBOL & TIMEFRAME</div>
                <div className="text-sm font-bold text-neutral-900">
                  {generatedStrategy.symbol} • {generatedStrategy.timeframe}
                </div>
              </div>
            </div>

            {/* Description */}
            {generatedStrategy.description && (
              <div className="rounded-lg bg-white border border-green-200 p-4">
                <div className="text-xs font-semibold text-green-700 mb-2">DESCRIPTION</div>
                <div className="text-sm text-neutral-700">{generatedStrategy.description}</div>
              </div>
            )}

            {/* Indicators Used */}
            {extractIndicators(generatedStrategy).length > 0 && (
              <div className="rounded-lg bg-white border border-green-200 p-4">
                <div className="text-xs font-semibold text-green-700 mb-3">INDICATORS USED</div>
                <div className="flex flex-wrap gap-2">
                  {extractIndicators(generatedStrategy).map((indicator, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Entry Conditions Detail */}
            <div className="rounded-lg bg-white border border-green-200 p-4">
              <div className="text-xs font-semibold text-green-700 mb-3">ENTRY CONDITIONS</div>
              
              {/* Summary */}
              <div className="flex items-center gap-4 mb-4 pb-3 border-b border-green-200">
                <div className="text-sm">
                  <span className="text-neutral-600">Total Rules:</span>
                  <span className="ml-2 font-bold text-neutral-900">
                    {generatedStrategy.rules?.length || 0}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-neutral-600">Total Conditions:</span>
                  <span className="ml-2 font-bold text-neutral-900">
                    {countConditions(generatedStrategy)}
                  </span>
                </div>
              </div>

              {/* Detailed Conditions */}
              {generatedStrategy.rules && Array.isArray(generatedStrategy.rules) && generatedStrategy.rules.length > 0 && (
                <div className="space-y-3">
                  {generatedStrategy.rules.map((rule: any, ruleIndex: number) => (
                    <div key={ruleIndex} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
                      {/* Rule Name */}
                      {rule.name && (
                        <div className="text-xs font-bold text-blue-700 mb-2">
                          📋 {rule.name}
                        </div>
                      )}
                      
                      {/* Conditions */}
                      {rule.conditions && Array.isArray(rule.conditions) && rule.conditions.length > 0 && (
                        <div className="space-y-1.5">
                          {rule.conditions.map((condition: any, condIndex: number) => {
                            const operatorSymbol = {
                              'gt': '>',
                              'gte': '≥',
                              'lt': '<',
                              'lte': '≤',
                              'eq': '=',
                              'crosses_above': '↗',
                              'crosses_below': '↘'
                            }[condition.operator] || condition.operator;

                            const isStringValue = typeof condition.value === 'string';
                            const displayValue = isStringValue 
                              ? condition.value.toUpperCase()
                              : condition.value;

                            return (
                              <div key={condIndex} className="flex items-center gap-2 text-sm">
                                <span className="flex items-center gap-1.5 font-mono bg-white px-2 py-1 rounded border border-blue-300">
                                  <span className="text-blue-700 font-bold">{condition.indicator?.toUpperCase()}</span>
                                  <span className="text-neutral-600">{operatorSymbol}</span>
                                  <span className={`font-bold ${isStringValue ? 'text-purple-700' : 'text-green-700'}`}>
                                    {displayValue}
                                  </span>
                                </span>
                                
                                {condition.description && (
                                  <span className="text-xs text-neutral-600 italic">
                                    {condition.description}
                                  </span>
                                )}
                                
                                {condIndex < rule.conditions.length - 1 && (
                                  <span className="text-xs font-bold text-blue-600">
                                    {rule.logic === 'OR' ? 'OR' : 'AND'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Action */}
                      {rule.action && (
                        <div className="mt-2 pt-2 border-t border-blue-200 text-xs">
                          <span className="text-neutral-600">Action:</span>
                          <span className={`ml-2 font-bold ${
                            rule.action.type === 'buy' ? 'text-green-600' : 
                            rule.action.type === 'sell' ? 'text-red-600' : 
                            'text-neutral-600'
                          }`}>
                            {rule.action.type?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* No conditions warning */}
              {(!generatedStrategy.rules || generatedStrategy.rules.length === 0) && (
                <div className="text-sm text-amber-600 bg-amber-50 rounded p-3 border border-amber-200">
                  ⚠️ No entry conditions defined
                </div>
              )}
            </div>

            {/* Risk Management Parameters */}
            {generatedStrategy.parameters && (
              <div className="rounded-lg bg-white border border-green-200 p-4">
                <div className="text-xs font-semibold text-green-700 mb-3">RISK MANAGEMENT</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {generatedStrategy.parameters.stopLoss && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Stop Loss:</span>
                      <span className="font-bold text-red-600">
                        {generatedStrategy.parameters.stopLoss} pips
                      </span>
                    </div>
                  )}
                  {generatedStrategy.parameters.takeProfit && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Take Profit:</span>
                      <span className="font-bold text-green-600">
                        {generatedStrategy.parameters.takeProfit} pips
                      </span>
                    </div>
                  )}
                  {generatedStrategy.parameters.riskPerTrade && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Risk Per Trade:</span>
                      <span className="font-bold text-neutral-900">
                        {(generatedStrategy.parameters.riskPerTrade * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {generatedStrategy.parameters.maxPositions && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Max Positions:</span>
                      <span className="font-bold text-neutral-900">
                        {generatedStrategy.parameters.maxPositions}
                      </span>
                    </div>
                  )}
                  {generatedStrategy.parameters.maxDailyLoss && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Max Daily Loss:</span>
                      <span className="font-bold text-red-600">
                        {generatedStrategy.parameters.maxDailyLoss} pips
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risk-Reward Ratio */}
            {generatedStrategy.parameters?.stopLoss && generatedStrategy.parameters?.takeProfit && (
              <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-semibold text-neutral-700">Risk-Reward Ratio:</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    1:{(generatedStrategy.parameters.takeProfit / generatedStrategy.parameters.stopLoss).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Advanced Features Indicator */}
            <div className="rounded-lg bg-white border border-blue-200 p-4">
              <div className="text-xs font-semibold text-blue-700 mb-3">ADVANCED FEATURES</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${generatedStrategy.parameters?.smartExit ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={generatedStrategy.parameters?.smartExit ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                    Smart Exit Rules
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${generatedStrategy.parameters?.dynamicRisk ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={generatedStrategy.parameters?.dynamicRisk ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                    Dynamic Risk
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${generatedStrategy.parameters?.sessionFilter ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={generatedStrategy.parameters?.sessionFilter ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                    Session Filter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${generatedStrategy.parameters?.correlationFilter ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={generatedStrategy.parameters?.correlationFilter ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                    Correlation Filter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${generatedStrategy.parameters?.regimeDetection ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={generatedStrategy.parameters?.regimeDetection ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                    Regime Detection
                  </span>
                </div>
              </div>
              {!generatedStrategy.parameters?.smartExit && !generatedStrategy.parameters?.dynamicRisk && (
                <div className="mt-3 text-xs text-blue-600">
                  💡 You can enable advanced features in the manual form below
                </div>
              )}
            </div>

            {/* Action Hint */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Activity className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Next Step:</span> Scroll down to review and customize the strategy parameters, then click "Create Strategy" to save.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
