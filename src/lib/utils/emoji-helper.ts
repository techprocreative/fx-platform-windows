/**
 * Utility functions for emojis and icons
 */

// Emojis for charts and indicators
export const emojis = {
  trend_up: '📈',
  trend_down: '📉',
  warning: '⚠️',
  check_circle: '✅',
  x_circle: '❌',
  clock: '⏰',
  zap: '⚡',
  activity: '📈',
  analytics: '📊',
  money: '💰',
  security: '🛡️',
  calendar: '📅',
  progress_bar: '📈',
  loading: '⏳',
};

// Status indicators
export const statusIndicators = {
  online: {
    color: 'bg-green-100 text-green-800',
    text: 'bg-green-900',
    icon: '✅',
  },
  offline: {
    color: 'bg-red-100 text-red-800',
    text: 'bg-red-900',
    icon: '❌',
  },
  warning: {
    color: 'bg-yellow-100 text-yellow-800',
    text: 'bg-yellow-900',
    icon: '⚠️',
  },
  running: {
    color: 'bg-yellow-100 text-yellow-800',
    text: 'bg-yellow-900',
    icon: '⏳',
  },
};

// Status indicators (smaller variant for cards)
export const statusIndicatorsSmall = {
  online: {
    className: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium',
  },
  offline: {
    className: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium',
  },
  warning: {
    className: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium',
  },
  running: {
    className: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium',
  },
};

/**
 * Enhanced card component for analytics metrics
 */
export const MetricCard = ({ icon: React.ReactNode, title: string, value: string, suffix?: string, format?: 'currency' | 'percent', format?: 'number' }) => (
  <div className="rounded-lg border border border-neutral-200 bg-white p-6 hover:shadow-sm transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 text-${getStatusColor(status.color)} rounded-full p-3 ${getStatusColor(status.color)} text-center`}>
            <icon className={`w-4 h-4 ${getStatusColor(status.color)}`} />
            <span>{status}</span>
          </div>
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-neutral-900">{title}</p>
          <p className={`text-sm text-neutral-600`}>{suffix}</p>
        </div>
      </div>
      <div className={`text-right ${format === 'currency' ? 'text-green-600' : 
      format === 'percent' ? 'text-blue-600' : 'text-red-600'}`}>
        {displayValue}
      </div>
    </div>
    {/* End of Metric Cards */}
  </div>
);
