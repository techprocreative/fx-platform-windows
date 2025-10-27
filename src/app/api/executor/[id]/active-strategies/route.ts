import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/executor/[id]/active-strategies
 * This endpoint is used for recovery after executor restart
 * Returns strategies that were previously running on this executor
 * NOTE: Strategies are normally started via Pusher commands, not this endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executorId = params.id;

    console.log('[API] Fetching previously active strategies for executor recovery:', executorId);

    // Get strategies that have active assignments to this executor
    // This is only used for recovery - normal flow uses Pusher commands
    const activeAssignments = await prisma.strategyAssignment.findMany({
      where: {
        executorId,
        status: 'active',
      },
      include: {
        strategy: true
      }
    });

    console.log(`[API] Found ${activeAssignments.length} active assignments for executor ${executorId}`);

    // NOTE: In production, this should return empty array
    // Strategies should be started via explicit user commands only
    // This endpoint exists for future recovery mechanisms
    
    return NextResponse.json({
      success: true,
      strategies: [], // Return empty - strategies start via commands only
      count: 0,
      message: 'Strategies are started via Pusher commands from web platform'
    });

  } catch (error) {
    console.error('[API] Error in active-strategies endpoint:', error);
    
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
