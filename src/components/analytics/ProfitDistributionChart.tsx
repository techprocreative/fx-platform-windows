'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface StrategyPerformance {
  strategyId: string;
  name: string;
  profit: number;
  winRate: number;
  trades: number;
}

interface ProfitDistributionChartProps {
  data: StrategyPerformance[];
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export function ProfitDistributionChart({ data }: ProfitDistributionChartProps) {
  // Filter out strategies with zero or negative profit for the pie chart
  const profitableStrategies = data.filter(s => s.profit > 0);
  
  // Calculate total profit
  const totalProfit = profitableStrategies.reduce((sum, s) => sum + s.profit, 0);
  
  // Format data for pie chart
  const chartData = profitableStrategies.map(strategy => ({
    name: strategy.name,
    value: strategy.profit,
    percentage: totalProfit > 0 ? ((strategy.profit / totalProfit) * 100).toFixed(1) : 0,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900">{payload[0].name}</p>
          <p className="text-sm text-green-600">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-neutral-500">
            {payload[0].payload.percentage}% of total profit
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-neutral-600">Total Profit</p>
          <p className="text-xl font-bold text-green-600">
            ${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-sm text-neutral-600">Profitable Strategies</p>
          <p className="text-xl font-bold text-neutral-900">
            {profitableStrategies.length}/{data.length}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-sm">
                    {value} (${entry.payload.value.toFixed(0)})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
            <p className="text-neutral-500">No profitable strategies yet</p>
          </div>
        )}
      </div>

      {/* Legend / List */}
      {chartData.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Strategy Breakdown</p>
          <div className="space-y-1">
            {chartData.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-neutral-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-600 font-medium">
                    ${item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-neutral-500">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
