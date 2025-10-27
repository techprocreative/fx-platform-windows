import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { usePusher } from '../hooks/usePusher';
import { useToast, ToastContainer } from '../components/Toast';
import { BalanceChart } from '../components/BalanceChart';
import { TradesChart } from '../components/TradesChart';
import { Tabs, TabPanel } from '../components/Tabs';
import { WinRateChart } from '../components/WinRateChart';
import { PerformanceMetrics } from '../components/PerformanceMetrics';
import { SignalsPanel } from '../components/SignalsPanel';
import { SettingsPanel } from '../components/SettingsPanel';

type StrategyStatus = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  status: string;
  trades_count: number;
};

type AccountInfo = {
  balance: number;
  equity: number;
  free_margin: number;
  margin_level: number;
  currency: string;
  leverage: number;
  open_positions: number;
};

type OpenPosition = {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  sl?: number;
  tp?: number;
};

type TradeHistory = {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  openTime: string;
  closeTime: string;
};

type PlatformStrategy = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  isSystemDefault: boolean;
  isPublic: boolean;
  description?: string;
};

export default function AppEnhanced() {
  const [backendUrl, setBackendUrl] = useState<string>('http://localhost:8081');
  const [health, setHealth] = useState<string>('unknown');
  const [strategies, setStrategies] = useState<StrategyStatus[]>([]);
  const [availableStrategies, setAvailableStrategies] = useState<PlatformStrategy[]>([]);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [balanceData, setBalanceData] = useState<Array<{ time: string; balance: number; equity: number }>>([]);
  const [tradesData, setTradesData] = useState<Array<{ symbol: string; trades: number; profit: number }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    totalProfit: 0,
    avgWin: 0,
    avgLoss: 0,
    maxDrawdown: 0,
    profitFactor: 0,
  });

  const toast = useToast();

  useEffect(() => {
    async function resolveBackendUrl() {
      if (window.executor?.backendUrl) {
        const url = await window.executor.backendUrl();
        setBackendUrl(url);
      }
    }
    resolveBackendUrl();
  }, []);

  const api = useMemo(() => axios.create({ baseURL: `${backendUrl}/api` }), [backendUrl]);

  // Pusher real-time updates
  const { channel, isConnected } = usePusher(backendUrl);

  useEffect(() => {
    if (!channel) return;

    // Listen for position opened
    channel.bind('position-opened', (data: any) => {
      console.log('Position opened:', data);
      toast.success('Position Opened', `${data.symbol} - ${data.type} ${data.volume} lots`);
      loadData(); // Refresh data
    });

    // Listen for position closed
    channel.bind('position-closed', (data: any) => {
      console.log('Position closed:', data);
      const profitColor = data.profit >= 0 ? 'profit' : 'loss';
      toast.info(
        'Position Closed',
        `${data.symbol} - ${data.type} closed with ${profitColor}: $${data.profit.toFixed(2)}`
      );
      loadData(); // Refresh data
    });

    // Listen for strategy status changes
    channel.bind('strategy-status', (data: any) => {
      console.log('Strategy status:', data);
      toast.info('Strategy Update', `${data.strategyName}: ${data.status}`);
      loadStrategies();
    });

    // Listen for errors
    channel.bind('error', (data: any) => {
      console.error('Error event:', data);
      toast.error('Error', data.message || 'An error occurred');
    });

    return () => {
      channel.unbind('position-opened');
      channel.unbind('position-closed');
      channel.unbind('strategy-status');
      channel.unbind('error');
    };
  }, [channel]);

  const stopStrategy = async (strategyId: string) => {
    try {
      await api.delete(`/strategies/${strategyId}`);
      toast.success('Strategy Stopped', 'Strategy has been stopped successfully');
      loadStrategies();
    } catch (error) {
      console.error('Failed to stop strategy:', error);
      toast.error('Failed to Stop Strategy', 'Check console for details');
    }
  };

  const loadStrategies = async () => {
    try {
      // Load running strategies
      const res = await api.get('/strategies');
      setStrategies(res.data);
    } catch (error) {
      console.error('Failed to load strategies:', error);
    }
  };

  const loadAvailableStrategies = async () => {
    try {
      // Load available strategies from platform
      const res = await api.get('/strategies/available');
      setAvailableStrategies(res.data);
    } catch (error) {
      console.error('Failed to load available strategies:', error);
      setAvailableStrategies([]);
    }
  };

  const startPlatformStrategy = async (strategyId: string) => {
    try {
      // Fetch full strategy config from platform
      const strategyRes = await api.get(`/strategies/${strategyId}`);
      const strategyConfig = strategyRes.data;
      
      // Start the strategy
      await api.post('/strategies/start', strategyConfig);
      toast.success('Strategy Started', `${strategyConfig.name} is now running`);
      
      // Reload strategies
      loadStrategies();
    } catch (error) {
      console.error('Failed to start strategy:', error);
      toast.error('Failed to Start Strategy', 'Check console for details');
    }
  };

  const loadData = async () => {
    try {
      const [healthRes, strategiesRes, accountRes, positionsRes] = await Promise.all([
        api.get('/health'),
        api.get('/strategies'),
        api.get('/account'),
        api.get('/trades/open'),
      ]);

      setHealth(healthRes.data.status);
      setStrategies(strategiesRes.data);

      const accountData = {
        balance: accountRes.data.balance || 0,
        equity: accountRes.data.equity || 0,
        free_margin: accountRes.data.free_margin || accountRes.data.freeMargin || 0,
        margin_level: accountRes.data.margin_level || accountRes.data.marginLevel || 0,
        currency: accountRes.data.currency || 'USD',
        leverage: accountRes.data.leverage || 100,
        open_positions: accountRes.data.open_positions || accountRes.data.openPositions || 0,
      };
      setAccount(accountData);

      // Update balance chart data
      const now = new Date();
      setBalanceData((prev) => {
        const newData = [
          ...prev,
          {
            time: now.toLocaleTimeString(),
            balance: accountData.balance,
            equity: accountData.equity,
          },
        ];
        // Keep only last 20 data points
        return newData.slice(-20);
      });

      // Map positions with null safety
      const mappedPositions = (positionsRes.data || []).map((pos: any) => ({
        ticket: pos.ticket || 0,
        symbol: pos.symbol || '',
        type: pos.type || '',
        volume: pos.volume || pos.lots || 0,
        openPrice: pos.open_price || pos.openPrice || 0,
        currentPrice: pos.current_price || pos.currentPrice || 0,
        profit: pos.profit || 0,
        sl: pos.sl || pos.stop_loss,
        tp: pos.tp || pos.take_profit,
      }));
      setPositions(mappedPositions);
    } catch (error) {
      console.error('Failed to load data:', error);
      setHealth('offline');
      setStrategies([]);
      setAccount(null);
      setPositions([]);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/trades/history');
      const mappedHistory = (res.data || []).map((trade: any) => ({
        ticket: trade.ticket || 0,
        symbol: trade.symbol || '',
        type: trade.type || '',
        volume: trade.volume || trade.lots || 0,
        openPrice: trade.open_price || trade.openPrice || 0,
        closePrice: trade.close_price || trade.closePrice || 0,
        profit: trade.profit || 0,
        openTime: trade.open_time || trade.openTime || '',
        closeTime: trade.close_time || trade.closeTime || '',
      }));
      setHistory(mappedHistory);

      // Calculate trades by symbol
      const tradesBySymbol = mappedHistory.reduce((acc: any, trade: TradeHistory) => {
        if (!acc[trade.symbol]) {
          acc[trade.symbol] = { symbol: trade.symbol, trades: 0, profit: 0 };
        }
        acc[trade.symbol].trades += 1;
        acc[trade.symbol].profit += trade.profit;
        return acc;
      }, {});

      setTradesData(Object.values(tradesBySymbol));
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [api]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
    if (activeTab === 'strategies') {
      loadAvailableStrategies();
    }
  }, [activeTab, api]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'signals', label: 'Signals', icon: '📡' },
    { id: 'strategies', label: 'Strategies', icon: '⚙️' },
    { id: 'positions', label: 'Positions', icon: '📈' },
    { id: 'history', label: 'History', icon: '📜' },
  ];
  
  // Calculate performance metrics from history
  useEffect(() => {
    if (history.length > 0) {
      const wins = history.filter((t) => t.profit > 0);
      const losses = history.filter((t) => t.profit < 0);
      const totalProfit = history.reduce((sum, t) => sum + t.profit, 0);
      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length : 0;
      const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
      const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
      
      // Calculate max drawdown (simplified)
      let maxDrawdown = 0;
      let peak = 0;
      let cumulative = 0;
      history.forEach((trade) => {
        cumulative += trade.profit;
        if (cumulative > peak) peak = cumulative;
        const drawdown = peak - cumulative;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      setPerformanceMetrics({
        totalTrades: history.length,
        wins: wins.length,
        losses: losses.length,
        totalProfit,
        avgWin,
        avgLoss,
        maxDrawdown,
        profitFactor,
      });
    }
  }, [history]);

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} backendUrl={backendUrl} />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Windows Executor V2</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>Professional Trading Platform</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isConnected && (
            <span
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                backgroundColor: '#22c55e',
                color: '#0f172a',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              🟢 Real-time Connected
            </span>
          )}
          <span
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              backgroundColor: health === 'ok' ? '#22c55e' : '#ef4444',
              color: '#0f172a',
              fontWeight: 600,
            }}
          >
            Backend {health}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#334155',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
            title="Settings (Ctrl+,)"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <TabPanel tabId="dashboard" activeTab={activeTab}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <section>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>Account Overview</h2>
            {account ? (
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <InfoCard title="Balance" value={`${account.balance.toFixed(2)} ${account.currency}`} color="#3b82f6" />
                <InfoCard title="Equity" value={`${account.equity.toFixed(2)} ${account.currency}`} color="#22c55e" />
                <InfoCard
                  title="Free Margin"
                  value={`${account.free_margin.toFixed(2)} ${account.currency}`}
                  color="#f59e0b"
                />
                <InfoCard title="Margin Level" value={`${account.margin_level.toFixed(2)}%`} color="#8b5cf6" />
                <InfoCard title="Leverage" value={`1:${account.leverage}`} color="#ec4899" />
                <InfoCard title="Open Positions" value={`${account.open_positions}`} color="#06b6d4" />
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>Account offline.</p>
            )}
          </section>

          <section style={{ marginTop: '1rem' }}>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <BalanceChart data={balanceData} />
              <WinRateChart wins={performanceMetrics.wins} losses={performanceMetrics.losses} />
            </div>
          </section>

          <section style={{ marginTop: '1rem' }}>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <TradesChart data={tradesData} />
              <PerformanceMetrics
                totalTrades={performanceMetrics.totalTrades}
                wins={performanceMetrics.wins}
                losses={performanceMetrics.losses}
                totalProfit={performanceMetrics.totalProfit}
                avgWin={performanceMetrics.avgWin}
                avgLoss={performanceMetrics.avgLoss}
                maxDrawdown={performanceMetrics.maxDrawdown}
                profitFactor={performanceMetrics.profitFactor}
              />
            </div>
          </section>
          </div>
        </TabPanel>

        <TabPanel tabId="signals" activeTab={activeTab}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <SignalsPanel
            channel={channel}
            onExecute={(signalId) => {
              console.log('Execute signal:', signalId);
              toast.success('Signal Executed', `Signal ${signalId} sent to MT5 for execution`);
            }}
            onReject={(signalId) => {
              console.log('Reject signal:', signalId);
              toast.warning('Signal Rejected', `Signal ${signalId} has been rejected`);
            }}
          />
          </div>
        </TabPanel>

        <TabPanel tabId="strategies" activeTab={activeTab}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.5rem' }}>
          
          {/* Running Strategies */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>🟢 Running Strategies</h2>
            {strategies.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No running strategies. Start a strategy from the list below.</p>
            ) : (
              <div
                style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
              >
                {strategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    style={{
                      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                      border: '1px solid #22c55e',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{strategy.name}</h3>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '999px',
                          backgroundColor: '#22c55e',
                          color: '#0f172a',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        ACTIVE
                      </span>
                    </div>
                    <p style={{ margin: '0.5rem 0', color: '#cbd5e1', fontSize: '0.875rem' }}>
                      {strategy.symbol} · {strategy.timeframe}
                    </p>
                    <p style={{ margin: '0.75rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                      Trades: <strong style={{ color: '#22c55e' }}>{strategy.trades_count}</strong>
                    </p>
                    <button
                      onClick={() => stopStrategy(strategy.id)}
                      style={{
                        width: '100%',
                        marginTop: '1rem',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      ⏹️ Stop Strategy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Available Strategies from Platform */}
          <section>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>📚 Available Strategies</h2>
            <p style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
              Strategies from your FX Platform account
            </p>
            {availableStrategies.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: '#1e293b',
                  borderRadius: '0.75rem',
                  border: '2px dashed #334155',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1rem' }}>No Strategies Found</h3>
                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                  Create strategies on the web platform first
                </p>
              </div>
            ) : (
              <div
                style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
              >
                {availableStrategies.map((strategy) => {
                  const isRunning = strategies.some(s => s.id === strategy.id);
                  return (
                    <div
                      key={strategy.id}
                      style={{
                        background: '#1e293b',
                        borderRadius: '0.75rem',
                        padding: '1rem',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)',
                        border: '1px solid #334155',
                        opacity: isRunning ? 0.5 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{strategy.name}</h3>
                        {strategy.isSystemDefault && (
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            SYSTEM
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.5rem 0', color: '#cbd5e1', fontSize: '0.875rem' }}>
                        {strategy.symbol} · {strategy.timeframe}
                      </p>
                      {strategy.description && (
                        <p style={{ margin: '0.75rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                          {strategy.description}
                        </p>
                      )}
                      <button
                        onClick={() => startPlatformStrategy(strategy.id)}
                        disabled={isRunning}
                        style={{
                          width: '100%',
                          marginTop: '1rem',
                          padding: '0.5rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          backgroundColor: isRunning ? '#334155' : '#22c55e',
                          color: isRunning ? '#64748b' : '#0f172a',
                          fontWeight: 600,
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {isRunning ? '✓ Already Running' : '▶️ Start Strategy'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          </div>
        </TabPanel>

        <TabPanel tabId="positions" activeTab={activeTab}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <section>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>Open Positions</h2>
            {positions.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No open positions.</p>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '0.75rem' }}>Ticket</th>
                      <th style={{ padding: '0.75rem' }}>Symbol</th>
                      <th style={{ padding: '0.75rem' }}>Type</th>
                      <th style={{ padding: '0.75rem' }}>Lots</th>
                      <th style={{ padding: '0.75rem' }}>Open Price</th>
                      <th style={{ padding: '0.75rem' }}>Current Price</th>
                      <th style={{ padding: '0.75rem' }}>SL</th>
                      <th style={{ padding: '0.75rem' }}>TP</th>
                      <th style={{ padding: '0.75rem' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => (
                      <tr key={position.ticket} style={{ borderTop: '1px solid #1e293b' }}>
                        <td style={{ padding: '0.75rem' }}>{position.ticket}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{position.symbol}</td>
                        <td
                          style={{
                            padding: '0.75rem',
                            color: position.type === 'BUY' ? '#22c55e' : '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          {position.type}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{position.volume.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem' }}>{position.openPrice.toFixed(5)}</td>
                        <td style={{ padding: '0.75rem' }}>{position.currentPrice.toFixed(5)}</td>
                        <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{position.sl?.toFixed(5) || '-'}</td>
                        <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{position.tp?.toFixed(5) || '-'}</td>
                        <td
                          style={{
                            padding: '0.75rem',
                            color: position.profit >= 0 ? '#22c55e' : '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          ${position.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </div>
        </TabPanel>

        <TabPanel tabId="history" activeTab={activeTab}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <section>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>Trade History</h2>
            {history.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No trade history available.</p>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '2px solid #1e293b' }}>
                      <th style={{ padding: '0.75rem' }}>Ticket</th>
                      <th style={{ padding: '0.75rem' }}>Symbol</th>
                      <th style={{ padding: '0.75rem' }}>Type</th>
                      <th style={{ padding: '0.75rem' }}>Lots</th>
                      <th style={{ padding: '0.75rem' }}>Open Price</th>
                      <th style={{ padding: '0.75rem' }}>Close Price</th>
                      <th style={{ padding: '0.75rem' }}>Profit</th>
                      <th style={{ padding: '0.75rem' }}>Open Time</th>
                      <th style={{ padding: '0.75rem' }}>Close Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((trade) => (
                      <tr key={trade.ticket} style={{ borderTop: '1px solid #1e293b' }}>
                        <td style={{ padding: '0.75rem' }}>{trade.ticket}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{trade.symbol}</td>
                        <td
                          style={{
                            padding: '0.75rem',
                            color: trade.type === 'BUY' ? '#22c55e' : '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          {trade.type}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{trade.volume.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem' }}>{trade.openPrice.toFixed(5)}</td>
                        <td style={{ padding: '0.75rem' }}>{trade.closePrice.toFixed(5)}</td>
                        <td
                          style={{
                            padding: '0.75rem',
                            color: trade.profit >= 0 ? '#22c55e' : '#ef4444',
                            fontWeight: 600,
                          }}
                        >
                          ${trade.profit.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#94a3b8' }}>{trade.openTime}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#94a3b8' }}>{trade.closeTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </div>
        </TabPanel>
      </Tabs>
      </div>
    </div>
  );
}

type InfoCardProps = {
  title: string;
  value: string;
  color?: string;
};

function InfoCard({ title, value, color = '#3b82f6' }: InfoCardProps) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '0.75rem',
        padding: '1rem',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>{title}</p>
      <p style={{ margin: '0.4rem 0 0', fontSize: '1.5rem', fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
