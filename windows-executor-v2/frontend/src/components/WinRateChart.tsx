import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface WinRateChartProps {
  wins: number;
  losses: number;
}

export const WinRateChart = ({ wins, losses }: WinRateChartProps) => {
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

  const data = [
    { name: 'Wins', value: wins, color: '#22c55e' },
    { name: 'Losses', value: losses, color: '#ef4444' },
  ];

  const COLORS = ['#22c55e', '#ef4444'];

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', color: '#f1f5f9' }}>Win Rate</h3>

      {total === 0 ? (
        <div
          style={{
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
        >
          No trades yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  color: '#f1f5f9',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ color: '#cbd5e1' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div
            style={{
              textAlign: 'center',
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.5rem',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Overall Win Rate</div>
            <div style={{ color: '#3b82f6', fontSize: '2rem', fontWeight: 700 }}>{winRate}%</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {wins} wins / {losses} losses ({total} total)
            </div>
          </div>
        </>
      )}
    </div>
  );
};
