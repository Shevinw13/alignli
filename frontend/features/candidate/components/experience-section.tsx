"use client";

import { Briefcase } from "lucide-react";
import { SectionCard } from "./section-card";

interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  description: string;
  achievements: string[];
}

interface ExperienceSectionProps {
  entries: ExperienceEntry[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Experience section — detailed work experience with descriptions
 * and key achievements.
 *
 * Requirement 11.1
 */
export function ExperienceSection({
  entries,
  error = false,
  onRetry,
}: ExperienceSectionProps) {
  return (
    <SectionCard
      title="Experience"
      icon={<Briefcase className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {entries.length > 0 ? (
        <div className="space-y-6">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="border-b border-gray-100 pb-5 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-navy">
                    {entry.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {entry.company} · {entry.location}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {entry.startDate} – {entry.endDate ?? "Present"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </p>
              {entry.achievements.length > 0 && (
                <ul className="mt-2 space-y-1" aria-label={`Achievements at ${entry.company}`}>
                  {entry.achievements.map((achievement, aIdx) => (
                    <li
                      key={aIdx}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No experience data available.
        </p>
      )}
    </SectionCard>
  );
}
