"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * Global Error Boundary Component
 * Catches React rendering errors and displays a user-friendly fallback UI
 *
 * Features:
 * - Error ID generation for support tracking
 * - Retry and redirect options
 * - Design system styled with charcoal + amber theme
 * - Sentry-ready error logging integration point
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for support tracking
    const errorId = `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging (Sentry integration point)
    console.error("ErrorBoundary caught error:", {
      errorId: this.state.errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      section: this.props.section,
    });

    // TODO: Send to error tracking service (Sentry, etc.)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: { errorId: this.state.errorId } });
    // }
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null, errorId: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/sessions";
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[var(--oj-danger-muted)] flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-[var(--oj-danger)]" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-[var(--oj-text-primary)]">
                  Something went wrong
                </h3>
                <p className="mt-2 text-sm text-[var(--oj-text-secondary)]">
                  {this.props.section
                    ? `There was a problem loading the ${this.props.section}.`
                    : "There was a problem loading this section."}
                </p>

                {/* Error ID for support */}
                {this.state.errorId && (
                  <p className="mt-3 text-xs text-[var(--oj-text-muted)] font-mono">
                    Error ID: {this.state.errorId}
                  </p>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleReset}
                    className="border-[var(--oj-border)] text-[var(--oj-text-primary)] hover:bg-[var(--oj-surface-2)]"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleReload}
                    className="border-[var(--oj-border)] text-[var(--oj-text-primary)] hover:bg-[var(--oj-surface-2)]"
                  >
                    Reload Page
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={this.handleGoHome}
                    className="bg-[var(--oj-accent)] text-black hover:bg-[var(--oj-accent-hover)]"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Go to Sessions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-level error boundary wrapper
 * Use this to wrap specific sections of the app independently
 */
export function SectionErrorBoundary({
  children,
  section,
}: {
  children: ReactNode;
  section: string;
}) {
  return (
    <ErrorBoundary section={section}>
      {children}
    </ErrorBoundary>
  );
}
