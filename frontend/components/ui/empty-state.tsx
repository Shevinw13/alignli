import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Lucide icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Headline explaining why the area is empty */
  title: string;
  /** Supporting description */
  description?: string;
  /** Primary CTA button label */
  actionLabel?: string;
  /** Primary CTA click handler */
  onAction?: () => void;
  /** Secondary action label (e.g., "Clear filters") */
  secondaryLabel?: string;
  /** Secondary action handler */
  onSecondaryAction?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Empty state component displayed when a list or content area has no data.
 *
 * Centers content vertically and horizontally. The primary CTA uses Indigo styling.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-3">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex items-center gap-3">
          {actionLabel && onAction && (
            <Button
              variant="default"
              onClick={onAction}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button variant="ghost" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
