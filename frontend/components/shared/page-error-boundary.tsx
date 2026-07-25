"use client";

import { ErrorBoundary } from "./error-boundary";

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Client-side error boundary wrapper for use in server component layouts.
 * Wraps the main content area with ErrorBoundary configured with navigation options.
 */
export function PageErrorBoundary({ children }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary showNavigation={true}>
      {children}
    </ErrorBoundary>
  );
}
