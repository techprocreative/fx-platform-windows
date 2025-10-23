import React from 'react';

interface PerformanceCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function PerformanceCard({ 
  title, 
  value, 
  subtitle, 
  trend = 'neutral', 
  trendValue,
  className = ''
}: PerformanceCardProps) {
  const trendColors = {
    up: 'text-success-600',
    down: 'text-danger-600',
    neutral: 'text-gray-600'
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-7 7" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l5 5m0 0l-7 7" />
      </svg>
    ),
    neutral: null
  };

  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {trend !== 'neutral' && (
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">{subtitle}</span>
            <div className={`flex items-center ${trendColors[trend]}`}>
              {trendIcons[trend]}
              {trendValue && (
                <span className="text-xs ml-1">{trendValue}</span>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-baseline">
        <div className={`text-2xl font-bold text-gray-900 ${
          trend === 'up' ? 'text-success-600' : 
          trend === 'down' ? 'text-danger-600' : 
          'text-gray-900'
        }`}>
          {value}
        </div>
        
        {subtitle && trend === 'neutral' && (
          <div className="text-xs text-gray-500 ml-2">{subtitle}</div>
        )}
      </div>
    </div>
  );
}