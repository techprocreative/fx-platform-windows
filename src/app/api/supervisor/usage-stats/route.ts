// API Route: GET /api/supervisor/usage-stats
// Get LLM usage statistics and cost tracking

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MODEL_COSTS } from '@/lib/llm/openrouter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';  // 24h, 7d, 30d, all
    
    // Calculate date range
    let dateFilter: Date | undefined;
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        dateFilter = undefined;
    }
    
    // Get LLM usage logs
    const usageLogs = await (prisma as any).lLMUsageLog.findMany({
      where: {
        ...(dateFilter && { timestamp: { gte: dateFilter } })
      },
      orderBy: { timestamp: 'desc' }
    });
    
    // Calculate statistics
    const totalCalls = usageLogs.length;
    const successfulCalls = usageLogs.filter(log => log.success).length;
    const failedCalls = totalCalls - successfulCalls;
    
    const totalTokens = usageLogs.reduce((sum, log) => sum + log.totalTokens, 0);
    const totalPromptTokens = usageLogs.reduce((sum, log) => sum + log.promptTokens, 0);
    const totalCompletionTokens = usageLogs.reduce((sum, log) => sum + log.completionTokens, 0);
    
    // Calculate total cost
    let totalCost = 0;
    const costByModel: Record<string, number> = {};
    const callsByModel: Record<string, number> = {};
    
    for (const log of usageLogs) {
      const costPerM = MODEL_COSTS[log.model] || 0.35;
      const cost = (log.totalTokens / 1_000_000) * costPerM;
      totalCost += cost;
      
      if (!costByModel[log.model]) {
        costByModel[log.model] = 0;
        callsByModel[log.model] = 0;
      }
      
      costByModel[log.model] += cost;
      callsByModel[log.model] += 1;
    }
    
    // Average duration
    const avgDuration = totalCalls > 0
      ? usageLogs.reduce((sum, log) => sum + log.duration, 0) / totalCalls
      : 0;
    
    // Get optimization statistics
    const optimizations = await (prisma as any).parameterOptimization.findMany({
      where: {
        userId: session.user.id,
        ...(dateFilter && { createdAt: { gte: dateFilter } })
      }
    });
    
    const optimizationStats = {
      total: optimizations.length,
      approved: optimizations.filter(o => o.status === 'APPROVED').length,
      pending: optimizations.filter(o => o.status === 'PENDING_APPROVAL').length,
      rejected: optimizations.filter(o => o.status === 'REJECTED').length,
      testing: optimizations.filter(o => o.status === 'TESTING').length,
      active: optimizations.filter(o => o.status === 'ACTIVE').length,
      rolledBack: optimizations.filter(o => o.status === 'ROLLED_BACK').length,
      successful: optimizations.filter(o => o.wasSuccessful === true).length,
      avgConfidence: optimizations.length > 0
        ? optimizations.reduce((sum, o) => sum + o.confidenceScore, 0) / optimizations.length
        : 0
    };
    
    // Daily usage breakdown (last 7 days)
    const dailyUsage: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const log of usageLogs.filter(l => l.timestamp >= last7Days)) {
      const day = log.timestamp.toISOString().split('T')[0];
      
      if (!dailyUsage[day]) {
        dailyUsage[day] = { calls: 0, tokens: 0, cost: 0 };
      }
      
      const costPerM = MODEL_COSTS[log.model] || 0.35;
      const cost = (log.totalTokens / 1_000_000) * costPerM;
      
      dailyUsage[day].calls += 1;
      dailyUsage[day].tokens += log.totalTokens;
      dailyUsage[day].cost += cost;
    }
    
    // Recent logs (last 20)
    const recentLogs = usageLogs.slice(0, 20).map(log => ({
      id: log.id,
      model: log.model,
      tokens: log.totalTokens,
      duration: log.duration,
      success: log.success,
      timestamp: log.timestamp,
      cost: ((log.totalTokens / 1_000_000) * (MODEL_COSTS[log.model] || 0.35)).toFixed(4)
    }));
    
    return NextResponse.json({
      success: true,
      period,
      summary: {
        totalCalls,
        successfulCalls,
        failedCalls,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : '0',
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCost: totalCost.toFixed(2),
        avgDuration: Math.round(avgDuration),
        avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0
      },
      byModel: Object.entries(costByModel).map(([model, cost]) => ({
        model,
        calls: callsByModel[model],
        cost: cost.toFixed(2),
        avgCostPerCall: (cost / callsByModel[model]).toFixed(4)
      })).sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)),
      optimizations: optimizationStats,
      dailyUsage: Object.entries(dailyUsage)
        .map(([date, stats]) => ({
          date,
          ...stats,
          cost: parseFloat(stats.cost.toFixed(2))
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      recentLogs
    });
    
  } catch (error: any) {
    console.error('❌ Usage stats API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
