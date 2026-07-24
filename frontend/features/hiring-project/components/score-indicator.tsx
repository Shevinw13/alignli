"use client";

import { cn } from "@/lib/utils";
import { scoreColor, type ScoreColor } from "@/lib/utils/score-color";

/**
 * Color class mappings for the circular score indicator.
 * Green (#10B981) for 95-100, Blue (#4F46E5) for 80-94,
 * Amber (#F59E0B) for 65-79, Gray (#6B7280) for <65.
 */
const scoreColorClasses: Record<ScoreColor, { ring: string; text: string; bg: string }> = {
  green: {
    ring: "text-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  blue: {
    ring: "text-indigo-600",
    text: "text-indigo-700",
    bg: "bg-indigo-50",
  },
  amber: {
    ring: "text-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  gray: {
    ring: "text-gray-400",
    text: "text-gray-600",
    bg: "bg-gray-50",
  },
};

interface ScoreIndicatorProps {
  /** Match score value between 0-100 */
  score: number;
}

/**
 * Circular progress indicator displaying Match_Score with color coding.
 *
 * Requirements: 10.3
 */
export function ScoreIndicator({ score }: ScoreIndicatorProps) {
  const color = scoreColor(score);
  const classes = scoreColorClasses[color];

  // SVG circular progress calculation
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" aria-label={`Match score: ${score}`}>
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        {/* Background ring */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-100"
        />
        {/* Progress ring */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={classes.ring}
        />
      </svg>
      <span className={cn("absolute text-sm font-semibold", classes.text)}>
        {score}
      </span>
    </div>
  );
}
