import { AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';

interface UserFriendlyMessage {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ErrorMessageProps {
  error: Error;
  retry?: () => void;
  className?: string;
  variant?: 'inline' | 'card' | 'full';
  showDetails?: boolean;
}

// Function to convert technical errors to user-friendly messages
function getUserFriendlyMessage(error: Error): UserFriendlyMessage {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return {
      title: 'Connection Error',
      description: 'Unable to connect to the server. Please check your internet connection and try again.',
    };
  }
  
  // Authentication errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return {
      title: 'Authentication Required',
      description: 'Please log in to access this feature.',
      action: {
        label: 'Go to Login',
        onClick: () => {
          window.location.href = '/login';
        },
      },
    };
  }
  
  // Permission errors
  if (message.includes('forbidden') || message.includes('403')) {
    return {
      title: 'Access Denied',
      description: 'You don\'t have permission to perform this action.',
    };
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return {
      title: 'Not Found',
      description: 'The requested resource could not be found.',
    };
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('400')) {
    return {
      title: 'Invalid Data',
      description: 'Please check your input and try again.',
    };
  }
  
  // Rate limit errors
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      title: 'Too Many Requests',
      description: 'Please wait a moment before trying again.',
    };
  }
  
  // Server errors
  if (message.includes('server') || message.includes('500')) {
    return {
      title: 'Server Error',
      description: 'Something went wrong on our end. Please try again later.',
    };
  }
  
  // Backtest specific errors
  if (message.includes('backtest')) {
    if (message.includes('running')) {
      return {
        title: 'Backtest Already Running',
        description: 'A backtest is already running for this strategy. Please wait for it to complete.',
      };
    }
    if (message.includes('limit')) {
      return {
        title: 'Backtest Limit Reached',
        description: 'You have reached the maximum number of concurrent backtests.',
      };
    }
    return {
      title: 'Backtest Error',
      description: 'Failed to run backtest. Please check your strategy configuration.',
    };
  }
  
  // Strategy specific errors
  if (message.includes('strategy')) {
    if (message.includes('limit')) {
      return {
        title: 'Strategy Limit Reached',
        description: 'You have reached the maximum number of strategies. Upgrade your plan to create more.',
      };
    }
    return {
      title: 'Strategy Error',
      description: 'Failed to process strategy. Please check your configuration.',
    };
  }
  
  // Default error
  return {
    title: 'Something Went Wrong',
    description: error.message || 'An unexpected error occurred. Please try again.',
  };
}

export function ErrorMessage({ 
  error, 
  retry, 
  className,
  variant = 'inline',
  showDetails = false
}: ErrorMessageProps) {
  const userMessage = getUserFriendlyMessage(error);
  
  if (variant === 'card') {
    return (
      <Card className={cn("border-red-200 bg-red-50", className)}>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">{userMessage.title}</h3>
              <p className="text-sm text-red-700 mt-1">{userMessage.description}</p>
              
              {showDetails && (
                <details className="mt-3">
                  <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-32 text-red-800">
                    {error.stack || error.message}
                  </pre>
                </details>
              )}
              
              <div className="flex gap-2 mt-4">
                {retry && (
                  <Button
                    onClick={retry}
                    size="sm"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                  >
                    Try Again
                  </Button>
                )}
                {userMessage.action && (
                  <Button
                    onClick={userMessage.action.onClick}
                    size="sm"
                    variant="secondary"
                  >
                    {userMessage.action.label}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (variant === 'full') {
    return (
      <div className={cn("flex items-center justify-center min-h-96 p-8", className)}>
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">{userMessage.title}</h3>
            <p className="text-sm text-red-700 mb-6">{userMessage.description}</p>
            
            {showDetails && (
              <details className="text-left mb-4">
                <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-32 text-red-800">
                  {error.stack || error.message}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col gap-2">
              {retry && (
                <Button
                  onClick={retry}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Try Again
                </Button>
              )}
              {userMessage.action && (
                <Button
                  onClick={userMessage.action.onClick}
                  variant="secondary"
                >
                  {userMessage.action.label}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Default inline variant
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200", className)}>
      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="font-semibold text-red-900">{userMessage.title}</h4>
        <p className="text-sm text-red-700 mt-1">{userMessage.description}</p>
        
        {showDetails && (
          <details className="mt-2">
            <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
              Technical Details
            </summary>
            <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto max-h-32 text-red-800">
              {error.stack || error.message}
            </pre>
          </details>
        )}
        
        <div className="flex gap-2 mt-3">
          {retry && (
            <Button
              onClick={retry}
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Try Again
            </Button>
          )}
          {userMessage.action && (
            <Button
              onClick={userMessage.action.onClick}
              size="sm"
              variant="secondary"
            >
              {userMessage.action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Export specific error components for different use cases
export function InlineError({ error, retry }: { error: Error; retry?: () => void }) {
  return <ErrorMessage error={error} retry={retry} variant="inline" />;
}

export function CardError({ error, retry }: { error: Error; retry?: () => void }) {
  return <ErrorMessage error={error} retry={retry} variant="card" />;
}

export function FullPageError({ error, retry }: { error: Error; retry?: () => void }) {
  return <ErrorMessage error={error} retry={retry} variant="full" />;
}

// Info message component for non-error situations
export function InfoMessage({ 
  title, 
  description, 
  action,
  className 
}: { 
  title: string; 
  description: string; 
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200", className)}>
      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="font-semibold text-blue-900">{title}</h4>
        <p className="text-sm text-blue-700 mt-1">{description}</p>
        
        {action && (
          <Button
            onClick={action.onClick}
            size="sm"
            variant="secondary"
            className="mt-3"
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}