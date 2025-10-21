import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { applyRateLimit } from '@/lib/middleware/rate-limit-middleware';

export const dynamic = 'force-dynamic';

// Error report validation schema
const ErrorReportSchema = z.object({
  errorId: z.string(),
  message: z.string(),
  stack: z.string(),
  componentStack: z.string(),
  timestamp: z.string(),
  userAgent: z.string(),
  url: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for error reporting
    const rateLimitResponse = await applyRateLimit(request, 'api' as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const validation = ErrorReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid error report format' },
        { status: 400 }
      );
    }

    const errorReport = validation.data;

    // Log error to database
    await prisma.auditLog.create({
      data: {
        userId: errorReport.userId || 'anonymous',
        eventType: 'UI_ERROR',
        resource: 'frontend',
        action: 'error_boundary',
        result: 'error',
        metadata: {
          errorId: errorReport.errorId,
          message: errorReport.message,
          stack: errorReport.stack,
          componentStack: errorReport.componentStack,
          userAgent: errorReport.userAgent,
          url: errorReport.url,
          sessionId: errorReport.sessionId,
          timestamp: errorReport.timestamp,
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date(errorReport.timestamp),
      },
    });

    // Log to console for immediate visibility
    console.error(`🚨 UI Error Report [${errorReport.errorId}]:`, {
      message: errorReport.message,
      userId: errorReport.userId,
      url: errorReport.url,
      timestamp: errorReport.timestamp,
    });

    // In production, you could also send to external monitoring services
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      // await sendToMonitoringService(errorReport);
    }

    return NextResponse.json({
      success: true,
      errorId: errorReport.errorId,
      message: 'Error report received',
    });

  } catch (error) {
    console.error('Error reporting failed:', error);
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'api' as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // This endpoint could be used by admins to view error statistics
    // For now, return a simple status
    return NextResponse.json({
      message: 'Error reporting service is active',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return handleApiError(error);
  }
}