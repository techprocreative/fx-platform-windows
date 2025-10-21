import { formatInUserTimezone } from './timezone';

// Export format types
export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

// Trade data interface
export interface TradeData {
  id: string;
  ticket: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openTime: string;
  openPrice: number;
  closeTime?: string;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
  swap?: number;
  profit?: number;
  netProfit?: number;
  pips?: number;
  magicNumber?: number;
  comment?: string;
}

// Backtest results interface
export interface BacktestResults {
  id: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  dateFrom: string;
  dateTo: string;
  initialBalance: number;
  finalBalance?: number;
  totalReturn?: number;
  returnPercentage?: number;
  maxDrawdown?: number;
  maxDrawdownPercentage?: number;
  winRate?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  averageWin?: number;
  averageLoss?: number;
  profitFactor?: number;
  sharpeRatio?: number;
  trades: TradeData[];
  equityCurve?: {
    timestamp: string;
    balance: number;
    equity: number;
  }[];
}

// CSV export
export function exportToCSV(data: TradeData[], filename: string): void {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Define CSV headers
  const headers = [
    'Ticket',
    'Symbol',
    'Type',
    'Lots',
    'Open Time',
    'Open Price',
    'Close Time',
    'Close Price',
    'Stop Loss',
    'Take Profit',
    'Commission',
    'Swap',
    'Profit',
    'Net Profit',
    'Pips',
    'Magic Number',
    'Comment'
  ];

  // Convert data to CSV rows
  const rows = data.map(trade => [
    trade.ticket,
    trade.symbol,
    trade.type,
    trade.lots.toString(),
    formatInUserTimezone.datetime(trade.openTime),
    trade.openPrice.toString(),
    trade.closeTime ? formatInUserTimezone.datetime(trade.closeTime) : '',
    trade.closePrice?.toString() || '',
    trade.stopLoss?.toString() || '',
    trade.takeProfit?.toString() || '',
    trade.commission?.toString() || '',
    trade.swap?.toString() || '',
    trade.profit?.toString() || '',
    trade.netProfit?.toString() || '',
    trade.pips?.toString() || '',
    trade.magicNumber?.toString() || '',
    trade.comment || ''
  ]);

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create and trigger download
  downloadFile(csvContent, filename, 'text/csv');
}

