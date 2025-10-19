'use client';

import React, { useState, useEffect } from 'react';
import { Position } from '@/lib/brokers/types';
import { MonitoredPosition } from '@/lib/monitoring/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  TrendingUp,
  TrendingDown,
  X,
  Edit,
  AlertTriangle,
  DollarSign,
  Clock,
  Info
} from 'lucide-react';

interface PositionCardProps {
  position: MonitoredPosition;
  onClose?: (ticket: number) => void;
  onModify?: (ticket: number, params: { stopLoss?: number; takeProfit?: number }) => void;
  showDetails?: boolean;
  className?: string;
}

export function PositionCard({
  position,
  onClose,
  onModify,
  showDetails = true,
  className = ''
}: PositionCardProps) {
  const [currentPrice, setCurrentPrice] = useState(position.priceCurrent);
  const [profit, setProfit] = useState(position.profit);
  const [isClosing, setIsClosing] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [newStopLoss, setNewStopLoss] = useState(position.priceSL);
  const [newTakeProfit, setNewTakeProfit] = useState(position.priceTP);

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small price movements
      const priceChange = (Math.random() - 0.5) * 0.0001;
      const newPrice = currentPrice + priceChange;
      setCurrentPrice(newPrice);
      
      // Recalculate profit based on new price
      const priceDiff = position.type === 0
        ? newPrice - position.priceOpen
        : position.priceOpen - newPrice;
      const pipValue = 0.0001; // Simplified pip value
      const newProfit = priceDiff * position.volume * 100000 * pipValue;
      setProfit(newProfit);
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [currentPrice, position]);

  const handleClose = async () => {
    if (!onClose) return;
    
    setIsClosing(true);
    try {
      await onClose(position.ticket);
    } catch (error) {
      console.error('Failed to close position:', error);
    } finally {
      setIsClosing(false);
    }
  };

  const handleModify = async () => {
    if (!onModify) return;
    
    try {
      await onModify(position.ticket, {
        stopLoss: newStopLoss,
        takeProfit: newTakeProfit
      });
      setShowModifyDialog(false);
    } catch (error) {
      console.error('Failed to modify position:', error);
    }
  };

  const isProfitable = profit >= 0;
  const profitPercent = position.priceOpen > 0 ? (profit / (position.priceOpen * position.volume * 100000)) * 100 : 0;

  return (
    <>
      <Card className={`p-4 ${className}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              position.type === 0 ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <h3 className="font-semibold text-neutral-900">{position.symbol}</h3>
            <span className={`text-xs px-2 py-1 rounded ${
              position.type === 0
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {position.type === 0 ? 'BUY' : 'SELL'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {position.alerts && position.alerts.length > 0 && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs text-neutral-500">#{position.ticket}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-neutral-500 mb-1">Volume</p>
            <p className="font-medium text-neutral-900">{position.volume} lots</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-1">Open Price</p>
            <p className="font-medium text-neutral-900">{position.priceOpen.toFixed(5)}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-neutral-500">Current Price</p>
            <p className="text-xs text-neutral-400">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
          <p className="font-medium text-neutral-900">{currentPrice.toFixed(5)}</p>
        </div>

        <div className={`p-3 rounded-lg mb-3 ${
          isProfitable ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">P&L</span>
            </div>
            <div className="text-right">
              <p className={`font-bold ${
                isProfitable ? 'text-green-600' : 'text-red-600'
              }`}>
                ${profit.toFixed(2)}
              </p>
              <p className={`text-xs ${
                isProfitable ? 'text-green-600' : 'text-red-600'
              }`}>
                {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="space-y-2 mb-3">
            {position.priceSL && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Stop Loss</span>
                <span className="font-medium">{position.priceSL.toFixed(5)}</span>
              </div>
            )}
            {position.priceTP && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Take Profit</span>
                <span className="font-medium">{position.priceTP.toFixed(5)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-neutral-500">Open Time</span>
              <span className="font-medium">
                {new Date(position.openTime).toLocaleString()}
              </span>
            </div>
            {position.swap !== 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Swap</span>
                <span className={`font-medium ${
                  position.swap >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${position.swap.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowModifyDialog(true)}
            className="flex-1"
          >
            <Edit className="h-3 w-3 mr-1" />
            Modify
          </Button>
          <Button
            variant={position.type === 0 ? "danger" : "primary"}
            size="sm"
            onClick={handleClose}
            disabled={isClosing}
            className="flex-1"
          >
            <X className="h-3 w-3 mr-1" />
            {isClosing ? 'Closing...' : 'Close'}
          </Button>
        </div>
      </Card>

      {/* Modify Position Dialog */}
      {showModifyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Modify Position</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Stop Loss
                </label>
                <input
                  type="number"
                  value={newStopLoss || ''}
                  onChange={(e) => setNewStopLoss(parseFloat(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="No stop loss"
                  step="0.00001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Take Profit
                </label>
                <input
                  type="number"
                  value={newTakeProfit || ''}
                  onChange={(e) => setNewTakeProfit(parseFloat(e.target.value) || undefined)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="No take profit"
                  step="0.00001"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowModifyDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleModify}
                className="flex-1"
              >
                Apply Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}