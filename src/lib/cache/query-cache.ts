import { Prisma } from '@prisma/client';
import { revalidateTag, unstable_cache } from 'next/cache';

import { prisma } from '@/lib/prisma';

export const STRATEGY_LIST_INCLUDE = {
  trades: {
    select: {
      id: true,
      profit: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
  backtests: {
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  _count: {
    select: {
      trades: true,
      backtests: true,
    },
  },
} as const;

type StrategyWithRelations = Prisma.StrategyGetPayload<{
  include: typeof STRATEGY_LIST_INCLUDE;
}>;

type StrategyListCache = {
  strategies: StrategyWithRelations[];
  total: number;
};

const DEFAULT_LIMIT = 20;

export const getCachedStrategies = unstable_cache(
  async (userId: string): Promise<StrategyListCache> => {
    const where: Prisma.StrategyWhereInput = {
      userId,
      deletedAt: null,
    };

    const [strategies, total] = await Promise.all([
      prisma.strategy.findMany({
        where,
        take: DEFAULT_LIMIT,
        orderBy: { createdAt: 'desc' },
        include: STRATEGY_LIST_INCLUDE,
      }),
      prisma.strategy.count({ where }),
    ]);

    return {
      strategies,
      total,
    };
  },
  ['strategies'],
  {
    revalidate: 60,
    tags: ['strategies'],
  }
);

export function revalidateStrategiesCache() {
  revalidateTag('strategies');
}
