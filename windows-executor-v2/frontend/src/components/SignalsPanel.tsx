import { useState, useEffect } from 'react';
import { SignalCard } from './SignalCard';

interface TradingSignal {
  id: string;
  timestamp: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  strategy: string;
  timeframe: string;
  indicators?: {
    ema?: string;
    rsi?: number;
    macd?: string;
    cci?: number;
  };
  status: 'pending' | 'executed' | 'expired' | 'rejected';
  reason?: string;
}

interface SignalsPanelProps {
  channel: any;
  onExecute?: (signalId: string) => void;
  onReject?: (signalId: string) => void;
}

export const SignalsPanel = ({ channel, onExecute, onReject }: SignalsPanelProps) => {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'executed'>('all');

  useEffect(() => {
    if (!channel) return;

    // Listen for new signals from backend
    channel.bind('trading-signal', (data: TradingSignal) => {
      console.log('New trading signal received:', data);
      setSignals((prev) => [data, ...prev].slice(0, 50)); // Keep last 50 signals
    });

    // Listen for signal status updates
    channel.bind('signal-status-update', (data: { signalId: string; status: string; reason?: string }) => {
      console.log('Signal status update:', data);
      setSignals((prev) =>
        prev.map((signal) =>
          signal.id === data.signalId
            ? { ...signal, status: data.status as any, reason: data.reason }
            : signal
        )
      );
    });

    return () => {
      channel.unbind('trading-signal');
      channel.unbind('signal-status-update');
    };
  }, [channel]);

  const filteredSignals = signals.filter((signal) => {
    if (filter === 'all') return true;
    return signal.status === filter;
  });

  const pendingCount = signals.filter((s) => s.status === 'pending').length;
  const executedCount = signals.filter((s) => s.status === 'executed').length;

  return (
    <div>
      {/* Header with Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Trading Signals</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            Real-time trading signals from strategies
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <FilterButton
            label="All"
            count={signals.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Pending"
            count={pendingCount}
            active={filter === 'pending'}
            onClick={() => setFilter('pending')}
            color="#f59e0b"
          />
          <FilterButton
            label="Executed"
            count={executedCount}
            active={filter === 'executed'}
            onClick={() => setFilter('executed')}
            color="#22c55e"
          />
        </div>
      </div>

      {/* Signals List */}
      {filteredSignals.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#1e293b',
            borderRadius: '1rem',
            border: '2px dashed #334155',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
          <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.25rem' }}>
            {filter === 'pending' ? 'No Pending Signals' : 'No Signals Yet'}
          </h3>
          <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>
            Signals will appear here when strategies detect trading opportunities
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onExecute={onExecute}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Filter Button Component
const FilterButton = ({
  label,
  count,
  active,
  onClick,
  color = '#3b82f6',
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '0.5rem 1rem',
      backgroundColor: active ? color : '#1e293b',
      border: `1px solid ${active ? color : '#334155'}`,
      borderRadius: '0.5rem',
      color: active ? '#0f172a' : '#f1f5f9',
      fontWeight: active ? 700 : 600,
      cursor: 'pointer',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}
  >
    {label}
    <span
      style={{
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        backgroundColor: active ? 'rgba(15, 23, 42, 0.3)' : '#334155',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}
    >
      {count}
    </span>
  </button>
);
