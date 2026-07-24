"use client";

import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

interface SkillCategory {
  category: string;
  skills: string[];
}

interface SkillsSectionProps {
  categories: SkillCategory[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Skills section — grouped by category with pill-style tags.
 *
 * Requirement 11.1
 */
export function SkillsSection({
  categories,
  error = false,
  onRetry,
}: SkillsSectionProps) {
  const hasSkills = categories.length > 0 && categories.some((c) => c.skills.length > 0);

  return (
    <SectionCard
      title="Skills"
      icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {hasSkills ? (
        <div className="space-y-4">
          {categories.map((cat, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat.category}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label={`${cat.category} skills`}>
                {cat.skills.map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    role="listitem"
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1",
                      "bg-indigo-50 text-xs font-medium text-indigo-700"
                    )}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No skills data available.
        </p>
      )}
    </SectionCard>
  );
}
