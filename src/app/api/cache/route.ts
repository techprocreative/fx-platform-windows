import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { marketDataCache } from '../../../lib/cache/market-data-cache';

// GET /api/cache - Get cache statistics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const stats = await marketDataCache.getStats();
    
    return NextResponse.json({
      success: true,
      cache: stats,
      available: marketDataCache.isAvailable(),
    });

  } catch (error) {
    console.error('Cache API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get cache statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cache - Clear cache
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'clear') {
      await marketDataCache.clear();
      
      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=clear' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Cache API DELETE error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
