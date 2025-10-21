import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TradeParams } from "@/lib/risk/types";

interface TradeExecutionRequest {
  symbol: string;
  type: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  userId?: string;
}

// Mock trade execution - in a real implementation, this would connect to a broker API
async function executeTrade(request: TradeExecutionRequest): Promise<{
  success: boolean;
  ticket?: number;
  executionPrice?: number;
  executionTime?: number;
  error?: string;
}> {
  try {
    // Simulate trade execution delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 200),
    );

    // Simulate random success/failure (90% success rate)
    if (Math.random() > 0.1) {
      // Success case
      const ticket = Math.floor(Math.random() * 900000) + 100000;
      const executionPrice =
        request.entryPrice + (Math.random() - 0.5) * 0.0001;
      const executionTime = Math.floor(Math.random() * 150) + 50;

      return {
        success: true,
        ticket,
        executionPrice,
        executionTime,
      };
    } else {
      // Failure case
      const errors = [
        "INSUFFICIENT_MARGIN",
        "MARKET_CLOSED",
        "INVALID_SYMBOL",
        "PRICE_REJECTED",
        "NETWORK_ERROR",
      ];

      return {
        success: false,
        error: errors[Math.floor(Math.random() * errors.length)],
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown execution error",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tradeRequest: TradeExecutionRequest = body;

    // Validate required fields
    if (
      !tradeRequest.symbol ||
      !tradeRequest.type ||
      !tradeRequest.lotSize ||
      !tradeRequest.entryPrice
    ) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, type, lotSize, entryPrice" },
        { status: 400 },
      );
    }

    // Validate trade parameters
    if (tradeRequest.lotSize < 0.01 || tradeRequest.lotSize > 100) {
      return NextResponse.json(
        { error: "Invalid lot size. Must be between 0.01 and 100" },
        { status: 400 },
      );
    }

    if (tradeRequest.type !== "BUY" && tradeRequest.type !== "SELL") {
      return NextResponse.json(
        { error: "Invalid trade type. Must be BUY or SELL" },
        { status: 400 },
      );
    }

    // Set user ID from session if not provided
    if (!tradeRequest.userId) {
      tradeRequest.userId = session.user.id;
    }

    // Execute the trade
    const result = await executeTrade(tradeRequest);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          ticket: result.ticket,
          symbol: tradeRequest.symbol,
          type: tradeRequest.type,
          volume: tradeRequest.lotSize,
          openPrice: result.executionPrice,
          stopLoss: tradeRequest.stopLoss,
          takeProfit: tradeRequest.takeProfit,
          comment: tradeRequest.comment || "Manual trade",
          executionTime: result.executionTime,
          status: "FILLED",
          filledAt: new Date().toISOString(),
          userId: tradeRequest.userId,
        },
        timestamp: new Date().toISOString(),
        note: "This is mock execution. Implement real broker integration for production.",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: `Trade execution failed: ${result.error}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Trade execution API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute trade",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
