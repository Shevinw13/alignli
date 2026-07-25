"use client";

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** Value 0–100 */
  value: number;
  /** Ring size in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Whether to animate on mount */
  animated?: boolean;
  /** Show numeric label inside */
  showLabel?: boolean;
  /** Semantic color based on value thresholds */
  semanticColor?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * SVG-based progress ring component.
 *
 * Displays a circular progress indicator with semantic coloring:
 * - Emerald (>80%): success
 * - Amber (50–80%): warning
 * - Red (<50%): critical
 *
 * Uses the `.animate-fill` utility class for mount animation.
 * Respects prefers-reduced-motion via CSS (animation disabled).
 */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 4,
  animated = true,
  showLabel = true,
  semanticColor = true,
  className,
}: ProgressRingProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  const getColor = () => {
    if (!semanticColor) return "text-indigo-600";
    if (clampedValue > 80) return "text-emerald-500";
    if (clampedValue >= 50) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clampedValue}% progress`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? circumference : offset}
          className={cn(
            getColor(),
            animated && "animate-fill"
          )}
          style={
            {
              "--circumference": `${circumference}`,
              "--fill-offset": `${offset}`,
            } as React.CSSProperties
          }
        />
      </svg>

      {showLabel && (
        <span className="absolute text-xs font-semibold text-foreground">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}
