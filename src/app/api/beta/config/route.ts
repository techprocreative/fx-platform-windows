import { NextResponse } from 'next/server';
import { BETA_CONFIG } from '@/config/beta.config';

/**
 * GET /api/beta/config
 * Returns current beta configuration (public endpoint)
 */
export async function GET() {
  return NextResponse.json({
    enabled: BETA_CONFIG.enabled,
    limits: BETA_CONFIG.enabled ? BETA_CONFIG.limits : null,
  });
}
