'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  AlertTriangle, 
  Shield, 
  TrendingDown, 
  Activity,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { RiskExposure, RiskViolation } from '@/lib/risk/types';

interface RiskDisplayProps {
  riskExposure?: RiskExposure;
  onEmergencyStop?: () => void;
  className?: string;
}

interface RiskMeterProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  thresholds?: {
    warning: number;
    critical: number;
  };
  className?: string;
}

function RiskMeter({ 
  value, 
  max, 
  label, 
  unit = '%', 
  thresholds = { warning: 60, critical: 80 },
  className = ''
}: RiskMeterProps) {
  const percentage = (value / max) * 100;
  
  const getColor = () => {
    if (percentage >= thresholds.critical) return 'bg-red-500';
    if (percentage >= thresholds.warning) return 'bg-amber-500';
    return 'bg-green-500';
  };
  
  const getTextColor = () => {
    if (percentage >= thresholds.critical) return 'text-red-600';
    if (percentage >= thresholds.warning) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        <span className={`text-sm font-bold ${getTextColor()}`}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-neutral-500 mt-1">
        <span>0</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function ViolationCard({ violation }: { violation: RiskViolation }) {
  const getIcon = () => {
    switch (violation.severity) {
      case 'EMERGENCY':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'CRITICAL':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'WARNING':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (violation.severity) {
      case 'EMERGENCY':
        return 'border-red-200 bg-red-50';
      case 'CRITICAL':
        return 'border-red-200 bg-red-50';
      case 'WARNING':
        return 'border-amber-200 bg-amber-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getBorderColor()}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900 mb-1">
            {violation.type.replace(/_/g, ' ')}
          </h4>
          <p className="text-sm text-neutral-600 mb-2">{violation.message}</p>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>Current: {violation.currentValue.toFixed(2)}</span>
            <span>Limit: {violation.limit.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RiskDisplay({ 
  riskExposure, 
  onEmergencyStop, 
  className = '' 
}: RiskDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);

  // Mock data if not provided
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
    violations: []
  };

  const data = riskExposure || mockRiskExposure;

  const handleEmergencyStop = async () => {
    if (onEmergencyStop) {
      await onEmergencyStop();
      setShowEmergencyDialog(false);
    }
  };

  const getOverallRiskLevel = () => {
    if (data.limitsExceeded) return { level: 'CRITICAL', color: 'text-red-600', bg: 'bg-red-100' };
    if (data.riskExposurePercent > 15) return { level: 'HIGH', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (data.riskExposurePercent > 8) return { level: 'MEDIUM', color: 'text-blue-600', bg: 'bg-blue-100' };
    return { level: 'LOW', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const riskLevel = getOverallRiskLevel();

  return (
    <>
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-neutral-900">Risk Management</h2>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full ${riskLevel.bg}`}>
              <span className={`text-sm font-semibold ${riskLevel.color}`}>
                {riskLevel.level} RISK
              </span>
            </div>
            {data.limitsExceeded && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowEmergencyDialog(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Emergency Stop
              </Button>
            )}
          </div>
        </div>

        {/* Risk Overview */}
        <div className="mb-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'overview' ? null : 'overview')}
          >
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Risk Overview
            </h3>
            <span className="text-sm text-neutral-500">
              {expandedSection === 'overview' ? '▼' : '▶'}
            </span>
          </div>
          
          {expandedSection === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <RiskMeter
                value={data.riskExposurePercent}
                max={20}
                label="Risk Exposure"
                thresholds={{ warning: 10, critical: 15 }}
              />
              <RiskMeter
                value={data.dailyLossPercent}
                max={6}
                label="Daily Loss"
                thresholds={{ warning: 3, critical: 5 }}
              />
              <RiskMeter
                value={data.drawdownPercent}
                max={20}
                label="Drawdown"
                thresholds={{ warning: 10, critical: 15 }}
              />
              <RiskMeter
                value={(data.openPositions / 5) * 100}
                max={100}
                label="Position Usage"
                unit="%"
                thresholds={{ warning: 60, critical: 80 }}
              />
            </div>
          )}
        </div>

        {/* Account Metrics */}
        <div className="mb-6">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'account' ? null : 'account')}
          >
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Account Metrics
            </h3>
            <span className="text-sm text-neutral-500">
              {expandedSection === 'account' ? '▼' : '▶'}
            </span>
          </div>
          
          {expandedSection === 'account' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-neutral-50 p-3 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">Balance</p>
                <p className="text-lg font-bold text-neutral-900">${data.balance.toFixed(2)}</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">Available Margin</p>
                <p className="text-lg font-bold text-neutral-900">${data.availableMargin.toFixed(2)}</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">Open Positions</p>
                <p className="text-lg font-bold text-neutral-900">{data.openPositions}</p>
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg">
                <p className="text-xs text-neutral-500 mb-1">Daily P&L</p>
                <p className={`text-lg font-bold ${data.dailyLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${data.dailyLoss.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Risk Violations */}
        {data.violations.length > 0 && (
          <div className="mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedSection(expandedSection === 'violations' ? null : 'violations')}
            >
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk Violations ({data.violations.length})
              </h3>
              <span className="text-sm text-neutral-500">
                {expandedSection === 'violations' ? '▼' : '▶'}
              </span>
            </div>
            
            {expandedSection === 'violations' && (
              <div className="space-y-3 mt-4">
                {data.violations.map((violation, index) => (
                  <ViolationCard key={index} violation={violation} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Risk Recommendations */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Risk Recommendations
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            {data.riskExposurePercent > 10 && (
              <li>• Consider reducing position sizes to lower overall risk exposure</li>
            )}
            {data.dailyLossPercent > 2 && (
              <li>• Daily loss is approaching limit. Consider reducing trading activity</li>
            )}
            {data.drawdownPercent > 5 && (
              <li>• Current drawdown is significant. Review your trading strategy</li>
            )}
            {data.openPositions >= 4 && (
              <li>• You're approaching maximum position limit. Monitor existing trades</li>
            )}
            {data.riskExposurePercent < 5 && data.dailyLossPercent < 1 && data.drawdownPercent < 2 && (
              <li>• Risk levels are healthy. Current strategy is within safe parameters</li>
            )}
          </ul>
        </div>
      </Card>

      {/* Emergency Stop Confirmation */}
      {showEmergencyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Emergency Stop</h3>
            </div>
            
            <p className="text-neutral-600 mb-6">
              This will immediately close all open positions and stop all trading activity. 
              This action cannot be undone and may result in losses.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Only use this in emergency situations when 
                risk limits have been exceeded or there's a system failure.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowEmergencyDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleEmergencyStop}
                className="flex-1"
              >
                Emergency Stop All
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}