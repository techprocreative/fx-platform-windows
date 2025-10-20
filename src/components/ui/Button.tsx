"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useScreenReader } from "@/hooks/useKeyboardNavigation";

const variants = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-600",
  secondary: "border border-neutral-300 text-neutral-700 hover:bg-neutral-50 focus-visible:outline-neutral-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "h-9 w-9 p-0",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Keyboard shortcut for the button (e.g., "Ctrl+Enter") */
  shortcut?: string;
  /** Announce action to screen readers when clicked */
  announcement?: string;
  /** Whether button should be focusable when disabled */
  focusableWhenDisabled?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  children,
  shortcut,
  announcement,
  focusableWhenDisabled = false,
  onClick,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { announce } = useScreenReader();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    
    onClick?.(event);
    
    if (announcement) {
      announce(announcement);
    }
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        isDisabled && !focusableWhenDisabled && "pointer-events-none",
        className
      )}
      disabled={isDisabled && !focusableWhenDisabled}
      onClick={handleClick}
      aria-disabled={isDisabled}
      aria-describedby={shortcut ? `${props.id || 'button'}-shortcut` : undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
      
      {shortcut && (
        <span
          id={`${props.id || 'button'}-shortcut`}
          className="ml-2 text-xs opacity-60"
          aria-hidden="true"
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
