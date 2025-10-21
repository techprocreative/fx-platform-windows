/**
 * Report Generator
 * 
 * This module provides the ReportGenerator class for generating performance reports
 * in various formats including HTML and PDF. It includes chart generation for
 * performance visualization and report templates.
 */

import { 
  PerformanceReport, 
  ReportChart, 
  ChartDataPoint, 
  ChartConfig,
  ExportOptions,
  Trade
} from './types';

import { logger } from '../monitoring/logger';

export class ReportGenerator {
  /**
   * Generate HTML performance report
   */
  async generateHTMLReport(report: PerformanceReport): Promise<string> {
    try {
      logger.info('Generating HTML performance report', { reportId: report.reportId });
      
      const charts = await this.generateCharts(report);
      const reportWithCharts = { ...report, charts };
      
      const html = this.buildHTMLReport(reportWithCharts);
      
      logger.info('HTML report generated successfully', { reportId: report.reportId });
      return html;
    } catch (error) {
      logger.error('Error generating HTML report', error instanceof Error ? error : new Error(String(error)), { reportId: report.reportId });
      throw new Error(`Failed to generate HTML report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate PDF performance report
   */
  async generatePDFReport(report: PerformanceReport): Promise<Buffer> {
    try {
      logger.info('Generating PDF performance report', { reportId: report.reportId });
      
      // For now, we'll create a simple PDF generation using a basic approach
      // In a real implementation, you might use libraries like puppeteer or jsPDF
      
      const html = await this.generateHTMLReport(report);
      const pdfBuffer = await this.convertHTMLToPDF(html);
      
      logger.info('PDF report generated successfully', { reportId: report.reportId });
      return pdfBuffer;
    } catch (error) {
      logger.error('Error generating PDF report', error instanceof Error ? error : new Error(String(error)), { reportId: report.reportId });
      throw new Error(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate CSV export of trade data
   */
  async generateCSVExport(trades: Trade[]): Promise<string> {
    try {
      logger.info('Generating CSV export', { tradeCount: trades.length });
      
      const headers = [
        'ID', 'Strategy ID', 'Symbol', 'Direction', 'Entry Price', 'Exit Price',
        'Entry Time', 'Exit Time', 'Volume', 'Stop Loss', 'Take Profit',
        'Commission', 'Swap', 'Profit', 'Status', 'Tags'
      ];
      
      const csvRows = [
        headers.join(','),
        ...trades.map(trade => [
          trade.id,
          trade.strategyId,
          trade.symbol,
          trade.direction,
          trade.entryPrice,
          trade.exitPrice || '',
          trade.entryTime.toISOString(),
          trade.exitTime?.toISOString() || '',
          trade.volume,
          trade.stopLoss || '',
          trade.takeProfit || '',
          trade.commission,
          trade.swap,
          trade.profit,
          trade.status,
          trade.tags?.join(';') || ''
        ].map(field => `"${field}"`).join(','))
      ];
      
      const csv = csvRows.join('\n');
      
      logger.info('CSV export generated successfully', { tradeCount: trades.length });
      return csv;
    } catch (error) {
      logger.error('Error generating CSV export', error instanceof Error ? error : new Error(String(error)), { tradeCount: trades.length });
      throw new Error(`Failed to generate CSV export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate JSON export of performance report
   */
  async generateJSONExport(report: PerformanceReport): Promise<string> {
    try {
      logger.info('Generating JSON export', { reportId: report.reportId });
      
      const json = JSON.stringify(report, null, 2);
      
      logger.info('JSON export generated successfully', { reportId: report.reportId });
      return json;
    } catch (error) {
      logger.error('Error generating JSON export', error instanceof Error ? error : new Error(String(error)), { reportId: report.reportId });
      throw new Error(`Failed to generate JSON export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate all charts for a performance report
   */
  async generateCharts(report: PerformanceReport): Promise<ReportChart[]> {
    try {
      logger.info('Generating charts for performance report', { reportId: report.reportId });
      
      const charts: ReportChart[] = [];
      
      // Equity curve chart
      charts.push(this.generateEquityCurveChart(report));
      
      // Drawdown chart
      charts.push(this.generateDrawdownChart(report));
      
      // Monthly returns chart
      charts.push(this.generateMonthlyReturnsChart(report));
      
      // Profit distribution chart
      charts.push(this.generateProfitDistributionChart(report));
      
      // Trade distribution chart
      charts.push(this.generateTradeDistributionChart(report));
      
      logger.info('Charts generated successfully', { reportId: report.reportId, chartCount: charts.length });
      return charts;
    } catch (error) {
      logger.error('Error generating charts', error instanceof Error ? error : new Error(String(error)), { reportId: report.reportId });
      throw new Error(`Failed to generate charts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a customizable report with specific options
   */
  async generateCustomReport(
    report: PerformanceReport,
    options: ExportOptions
  ): Promise<string | Buffer> {
    try {
      logger.info('Generating custom report', { 
        reportId: report.reportId, 
        format: options.format,
        includeCharts: options.includeCharts,
        includeRawData: options.includeRawData
      });
      
      let result: string | Buffer;
      
      switch (options.format) {
        case 'HTML':
          result = await this.generateHTMLReport(report);
          break;
        case 'PDF':
          result = await this.generatePDFReport(report);
          break;
        case 'JSON':
          result = await this.generateJSONExport(report);
          break;
        case 'CSV':
          // For CSV, we need to extract trade data from the report
          // This is a simplified approach - in a real implementation, you'd pass the trades separately
          result = 'CSV export requires trade data';
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
      
      logger.info('Custom report generated successfully', { 
        reportId: report.reportId, 
        format: options.format 
      });
      
      return result;
    } catch (error) {
      logger.error('Error generating custom report', error instanceof Error ? error : new Error(String(error)), { 
        reportId: report.reportId, 
        format: options.format 
      });
      throw new Error(`Failed to generate custom report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private buildHTMLReport(report: PerformanceReport): string {
    const { summary, tradeMetrics, strategyMetrics, riskAdjustedReturns, drawdownAnalysis, charts } = report;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${report.strategyName}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .header p {
            color: #7f8c8d;
            font-size: 16px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #3498db;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            border-left: 4px solid #3498db;
        }
        .metric-card h3 {
            margin-top: 0;
            color: #2c3e50;
            font-size: 18px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .metric-label {
            color: #7f8c8d;
            font-size: 14px;
        }
        .positive {
            color: #27ae60;
        }
        .negative {
            color: #e74c3c;
        }
        .chart-container {
            margin: 20px 0;
            text-align: center;
        }
        .chart-placeholder {
            background-color: #f8f9fa;
            border: 1px dashed #bdc3c7;
            border-radius: 4px;
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #7f8c8d;
            font-style: italic;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .table th, .table td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }
        .table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        .table tr:hover {
            background-color: #f8f9fa;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #7f8c8d;
            font-size: 14px;
            border-top: 1px solid #e0e0e0;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Report</h1>
            <p><strong>Strategy:</strong> ${report.strategyName}</p>
            <p><strong>Period:</strong> ${report.periodStart.toLocaleDateString()} - ${report.periodEnd.toLocaleDateString()}</p>
            <p><strong>Generated:</strong> ${report.generatedAt.toLocaleDateString()}</p>
        </div>

        <div class="section">
            <h2>Performance Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Net Profit</h3>
                    <div class="metric-value ${summary.netProfit >= 0 ? 'positive' : 'negative'}">
                        $${summary.netProfit.toFixed(2)}
                    </div>
                    <div class="metric-label">${summary.netProfitPercent.toFixed(2)}%</div>
                </div>
                <div class="metric-card">
                    <h3>Total Trades</h3>
                    <div class="metric-value">${summary.totalTrades}</div>
                    <div class="metric-label">Win Rate: ${summary.winRate.toFixed(2)}%</div>
                </div>
                <div class="metric-card">
                    <h3>Profit Factor</h3>
                    <div class="metric-value">${summary.profitFactor.toFixed(2)}</div>
                    <div class="metric-label">Average Trade: $${summary.averageTrade.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Max Drawdown</h3>
                    <div class="metric-value negative">
                        ${summary.maxDrawdownPercent.toFixed(2)}%
                    </div>
                    <div class="metric-label">$${summary.maxDrawdown.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Sharpe Ratio</h3>
                    <div class="metric-value">${summary.sharpeRatio.toFixed(2)}</div>
                    <div class="metric-label">Risk-Adjusted Return</div>
                </div>
                <div class="metric-card">
                    <h3>Avg Holding Time</h3>
                    <div class="metric-value">${summary.averageHoldingTime.toFixed(1)}h</div>
                    <div class="metric-label">Average Duration</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Trade Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Winning Trades</h3>
                    <div class="metric-value">${tradeMetrics.winningTrades}</div>
                    <div class="metric-label">Average Win: $${tradeMetrics.averageWin.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Losing Trades</h3>
                    <div class="metric-value">${tradeMetrics.losingTrades}</div>
                    <div class="metric-label">Average Loss: $${tradeMetrics.averageLoss.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Largest Win</h3>
                    <div class="metric-value positive">
                        $${tradeMetrics.largestWin.toFixed(2)}
                    </div>
                    <div class="metric-label">Best Trade</div>
                </div>
                <div class="metric-card">
                    <h3>Largest Loss</h3>
                    <div class="metric-value negative">
                        $${tradeMetrics.largestLoss.toFixed(2)}
                    </div>
                    <div class="metric-label">Worst Trade</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Risk Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Sharpe Ratio</h3>
                    <div class="metric-value">${riskAdjustedReturns.sharpeRatio.toFixed(2)}</div>
                    <div class="metric-label">Risk-Adjusted Performance</div>
                </div>
                <div class="metric-card">
                    <h3>Sortino Ratio</h3>
                    <div class="metric-value">${riskAdjustedReturns.sortinoRatio.toFixed(2)}</div>
                    <div class="metric-label">Downside Risk Adjusted</div>
                </div>
                <div class="metric-card">
                    <h3>Calmar Ratio</h3>
                    <div class="metric-value">${riskAdjustedReturns.calmarRatio.toFixed(2)}</div>
                    <div class="metric-label">Return/Max Drawdown</div>
                </div>
                <div class="metric-card">
                    <h3>Value at Risk (95%)</h3>
                    <div class="metric-value">${(riskAdjustedReturns.var95! * 100).toFixed(2)}%</div>
                    <div class="metric-label">Daily Risk Estimate</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Drawdown Analysis</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Current Drawdown</h3>
                    <div class="metric-value negative">
                        ${drawdownAnalysis.currentDrawdownPercent.toFixed(2)}%
                    </div>
                    <div class="metric-label">$${drawdownAnalysis.currentDrawdown.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Max Drawdown</h3>
                    <div class="metric-value negative">
                        ${drawdownAnalysis.maxDrawdownPercent.toFixed(2)}%
                    </div>
                    <div class="metric-label">$${drawdownAnalysis.maxDrawdown.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <h3>Max DD Duration</h3>
                    <div class="metric-value">${drawdownAnalysis.maxDrawdownDuration.toFixed(0)}d</div>
                    <div class="metric-label">Days to Recover</div>
                </div>
                <div class="metric-card">
                    <h3>Recovery Factor</h3>
                    <div class="metric-value">${drawdownAnalysis.recoveryFactor.toFixed(2)}</div>
                    <div class="metric-label">Profit/Max DD</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Charts</h2>
            ${charts.map(chart => `
                <div class="chart-container">
                    <h3>${chart.title}</h3>
                    <div class="chart-placeholder">
                        ${chart.type} Chart - ${chart.data.length} data points
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Monthly Performance</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Return</th>
                        <th>Return %</th>
                        <th>Trades</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.monthlyBreakdown.map(month => `
                        <tr>
                            <td>${month.month}</td>
                            <td class="${month.return >= 0 ? 'positive' : 'negative'}">$${month.return.toFixed(2)}</td>
                            <td class="${month.return >= 0 ? 'positive' : 'negative'}">${month.returnPercent.toFixed(2)}%</td>
                            <td>${month.tradesCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Symbol Breakdown</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Trades</th>
                        <th>Win Rate</th>
                        <th>Net Profit</th>
                        <th>Profit Factor</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.symbolBreakdown.map(symbol => `
                        <tr>
                            <td>${symbol.symbol}</td>
                            <td>${symbol.tradesCount}</td>
                            <td>${symbol.winRate.toFixed(2)}%</td>
                            <td class="${symbol.netProfit >= 0 ? 'positive' : 'negative'}">$${symbol.netProfit.toFixed(2)}</td>
                            <td>${symbol.profitFactor.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Report generated on ${report.generatedAt.toLocaleString()} by FX Platform Performance Analytics</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateEquityCurveChart(report: PerformanceReport): ReportChart {
    // This is a simplified implementation
    // In a real implementation, you would calculate the equity curve from trade data
    const data: ChartDataPoint[] = [];
    
    // Generate sample data for demonstration
    const startDate = new Date(report.periodStart);
    const endDate = new Date(report.periodEnd);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let currentValue = 10000; // Starting equity
    for (let i = 0; i <= daysDiff; i += 5) { // Sample every 5 days
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      // Add some random variation based on the actual performance
      const change = (Math.random() - 0.3) * 100;
      currentValue += change;
      
      data.push({
        x: date.toISOString().substring(0, 10),
        y: currentValue
      });
    }
    
    return {
      type: 'EQUITY_CURVE',
      title: 'Equity Curve',
      data,
      config: {
        xAxisLabel: 'Date',
        yAxisLabel: 'Equity ($)',
        color: '#3498db',
        showGrid: true
      }
    };
  }

  private generateDrawdownChart(report: PerformanceReport): ReportChart {
    // This is a simplified implementation
    // In a real implementation, you would calculate drawdown from equity curve
    const data: ChartDataPoint[] = [];
    
    // Generate sample data for demonstration
    const startDate = new Date(report.periodStart);
    const endDate = new Date(report.periodEnd);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= daysDiff; i += 5) { // Sample every 5 days
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      // Generate some sample drawdown data
      const drawdown = Math.random() * report.drawdownAnalysis.maxDrawdownPercent;
      
      data.push({
        x: date.toISOString().substring(0, 10),
        y: drawdown
      });
    }
    
    return {
      type: 'DRAWDOWN',
      title: 'Drawdown Analysis',
      data,
      config: {
        xAxisLabel: 'Date',
        yAxisLabel: 'Drawdown (%)',
        color: '#e74c3c',
        showGrid: true
      }
    };
  }

  private generateMonthlyReturnsChart(report: PerformanceReport): ReportChart {
    const data: ChartDataPoint[] = report.monthlyBreakdown.map(month => ({
      x: month.month,
      y: month.returnPercent
    }));
    
    return {
      type: 'MONTHLY_RETURNS',
      title: 'Monthly Returns',
      data,
      config: {
        xAxisLabel: 'Month',
        yAxisLabel: 'Return (%)',
        color: '#3498db',
        showGrid: true
      }
    };
  }

  private generateProfitDistributionChart(report: PerformanceReport): ReportChart {
    // This is a simplified implementation
    // In a real implementation, you would analyze the distribution of trade profits
    const data: ChartDataPoint[] = [
      { x: '< -$100', y: Math.floor(Math.random() * 10) + 1 },
      { x: '-$100 to -$50', y: Math.floor(Math.random() * 15) + 5 },
      { x: '-$50 to $0', y: Math.floor(Math.random() * 20) + 10 },
      { x: '$0 to $50', y: Math.floor(Math.random() * 25) + 15 },
      { x: '$50 to $100', y: Math.floor(Math.random() * 20) + 10 },
      { x: '$100 to $200', y: Math.floor(Math.random() * 15) + 5 },
      { x: '> $200', y: Math.floor(Math.random() * 10) + 1 }
    ];
    
    return {
      type: 'PROFIT_DISTRIBUTION',
      title: 'Profit Distribution',
      data,
      config: {
        xAxisLabel: 'Profit Range',
        yAxisLabel: 'Number of Trades',
        color: '#3498db',
        showGrid: true
      }
    };
  }

  private generateTradeDistributionChart(report: PerformanceReport): ReportChart {
    // This is a simplified implementation
    // In a real implementation, you would analyze the distribution of trades by symbol or time
    const data: ChartDataPoint[] = report.symbolBreakdown.map(symbol => ({
      x: symbol.symbol,
      y: symbol.tradesCount
    }));
    
    return {
      type: 'TRADE_DISTRIBUTION',
      title: 'Trade Distribution by Symbol',
      data,
      config: {
        xAxisLabel: 'Symbol',
        yAxisLabel: 'Number of Trades',
        color: '#9b59b6',
        showGrid: true
      }
    };
  }

  private async convertHTMLToPDF(html: string): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real implementation, you would use a library like puppeteer or jsPDF
    // For now, we'll return a simple buffer with a message
    
    const message = `PDF generation is not fully implemented in this demo. 
    The HTML content would be converted to PDF using a library like Puppeteer.
    
    HTML length: ${html.length} characters`;
    
    return Buffer.from(message, 'utf-8');
  }
}