/**
 * Pusher Debug/Test API
 * POST /api/debug/pusher-test
 * 
 * Manually send a test command to executor via Pusher
 * For debugging connection issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendCommandToExecutor } from '@/lib/realtime/pusher-service';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { executorId } = body;

    if (!executorId) {
      return NextResponse.json(
        { error: 'executorId is required' },
        { status: 400 }
      );
    }

    // Create a simple test command
    const testCommand = {
      id: `test_${Date.now()}`,
      type: 'GET_STATUS' as const,
      priority: 'NORMAL' as const,
      executorId,
      payload: {
        test: true,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        source: 'debug-api',
        userId: session.user.id,
        description: 'Manual test command',
      },
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };

    console.log('🧪 Sending test command:', {
      commandId: testCommand.id,
      executorId,
      channel: `private-executor-${executorId}`,
      event: 'command-received',
    });

    // Send command via Pusher
    const sent = await sendCommandToExecutor(executorId, testCommand);

    if (sent) {
      return NextResponse.json({
        success: true,
        message: 'Test command sent successfully',
        command: testCommand,
        details: {
          channel: `private-executor-${executorId}`,
          event: 'command-received',
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send command via Pusher',
        details: {
          pusherConfigured: process.env.PUSHER_APP_ID ? true : false,
          channel: `private-executor-${executorId}`,
        },
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error sending test command:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to send test command',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/debug/pusher-test
 * Check Pusher configuration status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pusherConfig = {
      configured: !!(
        process.env.PUSHER_APP_ID &&
        process.env.NEXT_PUBLIC_PUSHER_KEY &&
        process.env.PUSHER_SECRET &&
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER
      ),
      appId: process.env.PUSHER_APP_ID ? '✅ Set' : '❌ Missing',
      key: process.env.NEXT_PUBLIC_PUSHER_KEY ? '✅ Set' : '❌ Missing',
      secret: process.env.PUSHER_SECRET ? '✅ Set' : '❌ Missing',
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '❌ Missing',
    };

    return NextResponse.json({
      success: true,
      pusher: pusherConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error checking Pusher config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check Pusher config' },
      { status: 500 }
    );
  }
}
