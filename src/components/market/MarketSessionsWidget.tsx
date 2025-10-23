'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Clock
} from 'lucide-react';

interface MarketSession {
  name: string;
  emoji: string;
  start: number;
  end: number;
  volume: string;
  wibTime: string;
  isActive: boolean;
  timeRemaining: string | null;
  opensIn: string | null;
}

interface MarketContext {
  symbol: string;
  price: {
    current: number;
    changePercent: number;
  };
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: number;
  };
  volatility: {
    volatilityLevel: 'low' | 'medium' | 'high';
    currentATR: number;
  };
  keyLevels: {
    nearestSupport?: number;
    nearestResistance?: number;
  };
  session: {
    isOptimalForPair: boolean;
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch market data');
  const json = await res.json();
  return json.data.marketContext;
};

export function MarketSessionsWidget() {
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<MarketSession[]>([]);

  // Calculate sessions on client side (no API call)
  useEffect(() => {
    const calculateSessions = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const currentTimeMinutes = utcHours * 60 + utcMinutes;

      const sessionConfigs = [
        {
          name: 'Sydney',
          emoji: '🇦🇺',
          start: 22 * 60,
          end: 7 * 60,
          volume: 'Low',
          wibTime: '05:00-14:00 WIB'
        },
        {
          name: 'Tokyo',
          emoji: '🇯🇵',
          start: 0 * 60,
          end: 9 * 60,
          volume: 'Medium',
          wibTime: '07:00-16:00 WIB'
        },
        {
          name: 'London',
          emoji: '🇬🇧',
          start: 8 * 60,
          end: 17 * 60,
          volume: 'High',
          wibTime: '15:00-00:00 WIB'
        },
        {
          name: 'NewYork',
          emoji: '🇺🇸',
          start: 13 * 60,
          end: 22 * 60,
          volume: 'High',
          wibTime: '20:00-05:00 WIB'
        }
      ];

      const calculatedSessions = sessionConfigs.map(session => {
        let isActive = false;
        let minutesRemaining = 0;
        let minutesToOpen = 0;

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

      setSessions(calculatedSessions);
    };

    // Calculate immediately
    calculateSessions();

    // Update every minute
    const interval = setInterval(calculateSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check golden hour
  const isGoldenHour = () => {
    const london = sessions.find(s => s.name === 'London')?.isActive;
    const newYork = sessions.find(s => s.name === 'NewYork')?.isActive;
    return london && newYork;
  };

  // Fetch market data only when expanded (with SWR caching)
  const { data: marketData, error, isLoading } = useSWR<MarketContext>(
    expanded ? '/api/market/context?symbol=EURUSD&timeframe=H1' : null,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-neutral-900">Market Sessions (24/7)</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-600 font-medium">LIVE</span>
        </div>
      </div>

      {/* Sessions Grid - Always Visible (FREE) */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {sessions.map((session, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border transition-all ${
              session.isActive
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{session.emoji}</span>
                <span className={`text-sm font-semibold ${
                  session.isActive ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {session.name}
                </span>
              </div>
              <div className={`h-2 w-2 rounded-full ${
                session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
              }`} />
            </div>
            
            <div className="text-xs text-neutral-600 mb-1">
              {session.wibTime}
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${
                session.volume === 'High' ? 'text-red-600' :
                session.volume === 'Medium' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {session.volume} Vol
              </span>
              {session.isActive ? (
                <span className="text-xs text-green-600 font-medium">
                  {session.timeRemaining} left
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  Opens {session.opensIn}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Golden Hour Alert */}
      {isGoldenHour() && (
        <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div className="flex-1">
              <div className="text-xs font-bold text-orange-700">GOLDEN HOUR - HIGHEST VOLUME!</div>
              <div className="text-xs text-orange-600">London + NewYork Overlap (70% daily volume)</div>
            </div>
          </div>
        </div>
      )}

      {/* Best Trading Time Tip */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm">💡</span>
          <div className="text-xs text-blue-700">
            <span className="font-semibold">Best Trading Time:</span> 20:00-00:00 WIB (London+NY Overlap)
          </div>
        </div>
      </div>

      {/* Expandable Market Data Section */}
      <div className="border-t border-neutral-200 pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>
            {expanded ? 'Hide' : 'Show'} Live Market Data (EURUSD)
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-neutral-600">Loading market data...</span>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">Failed to load market data</p>
                <p className="text-xs text-red-600 mt-1">Please try again later</p>
              </div>
            ) : marketData ? (
              <>
                {/* Price and Trend */}
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">{marketData.symbol}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      marketData.price.changePercent >= 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {marketData.price.current.toFixed(5)}
                      ({marketData.price.changePercent >= 0 ? '+' : ''}{marketData.price.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {marketData.trend.direction === 'bullish' && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {marketData.trend.direction === 'bearish' && <TrendingDown className="h-4 w-4 text-red-600" />}
                    <span className="text-xs capitalize text-neutral-700">{marketData.trend.direction}</span>
                    <span className="text-xs text-neutral-500">({marketData.trend.strength}/100)</span>
                  </div>
                </div>

                {/* Volatility */}
                <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                  <span className="text-xs text-neutral-600">Volatility:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    marketData.volatility.volatilityLevel === 'high'
                      ? 'bg-red-100 text-red-700'
                      : marketData.volatility.volatilityLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {marketData.volatility.volatilityLevel.toUpperCase()}
                  </span>
                  <span className="text-xs text-neutral-500">(ATR: {marketData.volatility.currentATR.toFixed(5)})</span>
                </div>

                {/* Key Levels */}
                {(marketData.keyLevels.nearestSupport || marketData.keyLevels.nearestResistance) && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-700">Key Price Levels</div>
                    <div className="grid grid-cols-2 gap-2">
                      {marketData.keyLevels.nearestSupport && (
                        <div className="p-2 rounded border border-green-200 bg-green-50">
                          <div className="text-xs font-semibold text-green-700">Support (S)</div>
                          <div className="text-sm font-bold text-green-600 mt-1">
                            {marketData.keyLevels.nearestSupport.toFixed(5)}
                          </div>
                          <div className="text-xs text-green-600 mt-0.5">Buy zone</div>
                        </div>
                      )}
                      {marketData.keyLevels.nearestResistance && (
                        <div className="p-2 rounded border border-red-200 bg-red-50">
                          <div className="text-xs font-semibold text-red-700">Resistance (R)</div>
                          <div className="text-sm font-bold text-red-600 mt-1">
                            {marketData.keyLevels.nearestResistance.toFixed(5)}
                          </div>
                          <div className="text-xs text-red-600 mt-0.5">Sell zone</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Trading Condition */}
                <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    marketData.session.isOptimalForPair
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {marketData.session.isOptimalForPair ? '✅ OPTIMAL' : '⚠️ SUBOPTIMAL'}
                  </span>
                  <span className="text-xs text-neutral-600">
                    for {marketData.symbol} at this time
                  </span>
                </div>

                {/* Last Updated */}
                <div className="text-xs text-neutral-500 text-center">
                  Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
