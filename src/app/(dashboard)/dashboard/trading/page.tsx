"use client";

import React, { useState, useEffect } from "react";
import { TradingPanel } from "@/components/trading/trading-panel";
import { AccountInfo, TradeParams } from "@/lib/risk/types";

export default function TradingPage() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch account information
  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const response = await fetch("/api/account/balance");
        const data = await response.json();

        if (data.success) {
          // Transform the account data to match AccountInfo interface
          const transformedAccountInfo: AccountInfo = {
            balance: data.data.balance,
            equity: data.data.equity,
            margin: data.data.margin,
            freeMargin: data.data.freeMargin,
            marginLevel: data.data.marginLevel,
            profit: data.data.profit,
            openPositions: data.data.openPositions,
            accountNumber: data.data.accountInfo.accountNumber,
            accountType: data.data.accountInfo.accountType,
            currency: data.data.accountInfo.currency,
            leverage: data.data.accountInfo.leverage,
            server: data.data.accountInfo.server,
            company: data.data.accountInfo.company,
            name: data.data.accountInfo.name,
            tradeAllowed: data.data.accountInfo.tradeAllowed,
            tradeExpertAllowed: data.data.accountInfo.tradeExpertAllowed,
          };
          setAccountInfo(transformedAccountInfo);
        }
      } catch (error) {
        console.error("Failed to fetch account info:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountInfo();

    // Set up periodic updates every 5 seconds
    const interval = setInterval(fetchAccountInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle trade execution
  const handleTrade = async (params: TradeParams) => {
    try {
      const response = await fetch("/api/trading/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.success) {
        console.log("Trade executed successfully:", data.data);
        // Refresh account info after trade
        const accountResponse = await fetch("/api/account/balance");
        const accountData = await accountResponse.json();
        if (accountData.success) {
          const transformedAccountInfo: AccountInfo = {
            balance: accountData.data.balance,
            equity: accountData.data.equity,
            margin: accountData.data.margin,
            freeMargin: accountData.data.freeMargin,
            marginLevel: accountData.data.marginLevel,
            profit: accountData.data.profit,
            openPositions: accountData.data.openPositions,
            accountNumber: accountData.data.accountInfo.accountNumber,
            accountType: accountData.data.accountInfo.accountType,
            currency: accountData.data.accountInfo.currency,
            leverage: accountData.data.accountInfo.leverage,
            server: accountData.data.accountInfo.server,
            company: accountData.data.accountInfo.company,
            name: accountData.data.accountInfo.name,
            tradeAllowed: accountData.data.accountInfo.tradeAllowed,
            tradeExpertAllowed: accountData.data.accountInfo.tradeExpertAllowed,
          };
          setAccountInfo(transformedAccountInfo);
        }
      } else {
        throw new Error(data.message || "Trade execution failed");
      }
    } catch (error) {
      console.error("Trade execution error:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Trading</h1>
        <div className="text-sm text-neutral-500">
          {accountInfo ? (
            <span>Balance: ${accountInfo.balance.toFixed(2)}</span>
          ) : (
            <span>Loading account info...</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Panel */}
        <div className="lg:col-span-2">
          <TradingPanel
            accountInfo={accountInfo || undefined}
            onTrade={handleTrade}
          />
        </div>

        {/* Risk Display - To be implemented later */}
        <div className="space-y-4">
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            <h3 className="font-semibold text-neutral-900 mb-2">
              Risk Management
            </h3>
            <p className="text-sm text-neutral-600">
              Risk management features will be available in the next update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
