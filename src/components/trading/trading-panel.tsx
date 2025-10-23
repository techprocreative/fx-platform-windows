"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Settings,
  Info,
  Calculator,
} from "lucide-react";
import { TradeParams, AccountInfo, SymbolInfo } from "@/lib/risk/types";
import { TRADING_CONFIG } from "@/lib/config";

interface TradingPanelProps {
  accountInfo?: AccountInfo;
  symbolInfo?: SymbolInfo;
  onTrade?: (params: TradeParams) => Promise<void>;
  symbols?: string[];
  className?: string;
}

export function TradingPanel({
  accountInfo,
  symbolInfo,
  onTrade,
  symbols = TRADING_CONFIG.SUPPORTED_SYMBOLS,
  className = "",
}: TradingPanelProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [lotSize, setLotSize] = useState(0.01);
  const [stopLoss, setStopLoss] = useState<number | undefined>();
  const [takeProfit, setTakeProfit] = useState<number | undefined>();
  const [currentPrice, setCurrentPrice] = useState({ bid: 1.085, ask: 1.0852 });
  const [riskPercent, setRiskPercent] = useState(2);
  const [calculatedLotSize, setCalculatedLotSize] = useState(0.01);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  // Fetch real-time price updates
  useEffect(() => {
    const fetchPrices = async () => {
      if (!selectedSymbol) return;

      setPriceLoading(true);
      try {
        const response = await fetch(
          `/api/market/quotes?symbols=${selectedSymbol}`,
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          const quote = data.data[0];
          setCurrentPrice({
            bid: quote.bid,
            ask: quote.ask,
          });
          setLastPriceUpdate(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch real-time prices:", error);
        // Keep existing prices on error
      } finally {
        setPriceLoading(false);
      }
    };

    // Initial fetch
    fetchPrices();

    // Set up real-time updates every 2 seconds
    const interval = setInterval(fetchPrices, 2000);

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // Calculate position size based on risk
  useEffect(() => {
    if (accountInfo && stopLoss) {
      const entryPrice =
        tradeType === "BUY" ? currentPrice.ask : currentPrice.bid;
      const stopLossDistance = Math.abs(entryPrice - stopLoss);
      const riskAmount = accountInfo.balance * (riskPercent / 100);
      const pipValue = 10; // Simplified pip value for standard lot
      const calculatedSize =
        riskAmount / ((stopLossDistance * 100000 * pipValue) / entryPrice);
      setCalculatedLotSize(
        Math.max(0.01, Math.min(calculatedSize, symbolInfo?.maxLot || 1.0)),
      );
    }
  }, [accountInfo, stopLoss, riskPercent, tradeType, currentPrice, symbolInfo]);

  const handleTrade = async () => {
    if (!onTrade) return;

    setIsExecuting(true);
    try {
      const entryPrice =
        tradeType === "BUY" ? currentPrice.ask : currentPrice.bid;
      await onTrade({
        symbol: selectedSymbol,
        type: tradeType,
        lotSize,
        entryPrice,
        stopLoss: stopLoss || 0,
        takeProfit,
        userId: "current-user", // This would come from session
        comment: "Manual trade",
      });
      setShowConfirmation(false);
      // Reset form
      setLotSize(0.01);
      setStopLoss(undefined);
      setTakeProfit(undefined);
    } catch (error) {
      console.error("Trade failed:", error);
    } finally {
      setIsExecuting(false);
    }
  };

  const calculateRiskReward = () => {
    if (!stopLoss || !takeProfit) return { risk: 0, reward: 0, ratio: 0 };

    const entryPrice =
      tradeType === "BUY" ? currentPrice.ask : currentPrice.bid;
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const ratio = risk > 0 ? reward / risk : 0;

    return { risk, reward, ratio };
  };

  const { risk, reward, ratio } = calculateRiskReward();

  return (
    <>
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-neutral-900">Trading Panel</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCalculator(!showCalculator)}
            >
              <Calculator className="h-4 w-4 mr-1" />
              Calculator
            </Button>
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Symbol Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Symbol
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Current Price Display */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-neutral-50 p-3 rounded-lg">
            <p className="text-xs text-neutral-500 mb-1">Bid</p>
            <p className="text-lg font-bold text-red-600">
              {priceLoading ? "..." : currentPrice.bid.toFixed(5)}
            </p>
          </div>
          <div className="bg-neutral-50 p-3 rounded-lg">
            <p className="text-xs text-neutral-500 mb-1">Ask</p>
            <p className="text-lg font-bold text-green-600">
              {priceLoading ? "..." : currentPrice.ask.toFixed(5)}
            </p>
          </div>
        </div>

        {lastPriceUpdate && (
          <p className="text-xs text-neutral-500 mb-4">
            Last updated: {lastPriceUpdate.toLocaleTimeString()}
          </p>
        )}

        {/* Trade Type Selection */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            variant={tradeType === "BUY" ? "primary" : "secondary"}
            onClick={() => setTradeType("BUY")}
            className="flex items-center justify-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            BUY
          </Button>
          <Button
            variant={tradeType === "SELL" ? "danger" : "secondary"}
            onClick={() => setTradeType("SELL")}
            className="flex items-center justify-center gap-2"
          >
            <TrendingDown className="h-4 w-4" />
            SELL
          </Button>
        </div>

        {/* Position Size */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Position Size (Lots)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(parseFloat(e.target.value) || 0.01)}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              step="0.01"
              min="0.01"
              max={symbolInfo?.maxLot || 1.0}
            />
            <Button
              variant="secondary"
              onClick={() => setLotSize(calculatedLotSize)}
              title="Use calculated position size"
            >
              <Calculator className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stop Loss & Take Profit */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Stop Loss
            </label>
            <input
              type="number"
              value={stopLoss || ""}
              onChange={(e) =>
                setStopLoss(parseFloat(e.target.value) || undefined)
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional"
              step="0.00001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Take Profit
            </label>
            <input
              type="number"
              value={takeProfit || ""}
              onChange={(e) =>
                setTakeProfit(parseFloat(e.target.value) || undefined)
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional"
              step="0.00001"
            />
          </div>
        </div>

        {/* Risk Management */}
        {showCalculator && (
          <div className="bg-neutral-50 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-neutral-900 mb-3">
              Risk Management
            </h3>

            <div className="mb-3">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Risk Per Trade (%)
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>0.5%</span>
                <span className="font-medium">{riskPercent}%</span>
                <span>5%</span>
              </div>
            </div>

            {accountInfo && (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Account Balance:</span>
                  <span className="font-medium">
                    ${accountInfo.balance.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Risk Amount:</span>
                  <span className="font-medium">
                    ${((accountInfo.balance * riskPercent) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Calculated Size:</span>
                  <span className="font-medium">
                    {calculatedLotSize.toFixed(2)} lots
                  </span>
                </div>
                {ratio > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Risk/Reward:</span>
                    <span
                      className={`font-medium ${ratio >= 1.5 ? "text-green-600" : "text-amber-600"}`}
                    >
                      1:{ratio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trade Button */}
        <Button
          variant={tradeType === "BUY" ? "primary" : "danger"}
          onClick={() => setShowConfirmation(true)}
          disabled={!accountInfo || isExecuting || priceLoading}
          className="w-full py-3 text-base font-semibold"
        >
          {isExecuting ? "Executing..." : `Place ${tradeType} Order`}
        </Button>

        {/* Account Info */}
        {accountInfo && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-500">Balance</p>
                <p className="font-medium">${accountInfo.balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-neutral-500">Equity</p>
                <p className="font-medium">${accountInfo.equity.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-neutral-500">Free Margin</p>
                <p className="font-medium">
                  ${accountInfo.freeMargin.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Margin Level</p>
                <p className="font-medium">
                  {accountInfo.marginLevel.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Trade Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Trade</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-600">Symbol:</span>
                <span className="font-medium">{selectedSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Type:</span>
                <span
                  className={`font-medium ${tradeType === "BUY" ? "text-green-600" : "text-red-600"}`}
                >
                  {tradeType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Volume:</span>
                <span className="font-medium">{lotSize} lots</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Entry Price:</span>
                <span className="font-medium">
                  {tradeType === "BUY"
                    ? currentPrice.ask.toFixed(5)
                    : currentPrice.bid.toFixed(5)}
                </span>
              </div>
              {stopLoss && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Stop Loss:</span>
                  <span className="font-medium">{stopLoss.toFixed(5)}</span>
                </div>
              )}
              {takeProfit && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Take Profit:</span>
                  <span className="font-medium">{takeProfit.toFixed(5)}</span>
                </div>
              )}
              {ratio > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-600">Risk/Reward:</span>
                  <span className="font-medium">1:{ratio.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmation(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant={tradeType === "BUY" ? "primary" : "danger"}
                onClick={handleTrade}
                disabled={isExecuting}
                className="flex-1"
              >
                {isExecuting ? "Executing..." : "Confirm Trade"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
