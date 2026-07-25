"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NetworkErrorCardProps {
  /** Brief explanation of what happened */
  title?: string;
  /** Suggestion for the user */
  description?: string;
  /** Retry handler */
  onRetry?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Inline error card for network failures in data-fetching contexts.
 * Displays a clear explanation, suggestion, and retry button.
 */
export function NetworkErrorCard({
  title = "Unable to load data",
  description = "Please check your internet connection and try again.",
  onRetry,
  className,
}: NetworkErrorCardProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[16px] border border-red-100 bg-red-50/50 px-6 py-10 text-center ${className ?? ""}`}
      role="alert"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
        <WifiOff className="h-5 w-5 text-red-500" aria-hidden="true" />
      </div>

      <h3 className="text-sm font-semibold text-foreground">{title}</h3>

      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
        {description}
      </p>

      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 gap-1.5 text-red-600 hover:bg-red-100 hover:text-red-700"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try Again
        </Button>
      )}
    </div>
  );
}
