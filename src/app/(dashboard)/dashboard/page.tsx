'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Activity,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { MarketSessionsWidget } from '@/components/market/MarketSessionsWidget';

interface DashboardStats {
  activeStrategies: number;
  totalTrades: number;
  totalProfit: number;
  winRate: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    activeStrategies: 0,
    totalTrades: 0,
    totalProfit: 0,
    winRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }

    if (status === 'authenticated') {
      fetchStats();
    }
  }, [status]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-600 mt-1">Welcome back, {session?.user?.name}!</p>
        </div>

        <Link
          href="/dashboard/strategies/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Strategy
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* Active Strategies */}
        <StatCard
          icon={TrendingUp}
          title="Active Strategies"
          value={stats.activeStrategies}
          suffix=""
        />

        {/* Total Trades */}
        <StatCard
          icon={BarChart3}
          title="Total Trades"
          value={stats.totalTrades}
          suffix=""
        />

        {/* Total Profit */}
        <StatCard
          icon={DollarSign}
          title="Total Profit"
          value={stats.totalProfit}
          suffix="USD"
          format="currency"
        />

        {/* Win Rate */}
        <StatCard
          icon={Activity}
          title="Win Rate"
          value={stats.winRate}
          suffix="%"
          format="percent"
        />
      </div>

      {/* Market Sessions Widget - NEW */}
      <MarketSessionsWidget />

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Getting Started */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">🚀 Getting Started</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium text-neutral-900">Create Your First Strategy</p>
                <p className="text-sm text-neutral-600">Design a trading strategy manually or with AI</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium text-neutral-900">Backtest Your Strategy</p>
                <p className="text-sm text-neutral-600">Test on historical data to validate performance</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium text-neutral-900">Deploy to Live Trading</p>
                <p className="text-sm text-neutral-600">Execute your strategy with real capital</p>
              </div>
            </li>
          </ul>

          <Link
            href="/dashboard/strategies/new"
            className="mt-6 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
          >
            Create Strategy <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">📊 Recent Activity</h2>
          
          {stats.totalTrades === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-600">No trading activity yet</p>
              <p className="text-sm text-neutral-500 mt-2">
                Start by creating and backtesting a strategy
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600">
                {stats.totalTrades} total trades executed
              </p>
              <p className="text-sm text-neutral-600">
                {stats.winRate.toFixed(1)}% win rate
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Features Overview */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold text-neutral-900 mb-6">✨ Key Features</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureItem
            title="AI Strategy Generation"
            description="Describe your trading idea and let AI convert it to a working strategy"
          />
          <FeatureItem
            title="Advanced Backtesting"
            description="Test strategies on historical data with realistic market conditions"
          />
          <FeatureItem
            title="Real-Time Execution"
            description="Execute strategies with minimal latency through local clients"
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  suffix: string;
  format?: 'currency' | 'percent';
}

function StatCard({
  icon: Icon,
  title,
  value,
  suffix,
  format,
}: StatCardProps) {
  let displayValue = value.toString();

  if (format === 'currency') {
    displayValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  } else if (format === 'percent') {
    displayValue = value.toFixed(1);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">
            {displayValue}
            {suffix && <span className="text-lg text-neutral-600 ml-1">{suffix}</span>}
          </p>
        </div>
        <Icon className="h-8 w-8 text-primary-600" />
      </div>
    </div>
  );
}

interface FeatureItemProps {
  title: string;
  description: string;
}

function FeatureItem({ title, description }: FeatureItemProps) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4">
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <p className="text-sm text-neutral-600 mt-1">{description}</p>
    </div>
  );
}
