"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI when an error occurs */
  fallback?: React.ReactNode;
  /** Whether to show navigation controls (Go Home, Go Back). Defaults to true */
  showNavigation?: boolean;
  /** Retry callback — re-renders children by resetting error state */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * React error boundary that catches render-time errors in its child tree.
 *
 * Renders a user-friendly fallback with:
 * - AlertCircle icon (red)
 * - Plain-language message
 * - Retry button
 * - Go Home link
 * - Go Back button
 *
 * Never exposes stack traces or technical identifiers to users.
 * Logs error details to console in development only.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log only in development — never expose to users
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  handleGoBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback takes full control of rendering
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showNavigation = this.props.showNavigation ?? true;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="mb-4 rounded-full bg-error-bg p-3">
            <AlertCircle className="size-6 text-red-500" />
          </div>

          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Please try again or navigate back to
            continue.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="default"
              onClick={this.handleRetry}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Retry
            </Button>

            {showNavigation && (
              <>
                <Button variant="ghost" onClick={this.handleGoBack}>
                  Go Back
                </Button>
                <Button
                  variant="ghost"
                  render={<a href="/" />}
                >
                  Go Home
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
