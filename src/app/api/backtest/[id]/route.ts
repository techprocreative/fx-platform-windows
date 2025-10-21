import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { AppError, handleApiError } from "@/lib/errors";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { applyRateLimit } from "@/lib/middleware/rate-limit-middleware";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new AppError(401, "Unauthorized");
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
      throw new AppError(404, "Backtest not found", "BACKTEST_NOT_FOUND");
    }

    return NextResponse.json(backtest);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await applyRateLimit(request, "api" as any);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(401, "Unauthorized");
    }

    // Find backtest
    const backtest = await prisma.backtest.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!backtest) {
      throw new AppError(404, "Backtest not found", "BACKTEST_NOT_FOUND");
    }

    // Check if backtest is still running
    if (backtest.status === "running") {
      throw new AppError(
        400,
        "Cannot delete a running backtest",
        "BACKTEST_RUNNING",
      );
    }

    // Delete the backtest
    await prisma.backtest.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Backtest deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
