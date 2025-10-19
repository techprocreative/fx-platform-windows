/**
 * WEBSOCKET API ENDPOINT
 * Initializes WebSocket server for executor communication
 * DO NOT DELETE - CRITICAL ARCHITECTURE COMPONENT
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWebSocketServer } from '../../../lib/websocket/server';
import { getExecutorManager } from '../../../lib/executors/manager';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

// Initialize WebSocket server on first request
let initialized = false;

function initializeWebSocketServer() {
  if (!initialized) {
    const port = parseInt(process.env.WS_PORT || '8080');
    getWebSocketServer(port);
    getExecutorManager();
    initialized = true;
    console.log(`WebSocket server initialized on port ${port}`);
  }
}

/**
 * GET /api/ws - Get WebSocket server status
 */
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

    // Initialize if needed
    initializeWebSocketServer();

    // Get server status
    const wsServer = getWebSocketServer();
    const executorManager = getExecutorManager();
    
    const connectedExecutors = wsServer.getConnectedExecutors();
    const allExecutors = await executorManager.getAllExecutors(session.user.id);

    return NextResponse.json({
      status: 'active',
      wsPort: process.env.WS_PORT || 8080,
      wsUrl: `ws://localhost:${process.env.WS_PORT || 8080}`,
      connectedExecutors: connectedExecutors.length,
      totalExecutors: allExecutors.length,
      executors: allExecutors.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        platform: e.platform,
        isConnected: connectedExecutors.some(c => c.executorId === e.id),
        lastHeartbeat: e.lastHeartbeat,
      })),
    });
  } catch (error) {
    console.error('WebSocket status error:', error);
    return NextResponse.json(
      { error: 'Failed to get WebSocket status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ws - Register new executor
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, platform, brokerServer, accountNumber } = body;

    if (!name || !platform) {
      return NextResponse.json(
        { error: 'Name and platform are required' },
        { status: 400 }
      );
    }

    // Initialize if needed
    initializeWebSocketServer();

    // Register executor
    const executorManager = getExecutorManager();
    const result = await executorManager.register({
      name,
      platform,
      userId: session.user.id,
      brokerServer,
      accountNumber,
    });

    return NextResponse.json({
      success: true,
      executor: {
        id: result.executor.id,
        name: result.executor.name,
        platform: result.executor.platform,
        apiKey: result.apiKey,
        secretKey: result.secretKey, // Return ONCE to user
      },
      wsUrl: `ws://localhost:${process.env.WS_PORT || 8080}`,
      message: 'Save the secretKey securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Executor registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register executor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ws - Remove executor
 */
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
    const executorId = searchParams.get('executorId');

    if (!executorId) {
      return NextResponse.json(
        { error: 'Executor ID is required' },
        { status: 400 }
      );
    }

    // Initialize if needed
    initializeWebSocketServer();

    // Remove executor
    const executorManager = getExecutorManager();
    const success = await executorManager.remove(executorId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove executor. Check for active positions.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Executor removed successfully',
    });
  } catch (error) {
    console.error('Executor removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove executor' },
      { status: 500 }
    );
  }
}
