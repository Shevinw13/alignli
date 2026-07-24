"use client";

import { Brain } from "lucide-react";
import { SectionCard } from "./section-card";

interface AISummarySectionProps {
  summary: string | null;
  error?: boolean;
  onRetry?: () => void;
}

/**
 * AI Summary section — displays the 150–250 word narrative summary
 * answering: who the candidate is, what makes them qualified,
 * what concerns exist, and whether they should interview.
 *
 * Requirement 11.2
 */
export function AISummarySection({
  summary,
  error = false,
  onRetry,
}: AISummarySectionProps) {
  return (
    <SectionCard
      title="AI Summary"
      icon={<Brain className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No summary available yet. This will be generated once resume
          processing is complete.
        </p>
      )}
    </SectionCard>
  );
}
