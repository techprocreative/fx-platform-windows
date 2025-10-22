import { NextRequest, NextResponse } from "next/server";
import { clearSymbolCache } from "@/lib/cache/market-data-cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, interval } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    await clearSymbolCache(symbol, interval);

    return NextResponse.json({
      success: true,
      message: `Cache cleared for ${symbol}${interval ? ` ${interval}` : ' all intervals'}`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Cache clear endpoint. Use POST with symbol to clear cache.",
    usage: {
      method: "POST",
      body: {
        symbol: "XAUUSD", // required
        interval: "15min" // optional
      }
    }
  });
}