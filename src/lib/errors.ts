import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { logger } from '@/lib/monitoring/logger';

export interface AppErrorMeta {
  requestId?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public meta?: AppErrorMeta
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown) {
  // Log error with structured logging
  if (error instanceof AppError) {
    logger.error('API Error', error, {
      code: error.code,
      statusCode: error.statusCode,
      meta: error.meta,
    });

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        meta: error.meta,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      errors: error.errors,
    });

    return NextResponse.json(
      {
        error: 'Validation error',
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // Unknown error - log with full details
  logger.error('Unexpected API error', error as Error, {
    type: typeof error,
  });

  return NextResponse.json(
    {
      error: 'Internal server error',
    },
    { status: 500 }
  );
}

export async function withErrorHandling<T>(callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    throw error instanceof Error ? error : new AppError(500, 'Unknown error');
  }
}
