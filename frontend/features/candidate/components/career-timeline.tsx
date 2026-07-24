"use client";

import { Clock } from "lucide-react";
import { SectionCard } from "./section-card";

interface TimelineEntry {
  title: string;
  company: string;
  startDate: string;
  endDate: string | null;
  description?: string;
}

interface CareerTimelineProps {
  entries: TimelineEntry[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Career Timeline — visual timeline of work experience.
 * Displays entries chronologically with connecting line.
 *
 * Requirement 11.1
 */
export function CareerTimeline({
  entries,
  error = false,
  onRetry,
}: CareerTimelineProps) {
  return (
    <SectionCard
      title="Career Timeline"
      icon={<Clock className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {entries.length > 0 ? (
        <ol className="relative border-l-2 border-indigo-100 pl-6 space-y-6" aria-label="Career timeline">
          {entries.map((entry, idx) => (
            <li key={idx} className="relative">
              {/* Timeline dot */}
              <div
                className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-indigo-400 bg-white"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-navy">
                    {entry.title}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    at {entry.company}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.startDate} – {entry.endDate ?? "Present"}
                </p>
                {entry.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {entry.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No career timeline data available.
        </p>
      )}
    </SectionCard>
  );
}
