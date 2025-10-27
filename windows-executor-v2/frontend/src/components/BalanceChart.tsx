import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BalanceChartProps {
  data: Array<{ time: string; balance: number; equity: number }>;
}

export const BalanceChart = ({ data }: BalanceChartProps) => {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', color: '#f1f5f9' }}>Balance & Equity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
            }}
          />
          <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
