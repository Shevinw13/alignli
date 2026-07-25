"use client";

import { Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AISuggestionCardProps {
  /** The suggestion text to display */
  suggestion: string;
  /** Optional title (defaults to "AI Suggestion") */
  title?: string;
  /** Whether the card is dismissible */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action callback */
  onAction?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * A gentle callout card for contextual AI suggestions.
 * Uses a Lightbulb icon and warm styling to communicate helpful suggestions
 * without being intrusive.
 */
export function AISuggestionCard({
  suggestion,
  title = "AI Suggestion",
  dismissible = true,
  onDismiss,
  actionLabel,
  onAction,
  className,
}: AISuggestionCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      className={cn(
        "rounded-[12px] border border-amber-200 bg-amber-50/50 p-4",
        className
      )}
      role="complementary"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-navy">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {suggestion}
          </p>

          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 interactive"
            >
              {actionLabel}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-amber-100 hover:text-amber-700 interactive"
            aria-label="Dismiss suggestion"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
