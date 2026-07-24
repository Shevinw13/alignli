"use client";

import { GraduationCap } from "lucide-react";
import { SectionCard } from "./section-card";

interface EducationEntry {
  degree: string;
  field: string;
  institution: string;
  graduationYear: string;
  gpa?: string;
  honors?: string;
}

interface EducationSectionProps {
  entries: EducationEntry[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Education section — degrees, institutions, and academic achievements.
 *
 * Requirement 11.1
 */
export function EducationSection({
  entries,
  error = false,
  onRetry,
}: EducationSectionProps) {
  return (
    <SectionCard
      title="Education"
      icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <h3 className="text-sm font-semibold text-navy">
                {entry.degree} in {entry.field}
              </h3>
              <p className="text-sm text-muted-foreground">
                {entry.institution} · {entry.graduationYear}
              </p>
              {(entry.gpa || entry.honors) && (
                <div className="mt-1 flex flex-wrap gap-3">
                  {entry.gpa && (
                    <span className="text-xs text-muted-foreground">
                      GPA: {entry.gpa}
                    </span>
                  )}
                  {entry.honors && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {entry.honors}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No education data available.
        </p>
      )}
    </SectionCard>
  );
}
