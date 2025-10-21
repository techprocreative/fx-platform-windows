'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { RiskDisplay } from '@/components/trading/risk-display';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown, 
  Activity,
  RefreshCw,
  Settings,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { RiskExposure, RiskViolation } from '@/lib/risk/types';

export default function RiskPage() {
  const { data: session, status } = useSession();
  const [riskExposure, setRiskExposure] = useState<RiskExposure | null>(null);
  const [riskHistory, setRiskHistory] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
      return;
    }
    if (status === 'authenticated') {
      fetchRiskData();
      // Set up interval for real-time updates
      const interval = setInterval(fetchRiskData, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
    return undefined;
  }, [status]);

  const fetchRiskData = async () => {
    try {
      // Mock data for now - in production this would fetch from API
      const mockRiskExposure: RiskExposure = {
        balance: 10000,
        totalRiskExposure: 500,
        riskExposurePercent: 5,
        openPositions: 3,
        dailyLoss: 50,
        dailyLossPercent: 0.5,
        currentDrawdown: 200,
        drawdownPercent: 2,
        availableMargin: 9500,
        limitsExceeded: false,
        violations: [
          {
            type: 'MAX_DAILY_LOSS',
            currentValue: 4.5,
            limit: 6,
            severity: 'WARNING',
            message: 'Daily loss is approaching the maximum limit'
          }
        ]
      };

      const mockRiskHistory = [
        { date: new Date(Date.now() - 86400000 * 7), riskLevel: 3.2, exposure: 320 },
        { date: new Date(Date.now() - 86400000 * 6), riskLevel: 4.1, exposure: 410 },
        { date: new Date(Date.now() - 86400000 * 5), riskLevel: 3.8, exposure: 380 },
        { date: new Date(Date.now() - 86400000 * 4), riskLevel: 5.2, exposure: 520 },
        { date: new Date(Date.now() - 86400000 * 3), riskLevel: 4.7, exposure: 470 },
        { date: new Date(Date.now() - 86400000 * 2), riskLevel: 4.3, exposure: 430 },
        { date: new Date(Date.now() - 86400000 * 1), riskLevel: 5.0, exposure: 500 },
      ];

      const mockRiskAlerts: RiskViolation[] = [
        {
          type: 'MAX_DAILY_LOSS',
          currentValue: 4.5,
          limit: 6,
          severity: 'WARNING',
          message: 'Daily loss is approaching the maximum limit'
        },
        {
          type: 'MAX_POSITIONS',
          currentValue: 3,
          limit: 5,
          severity: 'WARNING',
          message: 'You have 3 out of 5 maximum open positions'
        }
      ];

      setRiskExposure(mockRiskExposure);
      setRiskHistory(mockRiskHistory);
      setRiskAlerts(mockRiskAlerts);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRiskData();
  };

  const handleEmergencyStop = async () => {
    try {
      // In production, this would call the API to close all positions
      console.log('Emergency stop triggered');
      // Mock emergency stop
      if (riskExposure) {
        setRiskExposure({
          ...riskExposure,
          openPositions: 0,
          totalRiskExposure: 0,
          riskExposurePercent: 0,
          dailyLoss: riskExposure.dailyLoss,
          dailyLossPercent: riskExposure.dailyLossPercent,
          currentDrawdown: riskExposure.currentDrawdown,
          drawdownPercent: riskExposure.drawdownPercent,
          availableMargin: riskExposure.balance,
          limitsExceeded: false,
          violations: []
        });
      }
    } catch (error) {
      console.error('Emergency stop failed:', error);
    }
  };

  const getRiskLevelColor = (level: number) => {
    if (level >= 8) return 'text-red-600';
    if (level >= 5) return 'text-amber-600';
    if (level >= 3) return 'text-blue-600';
    return 'text-green-600';
  };

  const getRiskLevelBg = (level: number) => {
    if (level >= 8) return 'bg-red-100';
    if (level >= 5) return 'bg-amber-100';
    if (level >= 3) return 'bg-blue-100';
    return 'bg-green-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Risk Management</h1>
          <p className="text-neutral-600 mt-1">
            Monitor and manage your trading risk exposure
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>

          <Button variant="secondary" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Risk Overview */}
      {riskExposure && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Risk Level</span>
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            <div className={`inline-flex px-2 py-1 rounded-full text-sm font-semibold ${getRiskLevelBg(riskExposure.riskExposurePercent)} ${getRiskLevelColor(riskExposure.riskExposurePercent)}`}>
              {riskExposure.riskExposurePercent >= 8 ? 'HIGH' : 
               riskExposure.riskExposurePercent >= 5 ? 'MEDIUM' : 
               riskExposure.riskExposurePercent >= 3 ? 'LOW' : 'MINIMAL'}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {riskExposure.riskExposurePercent.toFixed(1)}% exposure
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Daily Loss</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className={`text-2xl font-bold ${
              riskExposure.dailyLoss >= 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              ${riskExposure.dailyLoss.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {riskExposure.dailyLossPercent.toFixed(1)}% of balance
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Drawdown</span>
              <Activity className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {riskExposure.drawdownPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              ${riskExposure.currentDrawdown.toFixed(2)} from peak
            </p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Open Positions</span>
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{riskExposure.openPositions}</p>
            <p className="text-xs text-neutral-500 mt-1">
              Max 5 positions
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Risk Display */}
        <div className="lg:col-span-2">
          <RiskDisplay
            riskExposure={riskExposure || undefined}
            onEmergencyStop={handleEmergencyStop}
          />
        </div>

        {/* Risk History & Alerts */}
        <div className="space-y-6">
          {/* Risk History */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">Risk History (7 Days)</h3>
            <div className="space-y-2">
              {riskHistory.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    {item.date.toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-neutral-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.riskLevel >= 8 ? 'bg-red-500' :
                          item.riskLevel >= 5 ? 'bg-amber-500' :
                          item.riskLevel >= 3 ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(item.riskLevel * 10, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${getRiskLevelColor(item.riskLevel)}`}>
                      {item.riskLevel.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk Alerts */}
          {riskAlerts.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk Alerts
              </h3>
              <div className="space-y-2">
                {riskAlerts.map((alert, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${
                    alert.severity === 'WARNING' ? 'bg-amber-50 border-amber-200' :
                    alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      alert.severity === 'WARNING' ? 'text-amber-900' :
                      alert.severity === 'CRITICAL' ? 'text-red-900' :
                      'text-blue-900'
                    }`}>
                      {alert.type.replace(/_/g, ' ')}
                    </p>
                    <p className={`text-xs mt-1 ${
                      alert.severity === 'WARNING' ? 'text-amber-800' :
                      alert.severity === 'CRITICAL' ? 'text-red-800' :
                      'text-blue-800'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Risk Settings */}
          <Card className="p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">Risk Settings</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Max Risk/Trade</span>
                <span className="text-sm font-medium">2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Max Daily Loss</span>
                <span className="text-sm font-medium">6%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Max Drawdown</span>
                <span className="text-sm font-medium">20%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Max Positions</span>
                <span className="text-sm font-medium">5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Max Leverage</span>
                <span className="text-sm font-medium">1:100</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full mt-4">
              <Settings className="h-4 w-4 mr-1" />
              Configure Settings
            </Button>
          </Card>
        </div>
      </div>

      {/* Real-time Status */}
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Risk monitoring active</span>
        </div>
        <span>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}