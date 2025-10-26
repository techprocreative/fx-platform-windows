'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface BetaLimits {
  maxLotSize: number;
  maxPositions: number;
  maxDailyTrades: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  allowedSymbols: string[];
}

interface BetaLimitsBadgeProps {
  limits: BetaLimits;
  variant?: 'compact' | 'full';
}

export const BetaLimitsBadge: React.FC<BetaLimitsBadgeProps> = ({ 
  limits, 
  variant = 'compact' 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (variant === 'compact') {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full hover:bg-yellow-200 transition-colors"
        >
          <AlertTriangle className="h-3 w-3" />
          Beta Mode
          <Info className="h-3 w-3" />
        </button>

        {showDetails && (
          <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-yellow-300 rounded-lg shadow-lg w-80">
            <div className="bg-yellow-50 px-3 py-2 border-b border-yellow-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-yellow-900">
                Beta Trading Limits
              </h4>
              <button
                onClick={() => setShowDetails(false)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-yellow-50 rounded px-2 py-1.5">
                  <div className="text-yellow-600 font-medium">Max Lot Size</div>
                  <div className="text-yellow-900 font-bold">{limits.maxLotSize}</div>
                </div>
                <div className="bg-yellow-50 rounded px-2 py-1.5">
                  <div className="text-yellow-600 font-medium">Max Positions</div>
                  <div className="text-yellow-900 font-bold">{limits.maxPositions}</div>
                </div>
                <div className="bg-yellow-50 rounded px-2 py-1.5">
                  <div className="text-yellow-600 font-medium">Daily Trades</div>
                  <div className="text-yellow-900 font-bold">{limits.maxDailyTrades}</div>
                </div>
                <div className="bg-yellow-50 rounded px-2 py-1.5">
                  <div className="text-yellow-600 font-medium">Max Loss</div>
                  <div className="text-yellow-900 font-bold">${limits.maxDailyLoss}</div>
                </div>
              </div>
              <div className="bg-yellow-50 rounded px-2 py-2">
                <div className="text-xs text-yellow-600 font-medium mb-1">
                  Allowed Symbols ({limits.allowedSymbols.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {limits.allowedSymbols.map((symbol) => (
                    <span
                      key={symbol}
                      className="inline-block bg-yellow-200 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-mono"
                    >
                      {symbol}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-yellow-900 mb-2">
            ⚠️ Beta Mode Active - Trading Limits Enforced
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-yellow-800 mb-2">
            <div className="bg-yellow-100 rounded px-2 py-1">
              <strong>Max Lot Size:</strong> {limits.maxLotSize}
            </div>
            <div className="bg-yellow-100 rounded px-2 py-1">
              <strong>Max Positions:</strong> {limits.maxPositions}
            </div>
            <div className="bg-yellow-100 rounded px-2 py-1">
              <strong>Daily Trades:</strong> {limits.maxDailyTrades}
            </div>
            <div className="bg-yellow-100 rounded px-2 py-1">
              <strong>Max Loss:</strong> ${limits.maxDailyLoss}
            </div>
          </div>
          <div className="bg-yellow-100 rounded px-2 py-2 mt-2">
            <p className="text-xs text-yellow-900 font-medium mb-1">
              <strong>Allowed Symbols ({limits.allowedSymbols.length}):</strong>
            </p>
            <div className="flex flex-wrap gap-1">
              {limits.allowedSymbols.map((symbol) => (
                <span
                  key={symbol}
                  className="inline-block bg-yellow-200 text-yellow-900 text-xs px-2 py-0.5 rounded font-mono"
                >
                  {symbol}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-yellow-800 mt-2">
            These limits apply to all trading operations during beta testing period.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BetaLimitsBadge;
