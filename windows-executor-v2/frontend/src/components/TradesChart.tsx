import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TradesChartProps {
  data: Array<{ symbol: string; trades: number; profit: number }>;
}

export const TradesChart = ({ data }: TradesChartProps) => {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 1rem 0', color: '#f1f5f9' }}>Trades by Symbol</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="symbol" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
            }}
          />
          <Bar dataKey="trades" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
