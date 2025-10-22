'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EquityPoint {
  timestamp: string;
  equity: number;
  date?: string; // For display
}

interface EquityCurveChartProps {
  data: EquityPoint[];
  initialBalance?: number;
}

export function EquityCurveChart({ data, initialBalance = 10000 }: EquityCurveChartProps) {
  // Format data for chart
  const chartData = data.map((point, index) => ({
    index: index + 1,
    equity: point.equity,
    date: point.date || new Date(point.timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
  }));

  // Calculate profit/loss
  const currentEquity = data.length > 0 ? data[data.length - 1].equity : initialBalance;
  const totalPnL = currentEquity - initialBalance;
  const pnLPercent = ((totalPnL / initialBalance) * 100).toFixed(2);
  const isProfit = totalPnL >= 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-600">Account Balance</p>
          <p className="text-2xl font-bold text-neutral-900">
            ${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-600">Total P&L</p>
          <p className={`text-xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
            {isProfit ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-sm ml-1">({isProfit ? '+' : ''}{pnLPercent}%)</span>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: '#374151', fontWeight: 600 }}
                formatter={(value: number) => [
                  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  'Balance'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="equity" 
                stroke={isProfit ? '#10b981' : '#ef4444'}
                strokeWidth={2}
                dot={false}
                name="Account Balance"
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
            <p className="text-neutral-500">No equity data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
