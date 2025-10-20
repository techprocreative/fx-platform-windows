"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

interface ErrorReport {
  errorId: string;
  message: string;
  stack: string;
  componentStack: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorId: null };

  private retryCount = 0;
  private maxRetries = 3;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log to console in development
    if (process.env.NODE_ENV !== "production") {
      console.error("[UI_ERROR]", error, info);
    }

    // Create error report
    const errorReport: ErrorReport = {
      errorId: this.state.errorId || 'unknown',
      message: error.message,
      stack: error.stack || 'No stack trace available',
      componentStack: info.componentStack || 'No component stack available',
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
    };

    // Add user context if available
    this.addUserContext(errorReport);

    // Report error to monitoring systems
    this.reportError(errorReport);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  /**
   * Add user context to error report
   */
  private addUserContext(errorReport: ErrorReport): void {
    try {
      // Try to get user information from localStorage or other sources
      if (typeof window !== 'undefined') {
        const userInfo = localStorage.getItem('user');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          errorReport.userId = user.id;
        }

        // Get session ID if available
        const sessionId = sessionStorage.getItem('sessionId');
        if (sessionId) {
          errorReport.sessionId = sessionId;
        }
      }
    } catch (e) {
      console.warn('Failed to add user context to error report:', e);
    }
  }

  /**
   * Report error to monitoring systems
   */
  private async reportError(errorReport: ErrorReport): Promise<void> {
    try {
      // Report to console in development
      if (process.env.NODE_ENV === "development") {
        console.group(`🚨 Error Report: ${errorReport.errorId}`);
        console.error('Error:', errorReport.message);
        console.error('Stack:', errorReport.stack);
        console.error('Component Stack:', errorReport.componentStack);
        console.error('User Agent:', errorReport.userAgent);
        console.error('URL:', errorReport.url);
        console.groupEnd();
        return;
      }

      // Report to monitoring service in production
      await Promise.allSettled([
        this.reportToBackend(errorReport),
        this.reportToExternalService(errorReport),
      ]);

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Report error to backend API
   */
  private async reportToBackend(errorReport: ErrorReport): Promise<void> {
    try {
      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
      });

      if (!response.ok) {
        console.warn('Failed to report error to backend:', response.statusText);
      }
    } catch (error) {
      console.warn('Network error while reporting to backend:', error);
    }
  }

  /**
   * Report error to external monitoring service (e.g., Sentry, LogRocket)
   */
  private async reportToExternalService(errorReport: ErrorReport): Promise<void> {
    // Integration with external monitoring services can be added here
    // For now, we'll just log to console in production
    
    if (process.env.NODE_ENV === "production") {
      console.group(`🚨 Production Error: ${errorReport.errorId}`);
      console.error('Error Details:', errorReport);
      console.groupEnd();
    }

    // Example Sentry integration (when Sentry is added):
    // if (window.Sentry) {
    //   window.Sentry.captureException(new Error(errorReport.message), {
    //     tags: {
    //       errorId: errorReport.errorId,
    //       component: 'ErrorBoundary',
    //     },
    //     extra: errorReport,
    //   });
    // }
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorId: null });
    this.retryCount = 0;
    window.location.reload();
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: null, errorId: null });
    }
  };

  private copyErrorDetails = async () => {
    if (this.state.error && this.state.errorId) {
      const errorDetails = `
Error ID: ${this.state.errorId}
Message: ${this.state.error.message}
Timestamp: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'Unknown'}

Stack Trace:
${this.state.error.stack}
      `.trim();

      try {
        await navigator.clipboard.writeText(errorDetails);
        alert('Error details copied to clipboard');
      } catch (error) {
        console.error('Failed to copy error details:', error);
      }
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const canRetry = this.retryCount < this.maxRetries;

    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <span>⚠️</span>
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-600">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            
            {process.env.NODE_ENV === "development" && this.state.error?.stack && (
              <details className="mt-2">
                <summary className="text-xs text-neutral-500 cursor-pointer">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-neutral-100 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="text-xs text-neutral-500">
              Error ID: {this.state.errorId}
            </div>

            <div className="flex flex-col gap-2">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  className="w-full"
                >
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </Button>
              )}
              
              <Button onClick={this.handleReload} className="w-full">
                Reload Page
              </Button>
              
              <Button
                onClick={this.copyErrorDetails}
                className="w-full"
              >
                Copy Error Details
              </Button>
            </div>

            <div className="text-xs text-neutral-400 text-center">
              If this problem persists, please contact support with the Error ID above.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
