"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingWrapperProps {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Skeleton fallback to show while loading */
  skeleton: React.ReactNode;
  /** The actual content to render when not loading */
  children: React.ReactNode;
  /** Additional class names for the wrapper */
  className?: string;
}

/**
 * Wraps content with a loading skeleton state.
 * Shows a reassurance message when loading exceeds 5 seconds.
 * Disables interactive elements within the skeleton view.
 */
export function LoadingWrapper({
  isLoading,
  skeleton,
  children,
  className,
}: LoadingWrapperProps) {
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowReassurance(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowReassurance(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)} aria-busy="true">
      {/* Skeleton content with pointer-events disabled */}
      <div className="pointer-events-none select-none">
        {skeleton}
      </div>

      {/* Reassurance message — appears after 5 seconds */}
      {showReassurance && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground animate-in-up">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Still loading — this may take a moment…</span>
        </div>
      )}
    </div>
  );
}

// --- Inline Spinner ---

interface InlineSpinnerProps {
  /** Size in pixels (16–24px recommended) */
  size?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Small inline spinner for button-level loading states (16–24px).
 */
export function InlineSpinner({ size = 16, className }: InlineSpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-current", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
