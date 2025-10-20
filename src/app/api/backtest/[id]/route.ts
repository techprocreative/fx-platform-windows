import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { AppError, handleApiError } from '@/lib/errors';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, 'Unauthorized');
    }

    const backtest = await prisma.backtest.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        strategy: {
          select: {
            id: true,
            name: true,
            symbol: true,
            timeframe: true,
            rules: true,
          },
        },
      },
    });

    if (!backtest) {
      throw new AppError(404, 'Backtest not found', 'BACKTEST_NOT_FOUND');
    }

    return NextResponse.json(backtest);
  } catch (error) {
    return handleApiError(error);
  }
}
