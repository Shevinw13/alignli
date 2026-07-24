"use client";

import { Trophy } from "lucide-react";
import { SectionCard } from "./section-card";

interface AwardEntry {
  title: string;
  issuer: string;
  year: string;
}

interface AwardsSectionProps {
  awards: AwardEntry[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Awards section — honors and recognitions.
 *
 * Requirement 11.1
 */
export function AwardsSection({
  awards,
  error = false,
  onRetry,
}: AwardsSectionProps) {
  return (
    <SectionCard
      title="Awards"
      icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {awards.length > 0 ? (
        <div className="space-y-3">
          {awards.map((award, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-navy">{award.title}</p>
                <p className="text-xs text-muted-foreground">{award.issuer}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {award.year}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No awards listed.
        </p>
      )}
    </SectionCard>
  );
}
