import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-12 w-12 border-4",
} as const;

interface LoadingSpinnerProps {
  size?: keyof typeof sizes;
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center" aria-live="polite" aria-busy>
      <div
        className={cn(
          "animate-spin rounded-full border-primary-600 border-t-transparent",
          sizes[size],
          className
        )}
      />
    </div>
  );
}
