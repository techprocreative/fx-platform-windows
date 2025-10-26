"use client";

import { CheckCircle, TrendingUp, Activity, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  Tooltip as CustomTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface BacktestBadgeProps {
  verified?: boolean;
  winRate?: number;
  profitFactor?: number;
  returnPercentage?: number;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
}

export function BacktestBadge({
  verified = false,
  winRate,
  profitFactor,
  returnPercentage,
  size = "md",
  showDetails = false,
}: BacktestBadgeProps) {
  if (!verified) {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  const getBadgeColor = () => {
    if (!returnPercentage) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (returnPercentage >= 15) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (returnPercentage >= 10) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  };

  const getReliabilityStars = () => {
    if (!winRate || !profitFactor) return 3;
    if (winRate >= 55 && profitFactor >= 2.5) return 5;
    if (winRate >= 50 && profitFactor >= 2.0) return 4;
    if (winRate >= 45 && profitFactor >= 1.7) return 3;
    return 3;
  };

  const stars = getReliabilityStars();

  if (showDetails && winRate && profitFactor && returnPercentage) {
    return (
      <div className="flex flex-col gap-2">
        <Badge className={`${getBadgeColor()} ${sizeClasses[size]} flex items-center gap-1.5`}>
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="font-semibold">Backtested ✓</span>
        </Badge>
        
        <div className="grid grid-cols-3 gap-2 text-xs">
          <TooltipProvider delayDuration={200}>
            <RadixTooltip.Root>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-help">
                  <TrendingUp className="h-4 w-4 text-green-600 mb-1" />
                  <span className="font-semibold text-green-600">{returnPercentage.toFixed(1)}%</span>
                  <span className="text-gray-500 text-[10px]">3mo Return</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total return over 3-month backtest period</p>
              </TooltipContent>
            </RadixTooltip.Root>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <RadixTooltip.Root>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-help">
                  <Activity className="h-4 w-4 text-blue-600 mb-1" />
                  <span className="font-semibold text-blue-600">{winRate.toFixed(1)}%</span>
                  <span className="text-gray-500 text-[10px]">Win Rate</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Percentage of winning trades</p>
              </TooltipContent>
            </RadixTooltip.Root>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <RadixTooltip.Root>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-help">
                  <Shield className="h-4 w-4 text-purple-600 mb-1" />
                  <span className="font-semibold text-purple-600">{profitFactor.toFixed(2)}</span>
                  <span className="text-gray-500 text-[10px]">Profit Factor</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ratio of gross profit to gross loss</p>
              </TooltipContent>
            </RadixTooltip.Root>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span>Reliability:</span>
          <span className="text-yellow-500">{"⭐".repeat(stars)}</span>
          <span className="text-gray-400">{"☆".repeat(5 - stars)}</span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <RadixTooltip.Root>
        <TooltipTrigger asChild>
          <div className="inline-block">
            <Badge className={`${getBadgeColor()} ${sizeClasses[size]} flex items-center gap-1.5 cursor-help`}>
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="font-semibold">Backtested ✓</span>
              {returnPercentage && (
                <span className="ml-1 opacity-90">+{returnPercentage.toFixed(1)}%</span>
              )}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-semibold">Official Backtest Results</p>
            {returnPercentage && (
              <p className="text-sm">3-Month Return: <span className="font-semibold text-green-400">+{returnPercentage.toFixed(2)}%</span></p>
            )}
            {winRate && (
              <p className="text-sm">Win Rate: <span className="font-semibold">{winRate.toFixed(1)}%</span></p>
            )}
            {profitFactor && (
              <p className="text-sm">Profit Factor: <span className="font-semibold">{profitFactor.toFixed(2)}</span></p>
            )}
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600">
              Test Period: July 1 - October 1, 2024
            </p>
            <p className="text-xs text-gray-400">
              Reliability: {"⭐".repeat(stars)}{"☆".repeat(5 - stars)}
            </p>
          </div>
        </TooltipContent>
      </RadixTooltip.Root>
    </TooltipProvider>
  );
}

export default BacktestBadge;
