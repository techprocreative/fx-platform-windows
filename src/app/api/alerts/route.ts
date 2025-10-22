// API Route: GET/POST /api/alerts
// Alert management system

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/alerts - Get all alerts for user
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
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get alerts from audit logs (using existing table)
    const alerts = await prisma.auditLog.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { 
          metadata: {
            path: ['acknowledged'],
            equals: false
          }
        })
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Transform to alert format
    const transformedAlerts = alerts.map(log => ({
      id: log.id,
      type: determineAlertType(log.action),
      severity: determineSeverity(log.action),
      title: generateTitle(log.action, log.resource),
      message: log.details || `${log.action} on ${log.resource}`,
      timestamp: log.createdAt,
      acknowledged: (log.metadata as any)?.acknowledged || false,
      read: (log.metadata as any)?.read || false,
      source: log.resource,
      metadata: log.metadata
    }));

    // Get summary statistics
    const summary = {
      total: transformedAlerts.length,
      unread: transformedAlerts.filter(a => !a.read).length,
      critical: transformedAlerts.filter(a => a.severity === 'CRITICAL').length,
      high: transformedAlerts.filter(a => a.severity === 'HIGH').length,
      medium: transformedAlerts.filter(a => a.severity === 'MEDIUM').length,
      low: transformedAlerts.filter(a => a.severity === 'LOW').length
    };

    return NextResponse.json({
      success: true,
      alerts: transformedAlerts,
      summary
    });

  } catch (error: any) {
    console.error('❌ Get alerts API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/alerts - Create new alert
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, severity, title, message, source, metadata } = body;

    // Validation
    if (!type || !severity || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, severity, title, message' },
        { status: 400 }
      );
    }

    // Create alert using audit log
    const alert = await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `ALERT_${type.toUpperCase()}`,
        resource: source || 'SYSTEM',
        details: message,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          type,
          severity,
          title,
          acknowledged: false,
          read: false,
          ...metadata
        }
      }
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: alert.id,
        type,
        severity,
        title,
        message,
        timestamp: alert.createdAt,
        acknowledged: false,
        read: false,
        source,
        metadata: alert.metadata
      }
    });

  } catch (error: any) {
    console.error('❌ Create alert API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function determineAlertType(action: string): string {
  if (action.includes('TRADE')) return 'position';
  if (action.includes('RISK') || action.includes('MARGIN')) return 'risk';
  if (action.includes('SYSTEM') || action.includes('ERROR')) return 'system';
  if (action.includes('PRICE')) return 'price';
  if (action.includes('NEWS')) return 'news';
  return 'system';
}

function determineSeverity(action: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('critical') || actionLower.includes('emergency') || actionLower.includes('stop')) {
    return 'CRITICAL';
  }
  if (actionLower.includes('error') || actionLower.includes('fail') || actionLower.includes('violation')) {
    return 'HIGH';
  }
  if (actionLower.includes('warning') || actionLower.includes('alert')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function generateTitle(action: string, resource: string): string {
  const titles: Record<string, string> = {
    'TRADE_OPENED': 'New Trade Opened',
    'TRADE_CLOSED': 'Trade Closed',
    'STOP_LOSS_HIT': 'Stop Loss Triggered',
    'TAKE_PROFIT_HIT': 'Take Profit Reached',
    'MARGIN_CALL': 'Margin Call Warning',
    'EMERGENCY_STOP': 'Emergency Stop Activated',
    'STRATEGY_ACTIVATED': 'Strategy Activated',
    'STRATEGY_DEACTIVATED': 'Strategy Deactivated',
    'EXECUTOR_OFFLINE': 'Executor Disconnected',
    'EXECUTOR_ONLINE': 'Executor Connected',
    'RISK_VIOLATION': 'Risk Limit Exceeded',
    'PARAMETER_UPDATED': 'Parameters Updated'
  };

  return titles[action] || `${action.replace(/_/g, ' ')} - ${resource}`;
}
