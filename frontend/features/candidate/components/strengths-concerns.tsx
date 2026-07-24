"use client";

import { ThumbsUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

interface Strength {
  text: string;
  evidence: string;
}

interface Concern {
  text: string;
  uncertaintyLevel: "High" | "Medium" | "Low";
}

interface StrengthsConcernsProps {
  strengths: Strength[];
  concerns: Concern[];
  strengthsError?: boolean;
  concernsError?: boolean;
  onRetryStrengths?: () => void;
  onRetryConcerns?: () => void;
}

function getUncertaintyBadge(level: Concern["uncertaintyLevel"]) {
  const styles: Record<Concern["uncertaintyLevel"], string> = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-green-50 text-green-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[level]
      )}
    >
      {level} uncertainty
    </span>
  );
}

/**
 * Strengths & Concerns section — evidence-based strengths (3–8)
 * with cited resume content, and concerns with uncertainty levels.
 *
 * Requirements 11.4, 11.5
 */
export function StrengthsConcerns({
  strengths,
  concerns,
  strengthsError = false,
  concernsError = false,
  onRetryStrengths,
  onRetryConcerns,
}: StrengthsConcernsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Strengths */}
      <SectionCard
        title="Strengths"
        icon={<ThumbsUp className="h-5 w-5" aria-hidden="true" />}
        error={strengthsError}
        onRetry={onRetryStrengths}
      >
        {strengths.length > 0 ? (
          <ul className="space-y-3" aria-label="Candidate strengths">
            {strengths.map((s, idx) => (
              <li key={idx} className="space-y-1">
                <p className="text-sm font-medium text-navy">{s.text}</p>
                <p className="text-xs text-muted-foreground italic">
                  Evidence: {s.evidence}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No strengths identified yet.
          </p>
        )}
      </SectionCard>

      {/* Concerns */}
      <SectionCard
        title="Concerns"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        error={concernsError}
        onRetry={onRetryConcerns}
      >
        {concerns.length > 0 ? (
          <ul className="space-y-3" aria-label="Candidate concerns">
            {concerns.map((c, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-2"
              >
                <p className="text-sm text-navy">{c.text}</p>
                {getUncertaintyBadge(c.uncertaintyLevel)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No concerns identified.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
