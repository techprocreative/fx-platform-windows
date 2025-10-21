import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'success' | 'error' | 'warning' | 'loading' | 'idle';
  message?: string;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
  },
  loading: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  idle: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
  },
};

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    padding: 'px-2 py-1',
  },
  md: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    padding: 'px-3 py-1.5',
  },
  lg: {
    icon: 'h-5 w-5',
    text: 'text-base',
    padding: 'px-4 py-2',
  },
};

export function StatusIndicator({
  status,
  message,
  showIcon = true,
  className,
  size = 'md',
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeConfigValue = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border',
        config.bgColor,
        config.borderColor,
        sizeConfigValue.padding,
        className
      )}
      role="status"
      aria-live={status === 'loading' ? 'polite' : 'off'}
      aria-label={message || status}
    >
      {showIcon && (
        <Icon
          className={cn(
            config.color,
            sizeConfigValue.icon,
            status === 'loading' && 'animate-spin'
          )}
          aria-hidden="true"
        />
      )}
      {message && (
        <span className={cn('font-medium', config.color, sizeConfigValue.text)}>
          {message}
        </span>
      )}
    </div>
  );
}

// Specific status indicators for different use cases
export function BacktestStatus({ 
  status, 
  progress, 
  className 
}: { 
  status: string; 
  progress?: number; 
  className?: string;
}) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          status: 'success' as const,
          message: 'Completed',
        };
      case 'running':
        return {
          status: 'loading' as const,
          message: progress ? `${Math.round(progress)}%` : 'Running',
        };
      case 'failed':
        return {
          status: 'error' as const,
          message: 'Failed',
        };
      case 'pending':
        return {
          status: 'idle' as const,
          message: 'Pending',
        };
      default:
        return {
          status: 'idle' as const,
          message: status,
        };
    }
  };

  const { status: indicatorStatus, message } = getStatusConfig(status);

  return (
    <div role="status" aria-label={`Backtest ${message}`}>
      <StatusIndicator
        status={indicatorStatus}
        message={message}
        className={className}
        size="sm"
      />
    </div>
  );
}

export function TradeStatus({ 
  status, 
  className 
}: { 
  status: string; 
  className?: string;
}) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'OPEN':
        return {
          status: 'success' as const,
          message: 'Open',
        };
      case 'CLOSED':
        return {
          status: 'idle' as const,
          message: 'Closed',
        };
      case 'PENDING':
        return {
          status: 'loading' as const,
          message: 'Pending',
        };
      case 'CANCELLED':
        return {
          status: 'error' as const,
          message: 'Cancelled',
        };
      default:
        return {
          status: 'idle' as const,
          message: status,
        };
    }
  };

  const { status: indicatorStatus, message } = getStatusConfig(status);

  return (
    <div role="status" aria-label={`Trade ${message}`}>
      <StatusIndicator
        status={indicatorStatus}
        message={message}
        className={className}
        size="sm"
      />
    </div>
  );
}

export function StrategyStatus({ 
  status, 
  className 
}: { 
  status: string; 
  className?: string;
}) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          status: 'success' as const,
          message: 'Active',
        };
      case 'paused':
        return {
          status: 'warning' as const,
          message: 'Paused',
        };
      case 'draft':
        return {
          status: 'idle' as const,
          message: 'Draft',
        };
      case 'archived':
        return {
          status: 'idle' as const,
          message: 'Archived',
        };
      case 'error':
        return {
          status: 'error' as const,
          message: 'Error',
        };
      default:
        return {
          status: 'idle' as const,
          message: status,
        };
    }
  };

  const { status: indicatorStatus, message } = getStatusConfig(status);

  return (
    <div role="status" aria-label={`Strategy ${message}`}>
      <StatusIndicator
        status={indicatorStatus}
        message={message}
        className={className}
        size="sm"
      />
    </div>
  );
}

export function ConnectionStatus({ 
  connected, 
  connecting, 
  className 
}: { 
  connected: boolean; 
  connecting: boolean; 
  className?: string;
}) {
  if (connecting) {
    return (
      <StatusIndicator
        status="loading"
        message="Connecting..."
        className={className}
        size="sm"
      />
    );
  }

  if (connected) {
    return (
      <StatusIndicator
        status="success"
        message="Connected"
        className={className}
        size="sm"
      />
    );
  }

  return (
    <StatusIndicator
      status="error"
      message="Disconnected"
      className={className}
      size="sm"
    />
  );
}

// Progress indicator for long-running operations
export function ProgressIndicator({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-label={label || 'Progress'}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${Math.round(percentage)}% complete`}
    >
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-neutral-700">{label}</span>
          <span className="text-sm text-neutral-600" aria-hidden="true">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className="w-full bg-neutral-200 rounded-full h-2" aria-hidden="true">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}