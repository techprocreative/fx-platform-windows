import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const CreateKeySchema = z.object({
  name: z.string().min(1),
  expiresInDays: z.number().min(1).max(730),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await prisma.aPIKey.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyHash: true,
        createdAt: true,
        lastUsed: true,
        expiresAt: true,
        permissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ keys: apiKeys });
  } catch (error) {
    console.error('API keys fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreateKeySchema.parse(body);

    const apiKey = `ntx_${crypto.randomBytes(32).toString('hex')}`;
    const secret = crypto.randomBytes(64).toString('hex');
    
    const keyHash = apiKey;
    const secretHash = await bcrypt.hash(secret, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);

    await prisma.aPIKey.create({
      data: {
        userId: session.user.id,
        name: validated.name,
        keyHash,
        secretHash,
        permissions: ['read:strategies', 'execute:trades'],
        expiresAt,
        rateLimit: 1000,
      },
    });

    return NextResponse.json({
      apiKey,
      secret,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    console.error('API key creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
    }

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== session.user.id) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    await prisma.aPIKey.update({
      where: { id: keyId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API key deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
