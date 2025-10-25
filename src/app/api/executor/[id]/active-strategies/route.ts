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
        isActive: true,
      },
      include: {
        strategy: {
          include: {
            rules: true,
          }
        }
      }
    });

    console.log(`[API] Found ${activeAssignments.length} active strategies for executor ${executorId}`);

    // Transform to executor format
    const strategies = activeAssignments.map(assignment => {
      const strategy = assignment.strategy;
      const rules = strategy.rules;

      return {
        id: strategy.id,
        name: strategy.name,
        symbol: strategy.symbol,
        timeframe: strategy.timeframe,
        status: 'active',
        positionSize: strategy.lotSize || 0.01,
        
        // Entry conditions
        entryConditions: rules?.entry ? 
          (typeof rules.entry === 'string' ? JSON.parse(rules.entry) : rules.entry) 
          : [],
        entryLogic: rules?.entryLogic || 'AND',
        
        // Exit conditions  
        stopLoss: rules?.exit?.stopLoss || { type: 'pips', value: 50 },
        takeProfit: rules?.exit?.takeProfit || { type: 'pips', value: 100 },
        
        // Filters
        filters: {
          sessionFilter: rules?.sessionFilter || null,
          correlationFilter: rules?.correlationFilter || null,
        },
        
        // Metadata
        assignmentId: assignment.id,
        assignedAt: assignment.assignedAt,
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
