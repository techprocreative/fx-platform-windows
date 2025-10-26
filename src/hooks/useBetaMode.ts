'use client';

import { useState, useEffect } from 'react';

interface BetaConfig {
  enabled: boolean;
  limits: {
    maxLotSize: number;
    maxPositions: number;
    maxDailyTrades: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    allowedSymbols: string[];
  };
}

export function useBetaMode() {
  const [betaConfig, setBetaConfig] = useState<BetaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBetaConfig();
  }, []);

  const fetchBetaConfig = async () => {
    try {
      const response = await fetch('/api/beta/config');
      if (response.ok) {
        const data = await response.json();
        setBetaConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch beta config:', error);
      setBetaConfig(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    isBetaMode: betaConfig?.enabled || false,
    limits: betaConfig?.limits || null,
    loading,
  };
}

export default useBetaMode;
