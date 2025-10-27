interface PerformanceMetricsProps {
  totalTrades: number;
  wins: number;
  losses: number;
  totalProfit: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  profitFactor: number;
}

export const PerformanceMetrics = ({
  totalTrades,
  wins,
  losses,
  totalProfit,
  avgWin,
  avgLoss,
  maxDrawdown,
  profitFactor,
}: PerformanceMetricsProps) => {
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

  const metrics = [
    { label: 'Total Trades', value: totalTrades.toString(), color: '#3b82f6' },
    { label: 'Win Rate', value: `${winRate}%`, color: '#22c55e' },
    { label: 'Total Profit', value: `$${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Avg Win', value: `$${avgWin.toFixed(2)}`, color: '#22c55e' },
    { label: 'Avg Loss', value: `$${Math.abs(avgLoss).toFixed(2)}`, color: '#ef4444' },
    { label: 'Profit Factor', value: profitFactor.toFixed(2), color: profitFactor >= 1.5 ? '#22c55e' : '#f59e0b' },
    { label: 'Max Drawdown', value: `$${Math.abs(maxDrawdown).toFixed(2)}`, color: '#ef4444' },
    {
      label: 'Risk/Reward',
      value: avgLoss !== 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : 'N/A',
      color: '#8b5cf6',
    },
  ];

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', color: '#f1f5f9' }}>Performance Metrics</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              padding: '1rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.75rem',
              borderLeft: `4px solid ${metric.color}`,
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{metric.label}</div>
            <div style={{ color: metric.color, fontSize: '1.5rem', fontWeight: 700 }}>{metric.value}</div>
          </div>
        ))}
      </div>

      {/* Performance Interpretation */}
      <div
        style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#0f172a',
          borderRadius: '0.75rem',
          borderLeft: '4px solid #3b82f6',
        }}
      >
        <div style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>
          <strong style={{ color: '#3b82f6' }}>Performance Analysis:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            <li>
              Win Rate of {winRate}% is {parseFloat(winRate) >= 60 ? 'excellent' : parseFloat(winRate) >= 50 ? 'good' : 'needs improvement'}
            </li>
            <li>
              Profit Factor of {profitFactor.toFixed(2)} is{' '}
              {profitFactor >= 2 ? 'excellent' : profitFactor >= 1.5 ? 'good' : profitFactor >= 1 ? 'acceptable' : 'poor'}
            </li>
            <li>
              Risk/Reward ratio should ideally be {'>'}1.5 for consistent profitability
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
