/**
 * Tooltip Component
 *
 * Provides accessible tooltips for technical terms and help text
 * following WCAG 2.1 AA guidelines.
 */

"use client";

import * as React from "react";
import { Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** Content to display in the tooltip */
  content: React.ReactNode;
  /** Trigger element */
  children?: React.ReactNode;
  /** Tooltip position */
  position?: "top" | "bottom" | "left" | "right";
  /** Tooltip variant */
  variant?: "default" | "help" | "info" | "warning";
  /** Whether to show an icon */
  showIcon?: boolean;
  /** Icon to display */
  icon?: "info" | "help";
  /** Custom className */
  className?: string;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Whether tooltip is controlled */
  open?: boolean;
  /** Callback when tooltip opens/closes */
  onOpenChange?: (open: boolean) => void;
}

const positionStyles = {
  top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
  left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
  right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
};

const arrowStyles = {
  top: "top-full left-1/2 transform -translate-x-1/2 -mt-1",
  bottom: "bottom-full left-1/2 transform -translate-x-1/2 -mb-1",
  left: "left-full top-1/2 transform -translate-y-1/2 -ml-1",
  right: "right-full top-1/2 transform -translate-y-1/2 -mr-1",
};

const variantStyles = {
  default: "bg-gray-900 text-white border-gray-700",
  help: "bg-blue-600 text-white border-blue-500",
  info: "bg-blue-500 text-white border-blue-400",
  warning: "bg-yellow-600 text-white border-yellow-500",
};

