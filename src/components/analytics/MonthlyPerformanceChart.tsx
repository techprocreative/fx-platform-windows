'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

interface MonthlyData {
  month: string;
  profit: number;
  trades: number;
}

interface MonthlyPerformanceChartProps {
  data: MonthlyData[];
}

export function MonthlyPerformanceChart({ data }: MonthlyPerformanceChartProps) {
  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    profitFormatted: item.profit.toFixed(2),
  }));

  // Calculate stats
  const totalMonths = data.length;
  const profitableMonths = data.filter(m => m.profit > 0).length;
  const totalProfit = data.reduce((sum, m) => sum + m.profit, 0);
  const avgMonthlyProfit = totalMonths > 0 ? totalProfit / totalMonths : 0;
  const bestMonth = data.length > 0 
    ? data.reduce((best, current) => current.profit > best.profit ? current : best)
    : null;
  const worstMonth = data.length > 0
    ? data.reduce((worst, current) => current.profit < worst.profit ? current : worst)
    : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isProfit = data.profit >= 0;
      
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900">{data.month}</p>
          <p className={`text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
            {isProfit ? '+' : ''}${data.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-neutral-500">{data.trades} trades</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-neutral-600">Profitable Months</p>
          <p className="text-lg font-bold text-green-600">
            {profitableMonths}/{totalMonths}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-600">Avg Monthly</p>
          <p className={`text-lg font-bold ${avgMonthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${avgMonthlyProfit.toFixed(0)}
          </p>
        </div>
        {bestMonth && (
          <div>
            <p className="text-xs text-neutral-600">Best Month</p>
            <p className="text-lg font-bold text-green-600">
              ${bestMonth.profit.toFixed(0)}
            </p>
            <p className="text-xs text-neutral-500">{bestMonth.month}</p>
          </div>
        )}
        {worstMonth && (
          <div>
            <p className="text-xs text-neutral-600">Worst Month</p>
            <p className="text-lg font-bold text-red-600">
              ${worstMonth.profit.toFixed(0)}
            </p>
            <p className="text-xs text-neutral-500">{worstMonth.month}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
              <Bar 
                dataKey="profit" 
                name="Monthly Profit"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.profit >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
            <p className="text-neutral-500">No monthly data available</p>
          </div>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      {chartData.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-neutral-700 mb-2">Monthly Breakdown</p>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-neutral-700">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-700">Profit</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-700">Trades</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-700">Avg/Trade</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((item, index) => {
                  const avgPerTrade = item.trades > 0 ? item.profit / item.trades : 0;
                  const isProfit = item.profit >= 0;
                  
                  return (
                    <tr key={index} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-2 px-3 text-neutral-900">{item.month}</td>
                      <td className={`py-2 px-3 text-right font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}${item.profit.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-600">{item.trades}</td>
                      <td className={`py-2 px-3 text-right text-sm ${avgPerTrade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${avgPerTrade.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
