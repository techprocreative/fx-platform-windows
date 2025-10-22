import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest/engine";

// Test endpoint yang bypass authentication untuk debugging
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 DEBUG BACKTEST - Starting test without authentication');
    
    const body = await request.json();
    const {
      symbol = 'XAUUSD',
      interval = '15min',
      startDate,
      endDate,
      initialBalance = 10000,
      preferredDataSource = 'twelvedata'
    } = body;

    // Validate required fields
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`🔍 DEBUG BACKTEST - Parameters:`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Interval: ${interval}`);
    console.log(`   Start Date: ${start.toISOString()}`);
    console.log(`   End Date: ${end.toISOString()}`);
    console.log(`   Days: ${daysDiff}`);
    console.log(`   Initial Balance: ${initialBalance}`);
    console.log(`   Data Source: ${preferredDataSource}`);

    // Create simple test strategy
    const testStrategy = {
      id: `debug_strategy_${Date.now()}`,
      name: 'Debug Test Strategy',
      symbol,
      rules: [
        {
          name: 'Test Entry',
          conditions: [
            {
              indicator: 'price',
              operator: 'gt',
              value: 0,
              timeframes: [interval],
            },
          ],
          action: {
            type: 'buy',
            parameters: { size: 0.01 },
          },
        },
        {
          name: 'Test Exit',
          conditions: [
            {
              indicator: 'price',
              operator: 'gt',
              value: 999999,
              timeframes: [interval],
            },
          ],
          action: {
            type: 'close',
            parameters: {},
          },
        },
      ],
      parameters: {
        stopLoss: 0.002,
        takeProfit: 0.004,
        maxPositions: 1,
        maxDailyLoss: 100,
      },
    };

    console.log(`🔍 DEBUG BACKTEST - Running backtest...`);
    
    // Run backtest
    const result = await runBacktest(testStrategy.id, {
      startDate: start,
      endDate: end,
      initialBalance,
      symbol,
      interval,
      strategy: testStrategy,
      preferredDataSource,
    });

    console.log(`✅ DEBUG BACKTEST - Completed successfully:`);
    console.log(`   Data Points: ${result.metadata.totalDataPoints}`);
    console.log(`   Total Trades: ${result.totalTrades}`);
    console.log(`   Return: ${result.returnPercentage.toFixed(2)}%`);
    console.log(`   Win Rate: ${result.winRate.toFixed(1)}%`);
    console.log(`   Max Drawdown: ${result.maxDrawdown.toFixed(1)}%`);

    return NextResponse.json({
      success: true,
      result,
      debug: {
        requestedDays: daysDiff,
        actualDays: Math.ceil((new Date(result.endDate).getTime() - new Date(result.startDate).getTime()) / (1000 * 60 * 60 * 24)),
        dataPoints: result.metadata.totalDataPoints,
        trades: result.totalTrades,
        return: result.returnPercentage,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
      }
    });

  } catch (error) {
    console.error('❌ DEBUG BACKTEST - Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Debug backtest endpoint. Use POST to run backtest without authentication.",
    usage: {
      method: "POST",
      body: {
        symbol: "XAUUSD", // optional
        interval: "15min", // optional
        startDate: "2024-09-01T00:00:00.000Z", // required
        endDate: "2024-10-01T00:00:00.000Z", // required
        initialBalance: 10000, // optional
        preferredDataSource: "twelvedata" // optional
      }
    }
  });
}