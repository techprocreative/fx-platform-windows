interface TradingSignal {
  id: string;
  timestamp: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number; // 0-100
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

interface SignalCardProps {
  signal: TradingSignal;
  onExecute?: (signalId: string) => void;
  onReject?: (signalId: string) => void;
}

export const SignalCard = ({ signal, onExecute, onReject }: SignalCardProps) => {
  const typeColor = signal.type === 'BUY' ? '#22c55e' : '#ef4444';
  const confidenceColor =
    signal.confidence >= 80 ? '#22c55e' : signal.confidence >= 60 ? '#f59e0b' : '#ef4444';

  const statusBadge = {
    pending: { bg: '#f59e0b', text: 'PENDING' },
    executed: { bg: '#22c55e', text: 'EXECUTED' },
    expired: { bg: '#64748b', text: 'EXPIRED' },
    rejected: { bg: '#ef4444', text: 'REJECTED' },
  };

  const badge = statusBadge[signal.status];

  const pipsSL = Math.abs(signal.entryPrice - signal.stopLoss) * 10000;
  const pipsTP = Math.abs(signal.takeProfit - signal.entryPrice) * 10000;
  const riskReward = (pipsTP / pipsSL).toFixed(2);

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '1.5rem',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
        borderLeft: `4px solid ${typeColor}`,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>
            {signal.symbol}
          </h3>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
            {new Date(signal.timestamp).toLocaleString()} • {signal.timeframe}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Signal Type Badge */}
          <span
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              backgroundColor: typeColor,
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            {signal.type}
          </span>
          {/* Status Badge */}
          <span
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '999px',
              backgroundColor: badge.bg,
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            {badge.text}
          </span>
        </div>
      </div>

      {/* Price Levels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <PriceLevel label="Entry" price={signal.entryPrice} color="#3b82f6" />
        <PriceLevel label="Stop Loss" price={signal.stopLoss} color="#ef4444" pips={pipsSL} />
        <PriceLevel label="Take Profit" price={signal.takeProfit} color="#22c55e" pips={pipsTP} />
      </div>

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <Metric label="Confidence" value={`${signal.confidence}%`} color={confidenceColor} />
        <Metric label="R:R Ratio" value={`1:${riskReward}`} color="#8b5cf6" />
        <Metric label="Strategy" value={signal.strategy} color="#3b82f6" />
      </div>

      {/* Indicators */}
      {signal.indicators && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#0f172a',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            INDICATORS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {signal.indicators.ema && (
              <IndicatorBadge label="EMA" value={signal.indicators.ema} />
            )}
            {signal.indicators.rsi && (
              <IndicatorBadge label="RSI" value={signal.indicators.rsi.toFixed(1)} />
            )}
            {signal.indicators.macd && (
              <IndicatorBadge label="MACD" value={signal.indicators.macd} />
            )}
            {signal.indicators.cci && (
              <IndicatorBadge label="CCI" value={signal.indicators.cci.toFixed(0)} />
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      {signal.reason && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#0f172a',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>📝 {signal.reason}</span>
        </div>
      )}

      {/* Actions */}
      {signal.status === 'pending' && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onExecute?.(signal.id)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ✅ Execute Trade
          </button>
          <button
            onClick={() => onReject?.(signal.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#334155',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ❌ Reject
          </button>
        </div>
      )}
    </div>
  );
};

// Helper Components
const PriceLevel = ({ label, price, color, pips }: { label: string; price: number; color: string; pips?: number }) => (
  <div
    style={{
      padding: '0.75rem',
      backgroundColor: '#0f172a',
      borderRadius: '0.5rem',
      borderLeft: `3px solid ${color}`,
    }}
  >
    <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ color, fontSize: '1rem', fontWeight: 700 }}>{price.toFixed(5)}</div>
    {pips !== undefined && (
      <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.25rem' }}>
        {pips.toFixed(1)} pips
      </div>
    )}
  </div>
);

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div
    style={{
      padding: '0.75rem',
      backgroundColor: '#0f172a',
      borderRadius: '0.5rem',
      textAlign: 'center',
    }}
  >
    <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ color, fontSize: '0.95rem', fontWeight: 700 }}>{value}</div>
  </div>
);

const IndicatorBadge = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: '0.5rem',
      backgroundColor: '#1e293b',
      borderRadius: '0.375rem',
      border: '1px solid #334155',
      textAlign: 'center',
    }}
  >
    <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{label}</div>
    <div style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.125rem' }}>
      {value}
    </div>
  </div>
);