// JSON export
export function exportToJSON(data: BacktestResults, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

// Excel export (simplified CSV format that can be opened in Excel)
export function exportToExcel(data: BacktestResults, filename: string): void {
  // Create summary sheet
  const summaryHeaders = ['Metric', 'Value'];
  const summaryRows = [
    ['Strategy Name', data.strategyName],
    ['Symbol', data.symbol],
    ['Timeframe', data.timeframe],
    ['Date From', formatInUserTimezone.date(data.dateFrom)],
    ['Date To', formatInUserTimezone.date(data.dateTo)],
    ['Initial Balance', data.initialBalance.toString()],
    ['Final Balance', data.finalBalance?.toString() || ''],
    ['Total Return', data.totalReturn?.toString() || ''],
    ['Return %', data.returnPercentage?.toFixed(2) + '%' || ''],
    ['Max Drawdown', data.maxDrawdown?.toString() || ''],
    ['Max Drawdown %', data.maxDrawdownPercentage?.toFixed(2) + '%' || ''],
    ['Win Rate', data.winRate?.toFixed(2) + '%' || ''],
    ['Total Trades', data.totalTrades?.toString() || ''],
    ['Winning Trades', data.winningTrades?.toString() || ''],
    ['Losing Trades', data.losingTrades?.toString() || ''],
    ['Average Win', data.averageWin?.toString() || ''],
    ['Average Loss', data.averageLoss?.toString() || ''],
    ['Profit Factor', data.profitFactor?.toString() || ''],
    ['Sharpe Ratio', data.sharpeRatio?.toString() || '']
  ];

  // Create trades sheet
  const tradesHeaders = [
    'Ticket',
    'Symbol',
    'Type',
    'Lots',
    'Open Time',
    'Open Price',
    'Close Time',
    'Close Price',
    'Stop Loss',
    'Take Profit',
    'Commission',
    'Swap',
    'Profit',
    'Net Profit',
    'Pips',
    'Magic Number',
    'Comment'
  ];

  const tradesRows = data.trades.map(trade => [
    trade.ticket,
    trade.symbol,
    trade.type,
    trade.lots.toString(),
    formatInUserTimezone.datetime(trade.openTime),
    trade.openPrice.toString(),
    trade.closeTime ? formatInUserTimezone.datetime(trade.closeTime) : '',
    trade.closePrice?.toString() || '',
    trade.stopLoss?.toString() || '',
    trade.takeProfit?.toString() || '',
    trade.commission?.toString() || '',
    trade.swap?.toString() || '',
    trade.profit?.toString() || '',
    trade.netProfit?.toString() || '',
    trade.pips?.toString() || '',
    trade.magicNumber?.toString() || '',
    trade.comment || ''
  ]);

  // Create Excel-compatible CSV content (with sheet separators)
  const excelContent = [
    '# Summary Sheet',
    summaryHeaders.join(','),
    ...summaryRows.map(row => row.map(cell => `"${cell}"`).join(',')),
    '',
    '# Trades Sheet',
    tradesHeaders.join(','),
    ...tradesRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadFile(excelContent, filename, 'text/csv');
}

// PDF export (simplified HTML-based approach)
export function exportToPDF(data: BacktestResults, filename: string): void {
  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Backtest Results - ${data.strategyName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        h2 { color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { margin-bottom: 30px; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .metric-name { font-weight: bold; }
        .positive { color: green; }
        .negative { color: red; }
      </style>
    </head>
    <body>
      <h1>Backtest Results</h1>
      
      <div class="summary">
        <h2>Strategy Information</h2>
        <div class="metric"><span class="metric-name">Strategy Name:</span> ${data.strategyName}</div>
        <div class="metric"><span class="metric-name">Symbol:</span> ${data.symbol}</div>
        <div class="metric"><span class="metric-name">Timeframe:</span> ${data.timeframe}</div>
        <div class="metric"><span class="metric-name">Date From:</span> ${formatInUserTimezone.date(data.dateFrom)}</div>
        <div class="metric"><span class="metric-name">Date To:</span> ${formatInUserTimezone.date(data.dateTo)}</div>
      </div>
      
      <div class="summary">
        <h2>Performance Metrics</h2>
        <div class="metric"><span class="metric-name">Initial Balance:</span> ${data.initialBalance}</div>
        <div class="metric"><span class="metric-name">Final Balance:</span> ${data.finalBalance || ''}</div>
        <div class="metric"><span class="metric-name">Total Return:</span> ${data.totalReturn || ''}</div>
        <div class="metric"><span class="metric-name">Return %:</span> <span class="${data.returnPercentage && data.returnPercentage >= 0 ? 'positive' : 'negative'}">${data.returnPercentage?.toFixed(2) || ''}%</span></div>
        <div class="metric"><span class="metric-name">Max Drawdown:</span> ${data.maxDrawdown || ''}</div>
        <div class="metric"><span class="metric-name">Max Drawdown %:</span> <span class="negative">${data.maxDrawdownPercentage?.toFixed(2) || ''}%</span></div>
        <div class="metric"><span class="metric-name">Win Rate:</span> ${data.winRate?.toFixed(2) || ''}%</div>
        <div class="metric"><span class="metric-name">Total Trades:</span> ${data.totalTrades || ''}</div>
        <div class="metric"><span class="metric-name">Winning Trades:</span> ${data.winningTrades || ''}</div>
        <div class="metric"><span class="metric-name">Losing Trades:</span> ${data.losingTrades || ''}</div>
        <div class="metric"><span class="metric-name">Average Win:</span> ${data.averageWin || ''}</div>
        <div class="metric"><span class="metric-name">Average Loss:</span> ${data.averageLoss || ''}</div>
        <div class="metric"><span class="metric-name">Profit Factor:</span> ${data.profitFactor || ''}</div>
        <div class="metric"><span class="metric-name">Sharpe Ratio:</span> ${data.sharpeRatio || ''}</div>
      </div>
      
      <h2>Trade History</h2>
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Lots</th>
            <th>Open Time</th>
            <th>Open Price</th>
            <th>Close Time</th>
            <th>Close Price</th>
            <th>Profit</th>
            <th>Net Profit</th>
            <th>Pips</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          ${data.trades.map(trade => `
            <tr>
              <td>${trade.ticket}</td>
              <td>${trade.symbol}</td>
              <td>${trade.type}</td>
              <td>${trade.lots}</td>
              <td>${formatInUserTimezone.datetime(trade.openTime)}</td>
              <td>${trade.openPrice}</td>
              <td>${trade.closeTime ? formatInUserTimezone.datetime(trade.closeTime) : ''}</td>
              <td>${trade.closePrice || ''}</td>
              <td class="${trade.profit && trade.profit >= 0 ? 'positive' : 'negative'}">${trade.profit || ''}</td>
              <td class="${trade.netProfit && trade.netProfit >= 0 ? 'positive' : 'negative'}">${trade.netProfit || ''}</td>
              <td>${trade.pips || ''}</td>
              <td>${trade.comment || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Create a blob and download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper function to download files
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Main export function
export function exportBacktestResults(
  data: BacktestResults,
  format: ExportFormat,
  filename?: string
): void {
  const baseFilename = filename || `${data.strategyName}_${data.symbol}_${data.timeframe}_backtest`;
  
  switch (format) {
    case 'csv':
      exportToCSV(data.trades, `${baseFilename}.csv`);
      break;
    case 'json':
      exportToJSON(data, `${baseFilename}.json`);
      break;
    case 'excel':
      exportToExcel(data, `${baseFilename}.csv`);
      break;
    case 'pdf':
      exportToPDF(data, `${baseFilename}.html`);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Server-side export utilities (for API routes)
export function generateCSVResponse(data: TradeData[]): Response {
  if (!data || data.length === 0) {
    return new Response('No data to export', { status: 400 });
  }

  const headers = [
    'Ticket', 'Symbol', 'Type', 'Lots', 'Open Time', 'Open Price',
    'Close Time', 'Close Price', 'Stop Loss', 'Take Profit',
    'Commission', 'Swap', 'Profit', 'Net Profit', 'Pips',
    'Magic Number', 'Comment'
  ];

  const rows = data.map(trade => [
    trade.ticket, trade.symbol, trade.type, trade.lots.toString(),
    trade.openTime, trade.openPrice.toString(),
    trade.closeTime || '', trade.closePrice?.toString() || '',
    trade.stopLoss?.toString() || '', trade.takeProfit?.toString() || '',
    trade.commission?.toString() || '', trade.swap?.toString() || '',
    trade.profit?.toString() || '', trade.netProfit?.toString() || '',
    trade.pips?.toString() || '', trade.magicNumber?.toString() || '',
    trade.comment || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="backtest_results.csv"',
    },
  });
}

export function generateJSONResponse(data: BacktestResults): Response {
  const jsonContent = JSON.stringify(data, null, 2);
  
  return new Response(jsonContent, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="backtest_results.json"',
    },
  });
}