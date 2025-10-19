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
 * Get color class based on format
 */
export function getFormatColor(format?: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') return 'text-green-600';
  if (format === 'percent') return 'text-blue-600';
  return 'text-neutral-900';
}