export function Tooltip({
  content,
  children,
  position = "top",
  variant = "default",
  showIcon = false,
  icon = "info",
  className,
  delay = 300,
  open: controlledOpen,
  onOpenChange,
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [isControlled, onOpenChange],
  );

  const showTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setOpen(true);
    }, delay);
  }, [delay, setOpen]);

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsVisible(false);
    setTimeout(() => {
      setOpen(false);
    }, 150); // Allow fade out animation
  }, [setOpen]);

  const handleMouseEnter = React.useCallback(() => {
    showTooltip();
  }, [showTooltip]);

  const handleMouseLeave = React.useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const handleFocus = React.useCallback(() => {
    showTooltip();
  }, [showTooltip]);

  const handleBlur = React.useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        hideTooltip();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(!open);
      }
    },
    [hideTooltip, open, setOpen],
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (open && tooltipRef.current && triggerRef.current) {
      // Position tooltip if needed
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const triggerRect = triggerRef.current.getBoundingClientRect();

      // Check if tooltip goes out of viewport and adjust if needed
      if (position === "top" && tooltipRect.top < 0) {
        // Switch to bottom if not enough space at top
        tooltipRef.current.style.top = "100%";
        tooltipRef.current.style.bottom = "auto";
      } else if (
        position === "bottom" &&
        tooltipRect.bottom > window.innerHeight
      ) {
        // Switch to top if not enough space at bottom
        tooltipRef.current.style.bottom = "100%";
        tooltipRef.current.style.top = "auto";
      }
    }
  }, [open, position]);

  const IconComponent = icon === "help" ? HelpCircle : Info;

  return (
    <div className="relative inline-flex">
      <div
        ref={triggerRef}
        className={cn("inline-flex items-center gap-1 cursor-help", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-describedby={open ? "tooltip-content" : undefined}
        aria-expanded={open}
      >
        {children}
        {showIcon && (
          <IconComponent
            className="h-4 w-4 text-current opacity-60"
            aria-hidden="true"
          />
        )}
      </div>

      {open && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 px-3 py-2 text-sm rounded-lg border shadow-lg max-w-xs transition-all duration-150",
            positionStyles[position],
            variantStyles[variant],
            isVisible
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none",
          )}
          role="tooltip"
          id="tooltip-content"
        >
          <div className="relative">
            {content}
            <div
              className={cn(
                "absolute w-0 h-0 border-4 border-transparent",
                arrowStyles[position],
                variant === "default" && "border-t-gray-900",
                variant === "help" && "border-t-blue-600",
                variant === "info" && "border-t-blue-500",
                variant === "warning" && "border-t-yellow-600",
              )}
              style={{
                [position === "top"
                  ? "borderBottomColor"
                  : position === "bottom"
                    ? "borderTopColor"
                    : position === "left"
                      ? "borderRightColor"
                      : "borderLeftColor"]:
                  variant === "default"
                    ? "rgb(17 24 39)"
                    : variant === "help"
                      ? "rgb(37 99 235)"
                      : variant === "info"
                        ? "rgb(59 130 246)"
                        : "rgb(217 119 6)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TechnicalTermTooltip component for financial/trading terms
 */
interface TechnicalTermTooltipProps {
  /** The technical term */
  term: string;
  /** Definition of the term */
  definition: string;
  /** Additional context or examples */
  context?: string;
  /** Whether to show the term as children */
  showTerm?: boolean;
  /** Custom className */
  className?: string;
}

export function TechnicalTermTooltip({
  term,
  definition,
  context,
  showTerm = true,
  className,
}: TechnicalTermTooltipProps) {
  const content = (
    <div className="space-y-2">
      <p className="font-semibold">{term}</p>
      <p className="text-sm">{definition}</p>
      {context && <p className="text-xs opacity-90 italic">{context}</p>}
    </div>
  );

  return (
    <Tooltip
      content={content}
      variant="help"
      showIcon={!showTerm}
      className={className}
    >
      {showTerm ? (
        <span className="border-b border-dotted border-blue-500 text-blue-600 hover:text-blue-700 cursor-help">
          {term}
        </span>
      ) : (
        <HelpCircle className="h-4 w-4 text-blue-500" />
      )}
    </Tooltip>
  );
}

/**
 * GlossaryTooltip component that connects to a glossary system
 */
interface GlossaryTooltipProps {
  /** Term identifier */
  termId: string;
  /** Override term display */
  term?: string;
  /** Custom className */
  className?: string;
}

export function GlossaryTooltip({
  termId,
  term,
  className,
}: GlossaryTooltipProps) {
  const [termData, setTermData] = React.useState<{
    term: string;
    definition: string;
    context?: string;
    examples?: string[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Import and use the glossary
    const fetchTermData = async () => {
      try {
        // Glossary system removed during simplification
        // Using fallback data instead
        const data = {
          term: termId,
          definition: `Definition for ${termId}`,
          category: "trading",
          context: undefined,
          examples: [],
        };

        if (data) {
          setTermData({
            term: data.term,
            definition: data.definition,
            context: data.context || undefined,
            examples: data.examples || [],
          });
        } else {
          setTermData({
            term: term || termId,
            definition: "Definition not found in glossary.",
            examples: [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch glossary term:", error);
        setTermData({
          term: term || termId,
          definition: "Unable to load definition.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTermData();
  }, [termId, term]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600">
        <span
          className={cn("border-b border-dotted border-blue-500", className)}
        >
          {term || termId}
        </span>
        <div className="h-4 w-4 animate-spin rounded-full border border-blue-600 border-t-transparent" />
      </span>
    );
  }

  if (!termData) {
    return (
      <span
        className={cn(
          "border-b border-dotted border-gray-400 text-gray-600",
          className,
        )}
      >
        {term || termId}
      </span>
    );
  }

  const content = (
    <div className="space-y-2">
      <p className="font-semibold">{termData.term}</p>
      <p className="text-sm">{termData.definition}</p>
      {termData.context && (
        <p className="text-xs opacity-90 italic">{termData.context}</p>
      )}
      {termData.examples && termData.examples.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
          <p className="text-xs font-medium mb-1">Examples:</p>
          <ul className="text-xs space-y-1">
            {termData.examples.map((example, index) => (
              <li key={index} className="opacity-80">
                • {example}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={content} variant="help" className={className}>
      <span className="border-b border-dotted border-blue-500 text-blue-600 hover:text-blue-700 cursor-help">
        {term || termId}
      </span>
    </Tooltip>
  );
}
