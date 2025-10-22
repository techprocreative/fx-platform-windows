// API Route: GET /api/risk/exposure
// Calculate real-time risk exposure from positions and account data

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all user's executors
    const executors = await prisma.executor.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null
      }
    });

    // Calculate total account balance
    const balance = executors.reduce((sum, e) => sum + (e.accountBalance || 0), 0);
    const equity = executors.reduce((sum, e) => sum + (e.accountEquity || 0), 0);

    // Get all open trades
    const openTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        closeTime: null,
        executorId: {
          in: executors.map(e => e.id)
        }
      },
      include: {
        strategy: {
          select: {
            name: true,
            symbol: true
          }
        }
      }
    });

    // Calculate exposure by symbol
    const exposureBySymbol: Record<string, {
      symbol: string;
      longLots: number;
      shortLots: number;
      netLots: number;
      longNotional: number;
      shortNotional: number;
      netNotional: number;
      positions: number;
      unrealizedPL: number;
      riskPercent: number;
    }> = {};

    openTrades.forEach(trade => {
      const symbol = trade.symbol;
      if (!exposureBySymbol[symbol]) {
        exposureBySymbol[symbol] = {
          symbol,
          longLots: 0,
          shortLots: 0,
          netLots: 0,
          longNotional: 0,
          shortNotional: 0,
          netNotional: 0,
          positions: 0,
          unrealizedPL: 0,
          riskPercent: 0
        };
      }

      const lots = trade.lots || 0;
      const notional = lots * 100000; // Standard lot = 100,000 units
      const pl = trade.profit || 0;

      exposureBySymbol[symbol].positions++;
      exposureBySymbol[symbol].unrealizedPL += pl;

      if (trade.type === 'BUY') {
        exposureBySymbol[symbol].longLots += lots;
        exposureBySymbol[symbol].longNotional += notional;
        exposureBySymbol[symbol].netLots += lots;
        exposureBySymbol[symbol].netNotional += notional;
      } else if (trade.type === 'SELL') {
        exposureBySymbol[symbol].shortLots += lots;
        exposureBySymbol[symbol].shortNotional += notional;
        exposureBySymbol[symbol].netLots -= lots;
        exposureBySymbol[symbol].netNotional -= notional;
      }

      // Calculate risk as % of balance (based on potential stop loss)
      if (balance > 0) {
        const potentialLoss = trade.stopLoss 
          ? Math.abs(trade.openPrice - trade.stopLoss) * lots * 100000 / 100 // Rough calculation
          : lots * 100; // Default risk estimate
        exposureBySymbol[symbol].riskPercent += (potentialLoss / balance * 100);
      }
    });

    // Calculate exposure by strategy
    const exposureByStrategy: Record<string, {
      strategyName: string;
      positions: number;
      totalLots: number;
      unrealizedPL: number;
      riskPercent: number;
    }> = {};

    openTrades.forEach(trade => {
      const strategyName = trade.strategy?.name || 'Unknown';
      if (!exposureByStrategy[strategyName]) {
        exposureByStrategy[strategyName] = {
          strategyName,
          positions: 0,
          totalLots: 0,
          unrealizedPL: 0,
          riskPercent: 0
        };
      }

      exposureByStrategy[strategyName].positions++;
      exposureByStrategy[strategyName].totalLots += trade.lots || 0;
      exposureByStrategy[strategyName].unrealizedPL += trade.profit || 0;
      
      if (balance > 0) {
        const potentialLoss = trade.stopLoss 
          ? Math.abs(trade.openPrice - trade.stopLoss) * (trade.lots || 0) * 100000 / 100
          : (trade.lots || 0) * 100;
        exposureByStrategy[strategyName].riskPercent += (potentialLoss / balance * 100);
      }
    });

    // Calculate total risk metrics
    const totalPositions = openTrades.length;
    const totalLots = openTrades.reduce((sum, t) => sum + (t.lots || 0), 0);
    const unrealizedPL = openTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    // Calculate used margin (rough estimate)
    const usedMargin = totalLots * 100000 / 100; // Assuming 1:100 leverage
    const freeMargin = equity - usedMargin;
    const marginLevel = usedMargin > 0 ? (equity / usedMargin * 100) : 0;

    // Calculate max drawdown from today's trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        openTime: { gte: today },
        executorId: {
          in: executors.map(e => e.id)
        }
      },
      orderBy: { openTime: 'asc' }
    });

    let runningBalance = balance;
    let peak = balance;
    let maxDrawdown = 0;

    todayTrades.forEach(trade => {
      runningBalance += (trade.profit || 0);
      if (runningBalance > peak) peak = runningBalance;
      const drawdown = (peak - runningBalance) / peak * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Risk violations check
    const violations: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      message: string;
      value: number;
      threshold: number;
    }> = [];

    // Check margin level
    if (marginLevel < 200) {
      violations.push({
        type: 'MARGIN_LEVEL',
        severity: marginLevel < 100 ? 'CRITICAL' : 'HIGH',
        message: `Margin level is ${marginLevel.toFixed(0)}% (threshold: 200%)`,
        value: marginLevel,
        threshold: 200
      });
    }

    // Check drawdown
    if (maxDrawdown > 10) {
      violations.push({
        type: 'DRAWDOWN',
        severity: maxDrawdown > 20 ? 'CRITICAL' : maxDrawdown > 15 ? 'HIGH' : 'MEDIUM',
        message: `Daily drawdown is ${maxDrawdown.toFixed(1)}% (threshold: 10%)`,
        value: maxDrawdown,
        threshold: 10
      });
    }

    // Check unrealized loss
    const unrealizedLossPercent = balance > 0 ? (unrealizedPL / balance * 100) : 0;
    if (unrealizedLossPercent < -5) {
      violations.push({
        type: 'UNREALIZED_LOSS',
        severity: unrealizedLossPercent < -10 ? 'CRITICAL' : 'HIGH',
        message: `Unrealized loss is ${unrealizedLossPercent.toFixed(1)}% (threshold: -5%)`,
        value: unrealizedLossPercent,
        threshold: -5
      });
    }

    // Check position concentration
    const maxSymbolExposure = Math.max(...Object.values(exposureBySymbol).map(e => Math.abs(e.riskPercent)), 0);
    if (maxSymbolExposure > 3) {
      violations.push({
        type: 'CONCENTRATION',
        severity: maxSymbolExposure > 5 ? 'HIGH' : 'MEDIUM',
        message: `Single symbol risk is ${maxSymbolExposure.toFixed(1)}% (threshold: 3%)`,
        value: maxSymbolExposure,
        threshold: 3
      });
    }

    // Overall risk exposure
    const riskExposure = {
      balance,
      equity,
      margin: usedMargin,
      freeMargin,
      marginLevel,
      totalPositions,
      totalLots,
      unrealizedPL,
      unrealizedPLPercent: balance > 0 ? (unrealizedPL / balance * 100) : 0,
      maxDrawdown,
      riskScore: calculateRiskScore(violations),
      riskLevel: getRiskLevel(violations)
    };

    return NextResponse.json({
      success: true,
      riskExposure,
      exposureBySymbol: Object.values(exposureBySymbol),
      exposureByStrategy: Object.values(exposureByStrategy),
      violations,
      summary: {
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'CRITICAL').length,
        highViolations: violations.filter(v => v.severity === 'HIGH').length,
        mediumViolations: violations.filter(v => v.severity === 'MEDIUM').length
      }
    });

  } catch (error: any) {
    console.error('❌ Get risk exposure API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateRiskScore(violations: any[]): number {
  let score = 100; // Start with perfect score
  
  violations.forEach(v => {
    switch (v.severity) {
      case 'CRITICAL':
        score -= 30;
        break;
      case 'HIGH':
        score -= 20;
        break;
      case 'MEDIUM':
        score -= 10;
        break;
      case 'LOW':
        score -= 5;
        break;
    }
  });

  return Math.max(0, Math.min(100, score));
}

function getRiskLevel(violations: any[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const hasCritical = violations.some(v => v.severity === 'CRITICAL');
  const hasHigh = violations.some(v => v.severity === 'HIGH');
  const hasMedium = violations.some(v => v.severity === 'MEDIUM');

  if (hasCritical) return 'CRITICAL';
  if (hasHigh) return 'HIGH';
  if (hasMedium) return 'MEDIUM';
  return 'LOW';
}
