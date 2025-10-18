import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const strategyUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  rules: z.object({}).passthrough().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        trades: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            trades: true,
            backtests: true,
            versions: true,
          },
        },
      },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(strategy);
  } catch (error) {
    console.error('Strategy GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategy' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate input
    const validation = strategyUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Check ownership
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Create version if rules are being updated
    if (validation.data.rules) {
      await prisma.strategyVersion.create({
        data: {
          strategyId: params.id,
          version: strategy.version + 1,
          rules: strategy.rules as any,
          description: `Version ${strategy.version} snapshot`,
        },
      });
    }

    // Update strategy
    const updated = await prisma.strategy.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        version: validation.data.rules ? strategy.version + 1 : strategy.version,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'STRATEGY_UPDATED',
        metadata: {
          strategyId: params.id,
          changes: Object.keys(validation.data),
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Strategy PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ownership
    const strategy = await prisma.strategy.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Soft delete
    await prisma.strategy.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        eventType: 'STRATEGY_DELETED',
        metadata: {
          strategyId: params.id,
          name: strategy.name,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Strategy DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}
