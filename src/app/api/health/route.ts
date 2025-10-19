import { NextResponse } from 'next/server';

import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/prisma';
import { isRealtimeConfigured } from '@/lib/realtime/pusher-service';

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'healthy';
  } catch (error) {
    logger.error('Health check failed: Database', error as Error);
    return 'unhealthy';
  }
}

async function checkRedis() {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
      return 'not_configured';
    }

    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const { Redis } = await import('@upstash/redis');
      const client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await client.ping();
      return 'healthy';
    }

    if (process.env.REDIS_URL) {
      const redis = await import('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      await client.disconnect();
      return 'healthy';
    }

    return 'healthy';
  } catch (error) {
    logger.error('Health check failed: Redis', error as Error);
    return 'unhealthy';
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const pusher = isRealtimeConfigured() ? 'healthy' : 'not_configured';

  const checks = {
    database,
    redis,
    pusher,
    timestamp: new Date().toISOString(),
  } as const;

  const status = Object.values(checks).every(
    (value) => value === 'healthy' || value === 'not_configured'
  )
    ? 200
    : 503;

  return NextResponse.json(checks, { status });
}
