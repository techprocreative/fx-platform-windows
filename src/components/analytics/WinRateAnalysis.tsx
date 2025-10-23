'use client';

import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { PerformanceMetrics } from '@/types';
import { Target, TrendingUp, Calendar, Clock } from 'lucide-react';

interface WinRateAnalysisProps {
  metrics: PerformanceMetrics;
  monthlyData?: Array<{ month: string; winRate: number; trades: number }>;
  tradesByDay?: Record<string, { wins: number; total: number }>;
  tradesByHour?: Record<string, { wins: number; total: number }>;
  className?: string;
}

export function WinRateAnalysis({ 
  metrics, 
  monthlyData = [], 
  tradesByDay = {},
  tradesByHour = {},
  className = '' 
}: WinRateAnalysisProps) {
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Prepare data for win rate by month chart
  const monthlyWinRateData = monthlyData.map(item => ({
    month: item.month,
    winRate: item.winRate,
    trades: item.trades,
    profitable: item.winRate >= 50
  }));

  // Prepare data for win rate by day of week
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const winRateByDay = dayOrder.map(day => {
    const dayData = tradesByDay[day] || { wins: 0, total: 0 };
    const winRate = dayData.total > 0 ? (dayData.wins / dayData.total) * 100 : 0;
    
    return {
      day: day.slice(0, 3),
      winRate,
      trades: dayData.total,
      profitable: winRate >= 50
    };
  });

  // Prepare data for win rate by hour
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hourData = tradesByHour[i.toString()] || { wins: 0, total: 0 };
    const winRate = hourData.total > 0 ? (hourData.wins / hourData.total) * 100 : 0;
    
    return {
      hour: `${i.toString().padStart(2, '0')}:00`,
      winRate,
      trades: hourData.total,
      profitable: winRate >= 50
    };
  });

  // Prepare data for win rate distribution pie chart
  const winRateDistribution = [
    { name: 'Excellent (70%+)', value: 0, color: '#10b981' },
    { name: 'Good (60-70%)', value: 0, color: '#3b82f6' },
    { name: 'Average (50-60%)', value: 0, color: '#f59e0b' },
    { name: 'Poor (40-50%)', value: 0, color: '#f97316' },
    { name: 'Very Poor (<40%)', value: 0, color: '#ef4444' }
  ];

  monthlyWinRateData.forEach(item => {
    if (item.winRate >= 70) winRateDistribution[0].value++;
    else if (item.winRate >= 60) winRateDistribution[1].value++;
    else if (item.winRate >= 50) winRateDistribution[2].value++;
    else if (item.winRate >= 40) winRateDistribution[3].value++;
    else winRateDistribution[4].value++;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900">{label}</p>
          <p className="text-sm font-medium" style={{ color: data.profitable ? '#10b981' : '#ef4444' }}>
            Win Rate: {formatPercent(data.winRate)}
          </p>
          <p className="text-xs text-neutral-500">
            Trades: {data.trades}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-neutral-900">{payload[0].name}</p>
          <p className="text-sm text-neutral-600">
            Months: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Win Rate Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Win Rate Overview</h3>
          <Target className="h-5 w-5 text-blue-500" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${metrics.winRate >= 60 ? 'text-green-600' : metrics.winRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercent(metrics.winRate)}
            </div>
            <div className="text-sm text-neutral-600">Overall Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-blue-600">
              {formatPercent(metrics.monthlyWinRate)}
            </div>
            <div className="text-sm text-neutral-600">Monthly Average</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-purple-600">
              {formatPercent(metrics.winRateStability)}
            </div>
            <div className="text-sm text-neutral-600">Stability Score</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-orange-600">
              {metrics.winningTrades}
            </div>
            <div className="text-sm text-neutral-600">Winning Trades</div>
          </div>
        </div>
      </Card>

      {/* Win Rate by Month */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Win Rate by Month
        </h3>
        <div className="h-80">
          {monthlyWinRateData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyWinRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="winRate" 
                  radius={[4, 4, 0, 0]}
                >
                  {monthlyWinRateData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.profitable ? '#10b981' : '#ef4444'}
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
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate by Day of Week */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Win Rate by Day
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winRateByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="winRate" 
                  radius={[4, 4, 0, 0]}
                >
                  {winRateByDay.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.profitable ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Win Rate Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Win Rate Distribution
          </h3>
          <div className="h-64">
            {monthlyWinRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winRateDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {winRateDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-neutral-50 rounded-lg">
                <p className="text-neutral-500">No distribution data available</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Win Rate by Hour */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Win Rate by Hour of Day
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="hour" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                interval={2}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="winRate" 
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Win Rate Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Win Rate Insights</h3>
        <div className="space-y-3">
          {metrics.winRate >= 70 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Excellent win rate! Your strategy is highly effective.</span>
            </div>
          )}
          
          {metrics.winRate >= 50 && metrics.winRate < 70 && (
            <div className="flex items-center gap-2 text-blue-700 bg-blue-50 p-3 rounded-lg">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Good win rate. Consider optimizing for higher consistency.</span>
            </div>
          )}
          
          {metrics.winRate < 50 && (
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Win rate below 50%. Review entry and exit criteria.</span>
            </div>
          )}
          
          {metrics.winRateStability >= 80 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Highly consistent performance across different periods.</span>
            </div>
          )}
          
          {metrics.winRateStability < 60 && (
            <div className="flex items-center gap-2 text-orange-700 bg-orange-50 p-3 rounded-lg">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Inconsistent performance. Focus on strategy refinement.</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}