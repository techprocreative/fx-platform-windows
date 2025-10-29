/**
 * POST /api/executor/[id]/supervisor/evaluate
 * Executor requests an LLM supervisor decision from the web platform
 *
 * Headers:
 *   - X-API-Key
 *   - X-API-Secret
 * Body:
 *   { context: {...}, policyVersion?: string, timeoutMs?: number }
 *
 * Response 200:
 *   { action: 'allow'|'deny'|'require_confirmation', reason: string, risks: string[], suggestions: string[], score?: number, mode: 'observe'|'enforce'|'off', policyVersion: string, ttlMs?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Redis as UpstashRedis } from '@upstash/redis';
import { prisma } from '@/lib/prisma';
import { callLLM } from '@/lib/llm/openrouter';
import { SYSTEM_PROMPTS } from '@/lib/llm/prompts';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  context: z.record(z.any()),
  policyVersion: z.string().optional(),
  timeoutMs: z.number().int().positive().max(10000).optional(),
});

const DecisionSchema = z.object({
  action: z.enum(['allow', 'deny', 'require_confirmation']).default('allow'),
  reason: z.string().default(''),
  risks: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  score: z.number().min(0).max(1).optional(),
  ttlMs: z.number().int().positive().optional(),
  mode: z.enum(['observe', 'enforce', 'off']).optional(),
});

const redis = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const apiSecret = req.headers.get('x-api-secret');
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 401 });
    }

    // Bind credentials to executor id
    const executor = await prisma.executor.findFirst({
      where: { id: params.id, apiKey, deletedAt: null },
      select: { id: true, userId: true, apiSecretHash: true },
    });
    if (!executor) {
      return NextResponse.json({ error: 'Executor not found' }, { status: 404 });
    }
    const ok = await bcrypt.compare(apiSecret, executor.apiSecretHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Rate limit per executor
    const rlKey = `executor:${executor.id}:supervisor:rate`;
    const windowMs = 60_000;
    const maxReq = 20;
    const now = Date.now();
    const bucket = await redis.get<string>(rlKey);
    let count = 0;
    let start = now;
    if (bucket) {
      const [cStr, tsStr] = bucket.split(':');
      count = Number(cStr);
      start = Number(tsStr);
    }
    if (now - start > windowMs) {
      count = 0;
      start = now;
    }
    if (count >= maxReq) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    await redis.set(rlKey, `${count + 1}:${start}`, { ex: Math.ceil(windowMs / 1000) });

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { context, policyVersion, timeoutMs } = parsed.data;

    // Cache key from context (shallow)
    const cacheKey = `executor:${executor.id}:supervisor:ctx:${Buffer.from(JSON.stringify(context)).toString('base64').slice(0, 200)}`;
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...JSON.parse(cached), cached: true }, { status: 200 });
    }

    // Call production LLM supervisor via OpenRouter (quality tier)
    const prompt = `You are a trading risk supervisor. Evaluate whether the executor should execute a trade.
Return JSON with keys: action (allow|deny|require_confirmation), reason, risks (array), suggestions (array), score (0-1), ttlMs (milliseconds).
Context: ${JSON.stringify({ context, policyVersion: policyVersion ?? 'v1', executorId: executor.id })}`;

    let decisionJson: any;
    try {
      decisionJson = await callLLM(prompt, 'quick', SYSTEM_PROMPTS.SUPERVISOR, 0.15);
    } catch (error) {
      console.error('LLM supervisor error:', error);
      decisionJson = {
        action: 'allow',
        reason: 'Supervisor unavailable, defaulting to observe mode',
        risks: ['supervisor_unavailable'],
        suggestions: ['Proceed with standard safeguards'],
        score: 0.5,
        ttlMs: 2000,
      };
    }

    const parsedDecision = DecisionSchema.safeParse(decisionJson);
    if (!parsedDecision.success) {
      console.warn('LLM supervisor returned invalid schema, defaulting to allow');
      decisionJson = {
        action: 'allow',
        reason: 'Invalid LLM response parsed',
        risks: ['invalid_llm_response'],
        suggestions: ['Proceed cautiously'],
        score: 0.5,
        ttlMs: 2000,
      };
    } else {
      decisionJson = parsedDecision.data;
    }

    const decision = {
      ...decisionJson,
      mode: decisionJson.mode || 'observe',
      policyVersion: policyVersion || 'v1',
      ttlMs: decisionJson.ttlMs ?? 5000,
    };

    await redis.set(cacheKey, JSON.stringify(decision), { ex: Math.ceil(decision.ttlMs / 1000) });
    return NextResponse.json(decision, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
