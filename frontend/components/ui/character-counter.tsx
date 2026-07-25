import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  /** Current character count */
  current: number;
  /** Maximum allowed characters */
  max: number;
  /** Additional class names */
  className?: string;
}

/**
 * Character counter component.
 *
 * Displays "X / Y" remaining characters below a text input.
 * Turns Amber at 90% capacity and Red at 100%.
 */
export function CharacterCounter({
  current,
  max,
  className,
}: CharacterCounterProps) {
  const ratio = max > 0 ? current / max : 0;

  const colorClass =
    ratio >= 1
      ? "text-red-500"
      : ratio >= 0.9
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <span
      className={cn("text-xs tabular-nums", colorClass, className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {current} / {max}
    </span>
  );
}
