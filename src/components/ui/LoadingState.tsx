import { LoadingSpinner } from './LoadingSpinner';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton';
  message?: string;
  className?: string;
  skeletonCount?: number;
}

export function LoadingState({ 
  type = 'spinner', 
  message = 'Loading...', 
  className,
  skeletonCount = 3
}: LoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <div className="flex flex-col items-center gap-3">
        {type === 'skeleton' ? (
          <div className="w-full max-w-md space-y-3">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <Skeleton key={i} className={cn(
                i === 0 && "h-8 w-3/4",
                i === 1 && "h-4 w-full",
                i === 2 && "h-4 w-2/3"
              )} />
            ))}
          </div>
        ) : (
          <LoadingSpinner size="lg" />
        )}
        {message && (
          <span className="text-sm text-neutral-600 animate-pulse">{message}</span>
        )}
      </div>
    </div>
  );
}

// Export specific loading components for different use cases
export function TableLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingState 
        type="spinner" 
        message="Loading data..." 
      />
    </div>
  );
}

export function CardLoadingState() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <LoadingState 
        type="skeleton" 
        skeletonCount={4}
      />
    </div>
  );
}

export function PageLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-96">
      <LoadingState 
        type="spinner" 
        message="Loading page..." 
        className="min-h-96"
      />
    </div>
  );
}