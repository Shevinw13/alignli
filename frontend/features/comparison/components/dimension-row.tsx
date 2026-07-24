"use client";

import { cn } from "@/lib/utils";
import type { ComparisonCandidate, DimensionKey } from "./types";

interface DimensionRowProps {
  dimensionKey: DimensionKey;
  dimensionLabel: string;
  candidates: ComparisonCandidate[];
}

export function DimensionRow({
  dimensionKey,
  dimensionLabel,
  candidates,
}: DimensionRowProps) {
  return (
    <div
      className="grid items-center gap-3 border-b border-border py-3 last:border-b-0"
      style={{ gridTemplateColumns: `180px repeat(${candidates.length}, 1fr)` }}
    >
      {/* Label column */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{dimensionLabel}</p>
      </div>

      {/* Value columns */}
      {candidates.map((candidate) => {
        const dimension = candidate.dimensions.find(
          (d) => d.key === dimensionKey
        );
        const value = dimension?.value ?? null;

        return (
          <div key={candidate.id} className="flex items-center justify-center">
            {value !== null ? (
              <p className="text-sm text-muted-foreground text-center line-clamp-2">
                {value}
              </p>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5",
                  "bg-gray-50 text-xs text-muted-foreground italic"
                )}
              >
                No data
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
