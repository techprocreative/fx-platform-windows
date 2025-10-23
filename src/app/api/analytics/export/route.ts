import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { performanceProcessor } from '@/lib/analytics/performance-processor';
import { adaptTradesFromDB, filterClosedTrades } from '@/lib/analytics/adapters';
import { AnalyticsExportOptions, StrategyPerformanceData, TimeFrame } from '@/types';
// Note: These imports would need to be installed as dependencies
// For now, we'll implement a simpler version without external libraries
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import { Workbook } from 'exceljs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { format, timeframe, filters, includeCharts = true, includeRawData = false } = body;

    if (!format || !timeframe) {
      return NextResponse.json({ 
        error: 'Missing required parameters: format, timeframe' 
      }, { status: 400 });
    }

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ALL':
        startDate = new Date(0);
        break;
    }

    // Build filters
    const analyticsFilters = {
      timeFrame: timeframe as TimeFrame,
      strategies: filters?.strategies || [],
      symbols: filters?.symbols || [],
      dateRange: {
        start: startDate,
        end: now
      }
    };

    // Fetch trades from database
    const dbTrades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        openTime: {
          gte: startDate,
        },
        closeTime: {
          not: null,
        },
        ...(filters?.strategies?.length && { strategyId: { in: filters.strategies } }),
        ...(filters?.symbols?.length && { symbol: { in: filters.symbols } }),
      },
      orderBy: { openTime: 'asc' },
    });

    // Convert to analytics trades
    const analyticsTrades = adaptTradesFromDB(dbTrades);
    const closedTrades = filterClosedTrades(analyticsTrades);

    if (closedTrades.length === 0) {
      return NextResponse.json({
        error: 'No trades found for the specified criteria'
      }, { status: 404 });
    }

    // Process performance data
    const performanceData = await performanceProcessor.processStrategyPerformance(
      closedTrades,
      'Export Report',
      analyticsFilters
    );

    // Generate report based on format
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        buffer = await generateCSVReport(performanceData, includeRawData);
        contentType = 'text/csv';
        filename = `analytics-report-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      // For now, only CSV is supported without external libraries
      // In a production environment, you would add pdf-lib and exceljs as dependencies
      case 'pdf':
        buffer = await generateCSVReport(performanceData, includeRawData);
        contentType = 'text/csv';
        filename = `analytics-report-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'excel':
        buffer = await generateCSVReport(performanceData, includeRawData);
        contentType = 'text/csv';
        filename = `analytics-report-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Analytics export API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to export analytics report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function generatePDFReport(
  performanceData: StrategyPerformanceData,
  includeCharts: boolean
): Promise<Buffer> {
  // For now, we'll generate a simple text-based report
  // In a production environment, you would use pdf-lib or similar
  return generateCSVReport(performanceData, false);
}

async function generateExcelReport(
  performanceData: StrategyPerformanceData,
  includeRawData: boolean
): Promise<Buffer> {
  // For now, we'll generate a CSV file instead of Excel
  // In a production environment, you would use exceljs or similar
  return generateCSVReport(performanceData, includeRawData);
}

async function generateCSVReport(
  performanceData: StrategyPerformanceData, 
  includeRawData: boolean
): Promise<Buffer> {
  let csv = '';
  
  // Header
  csv += 'Performance Analytics Report\n';
  csv += `Generated: ${new Date().toLocaleDateString()}\n`;
  csv += `Strategy: ${performanceData.strategyName}\n`;
  csv += `Period: ${performanceData.monthlyData[0]?.month || 'N/A'} - ${performanceData.monthlyData[performanceData.monthlyData.length - 1]?.month || 'N/A'}\n\n`;
  
  // Key Metrics
  csv += 'Key Performance Metrics\n';
  csv += 'Metric,Value\n';
  csv += `Total Trades,${performanceData.metrics.totalTrades}\n`;
  csv += `Winning Trades,${performanceData.metrics.winningTrades}\n`;
  csv += `Losing Trades,${performanceData.metrics.losingTrades}\n`;
  csv += `Win Rate (%),${performanceData.metrics.winRate}\n`;
  csv += `Total Profit ($),${performanceData.metrics.totalProfit}\n`;
  csv += `Profit Factor,${performanceData.metrics.profitFactor}\n`;
  csv += `Max Drawdown (%),${performanceData.metrics.maxDrawdownPercent}\n`;
  csv += `Sharpe Ratio,${performanceData.metrics.sharpeRatio}\n`;
  csv += `Sortino Ratio,${performanceData.metrics.sortinoRatio}\n`;
  csv += `Calmar Ratio,${performanceData.metrics.calmarRatio}\n`;
  csv += `Recovery Factor,${performanceData.metrics.recoveryFactor}\n`;
  csv += `VaR (95%) ($),${Math.abs(performanceData.metrics.var95)}\n`;
  csv += `CVaR (95%) ($),${Math.abs(performanceData.metrics.cvar95)}\n`;
  csv += `Risk of Ruin (%),${performanceData.metrics.riskOfRuin}\n\n`;
  
  // Strategy Score
  csv += 'Strategy Score\n';
  csv += 'Component,Score\n';
  csv += `Overall Score,${performanceData.score.overall}\n`;
  csv += `Profitability,${performanceData.score.profitability}\n`;
  csv += `Consistency,${performanceData.score.consistency}\n`;
  csv += `Risk-Adjusted,${performanceData.score.riskAdjusted}\n`;
  csv += `Drawdown Control,${performanceData.score.drawdown}\n\n`;
  
  // Monthly Performance
  csv += 'Monthly Performance\n';
  csv += 'Month,Profit ($),Trades,Win Rate (%),Max Drawdown (%),Sharpe Ratio,Profit Factor,Average Win ($),Average Loss ($)\n';
  
  performanceData.monthlyData.forEach(month => {
    csv += `${month.month},${month.profit},${month.trades},${month.winRate},${month.maxDrawdown},${month.sharpeRatio},${month.profitFactor},${month.averageWin},${month.averageLoss}\n`;
  });
  
  csv += '\n';
  
  // Symbol Performance
  csv += 'Symbol Performance\n';
  csv += 'Symbol,Trades,Win Rate (%),Profit ($),Profit Factor,Average Win ($),Average Loss ($),Sharpe Ratio,Max Drawdown (%)\n';
  
  performanceData.tradesBySymbol.forEach(symbol => {
    csv += `${symbol.symbol},${symbol.trades},${symbol.winRate},${symbol.profit},${symbol.profitFactor},${symbol.averageWin},${symbol.averageLoss},${symbol.sharpeRatio},${symbol.maxDrawdown}\n`;
  });
  
  csv += '\n';
  
  // Recommendations
  csv += 'Recommendations\n';
  performanceData.score.recommendations.forEach(rec => {
    csv += `"${rec}"\n`;
  });
  
  csv += '\n';
  
  // Warnings
  csv += 'Warnings\n';
  performanceData.score.warnings.forEach(warning => {
    csv += `"${warning}"\n`;
  });
  
  return Buffer.from(csv, 'utf-8');
}