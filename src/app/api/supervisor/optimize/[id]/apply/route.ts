// API Route: POST /api/supervisor/optimize/[id]/apply
// Apply approved optimization

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LLMSupervisor } from '@/lib/supervisor/llm-supervisor';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const optimizationId = params.id;
    
    // Verify optimization ownership
    const optimization = await prisma.parameterOptimization.findFirst({
      where: {
        id: optimizationId,
        userId: session.user.id
      }
    });
    
    if (!optimization) {
      return NextResponse.json(
        { error: 'Optimization not found or access denied' },
        { status: 404 }
      );
    }
    
    // Check if already applied
    if (optimization.status === 'TESTING' || optimization.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Optimization already applied' },
        { status: 400 }
      );
    }
    
    // Apply optimization
    await LLMSupervisor.applyOptimization(optimizationId);
    
    return NextResponse.json({
      success: true,
      message: 'Optimization applied successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Apply optimization API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
