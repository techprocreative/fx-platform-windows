import { useEffect, useMemo, useState } from "react";
import axios from "axios";

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
};

export default function App() {
  const [backendUrl, setBackendUrl] = useState<string>("http://localhost:8081");
  const [health, setHealth] = useState<string>("unknown");
  const [strategies, setStrategies] = useState<StrategyStatus[]>([]);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<OpenPosition[]>([]);

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

  const stopStrategy = async (strategyId: string) => {
    try {
      await api.delete(`/strategies/${strategyId}`);
      // Reload strategies
      const res = await api.get("/strategies");
      setStrategies(res.data);
    } catch (error) {
      console.error("Failed to stop strategy:", error);
      alert("Failed to stop strategy. Check console for details.");
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const [healthRes, strategiesRes, accountRes, positionsRes] = await Promise.all([
          api.get("/health"),
          api.get("/strategies"),
          api.get("/account"),
          api.get("/trades/open"),
        ]);
        setHealth(healthRes.data.status);
        setStrategies(strategiesRes.data);
        setAccount({
          balance: accountRes.data.balance || 0,
          equity: accountRes.data.equity || 0,
          free_margin: accountRes.data.free_margin || accountRes.data.freeMargin || 0,
          margin_level: accountRes.data.margin_level || accountRes.data.marginLevel || 0,
          currency: accountRes.data.currency || "USD",
          leverage: accountRes.data.leverage || 100,
          open_positions: accountRes.data.open_positions || accountRes.data.openPositions || 0,
        });
        // Map positions with null safety
        const mappedPositions = (positionsRes.data || []).map((pos: any) => ({
          ticket: pos.ticket || 0,
          symbol: pos.symbol || "",
          type: pos.type || "",
          volume: pos.volume || pos.lots || 0,
          openPrice: pos.open_price || pos.openPrice || 0,
          currentPrice: pos.current_price || pos.currentPrice || 0,
          profit: pos.profit || 0,
        }));
        setPositions(mappedPositions);
      } catch (error) {
        console.error(error);
        setHealth("offline");
        setStrategies([]);
        setAccount(null);
        setPositions([]);
      }
    }

    load();
  }, [api]);

  return (
    <div style={{ padding: "2rem", width: "100%" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Windows Executor V2</h1>
          <p style={{ margin: "0.25rem 0", color: "#94a3b8" }}>Hybrid Python + Electron architecture</p>
        </div>
        <div>
          <span
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "999px",
              backgroundColor: health === "ok" ? "#22c55e" : "#ef4444",
              color: "#0f172a",
              fontWeight: 600,
            }}
          >
            Backend {health}
          </span>
        </div>
      </header>

      <section style={{ marginTop: "2rem" }}>
        <h2>Account</h2>
        {account ? (
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            <InfoCard title="Balance" value={`${account.balance.toFixed(2)} ${account.currency}`} />
            <InfoCard title="Equity" value={`${account.equity.toFixed(2)} ${account.currency}`} />
            <InfoCard title="Free Margin" value={`${account.free_margin.toFixed(2)} ${account.currency}`} />
            <InfoCard title="Margin Level" value={`${account.margin_level.toFixed(2)}%`} />
            <InfoCard title="Leverage" value={`1:${account.leverage}`} />
            <InfoCard title="Open Positions" value={`${account.open_positions}`} />
          </div>
        ) : (
          <p style={{ color: "#94a3b8" }}>Account offline.</p>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Strategies</h2>
        {strategies.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No active strategies.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                style={{
                  background: "#1e293b",
                  borderRadius: "1rem",
                  padding: "1.5rem",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.3)",
                }}
              >
                <h3 style={{ margin: "0 0 0.5rem 0" }}>{strategy.name}</h3>
                <p style={{ margin: 0, color: "#cbd5f5" }}>
                  {strategy.symbol} · {strategy.timeframe}
                </p>
                <p style={{ margin: "1rem 0 0", color: "#94a3b8" }}>Trades executed: {strategy.trades_count}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "999px",
                      backgroundColor: strategy.status === "active" ? "#22c55e" : "#f97316",
                      color: "#0f172a",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    {strategy.status.toUpperCase()}
                  </span>
                  {strategy.status === "active" && (
                    <button
                      onClick={() => stopStrategy(strategy.id)}
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "none",
                        backgroundColor: "#ef4444",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Open Positions</h2>
        {positions.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No open positions.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "0.5rem" }}>Ticket</th>
                <th style={{ padding: "0.5rem" }}>Symbol</th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Lots</th>
                <th style={{ padding: "0.5rem" }}>Open Price</th>
                <th style={{ padding: "0.5rem" }}>Current Price</th>
                <th style={{ padding: "0.5rem" }}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.ticket} style={{ borderTop: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.5rem" }}>{position.ticket}</td>
                  <td style={{ padding: "0.5rem" }}>{position.symbol}</td>
                  <td style={{ padding: "0.5rem" }}>{position.type}</td>
                  <td style={{ padding: "0.5rem" }}>{position.volume.toFixed(2)}</td>
                  <td style={{ padding: "0.5rem" }}>{position.openPrice.toFixed(5)}</td>
                  <td style={{ padding: "0.5rem" }}>{position.currentPrice.toFixed(5)}</td>
                  <td style={{ padding: "0.5rem", color: position.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                    {position.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

type InfoCardProps = {
  title: string;
  value: string;
};

function InfoCard({ title, value }: InfoCardProps) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "1rem",
        padding: "1.5rem",
        minWidth: "180px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.3)",
      }}
    >
      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>{title}</p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "1.4rem", fontWeight: 600 }}>{value}</p>
    </div>
  );
}
