import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/executor/[id]/active-strategies
 * Get all active strategies assigned to this executor
 * Used by executor to sync state after restart
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executorId = params.id;

    console.log('[API] Fetching active strategies for executor:', executorId);

    // Find all active strategy assignments for this executor
    const activeAssignments = await prisma.strategyAssignment.findMany({
      where: {
        executorId,
        status: 'active',  // Fix: use 'status' field instead of 'isActive'
      },
      include: {
        strategy: true  // Include full strategy data
      }
    });

    console.log(`[API] Found ${activeAssignments.length} active strategies for executor ${executorId}`);

    // Transform to executor format
    const strategies = activeAssignments.map(assignment => {
      const strategy = assignment.strategy;
      const rules = strategy.rules as any || {};  // Strategy rules are stored in JSON field

      return {
        id: strategy.id,
        name: strategy.name,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        status: 'active',
        positionSize: rules.positionSize || assignment.settings?.positionSize || 0.01,
        
        // Entry conditions from strategy rules
        entryConditions: rules.entry?.conditions || rules.entryConditions || [],
        entryLogic: rules.entry?.logic || rules.entryLogic || 'AND',
        
        // Exit conditions from strategy rules
        stopLoss: rules.exit?.stopLoss || rules.stopLoss || { type: 'pips', value: 50 },
        takeProfit: rules.exit?.takeProfit || rules.takeProfit || { type: 'pips', value: 100 },
        trailingStop: rules.exit?.trailingStop || rules.trailingStop || null,
        
        // Risk management
        riskManagement: rules.riskManagement || {
          maxRiskPerTrade: 1,
          maxOpenPositions: 1,
          maxDailyLoss: 5
        },
        
        // Filters
        filters: {
          sessionFilter: rules.sessionFilter || null,
          correlationFilter: rules.correlationFilter || null,
        },
        
        // Metadata
        assignmentId: assignment.id,
        assignedAt: assignment.createdAt,
        settings: assignment.settings || {},
      };
    });

    return NextResponse.json({
      success: true,
      strategies,
      count: strategies.length
    });

  } catch (error) {
    console.error('[API] Error fetching active strategies:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch active strategies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
