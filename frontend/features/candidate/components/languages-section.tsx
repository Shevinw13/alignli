"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

interface LanguageEntry {
  language: string;
  proficiency: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic";
}

interface LanguagesSectionProps {
  languages: LanguageEntry[];
  error?: boolean;
  onRetry?: () => void;
}

function getProficiencyColor(proficiency: LanguageEntry["proficiency"]): string {
  switch (proficiency) {
    case "Native":
      return "bg-emerald-50 text-emerald-700";
    case "Fluent":
      return "bg-blue-50 text-blue-700";
    case "Advanced":
      return "bg-indigo-50 text-indigo-700";
    case "Intermediate":
      return "bg-amber-50 text-amber-700";
    case "Basic":
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Languages section — spoken languages with proficiency levels.
 *
 * Requirement 11.1
 */
export function LanguagesSection({
  languages,
  error = false,
  onRetry,
}: LanguagesSectionProps) {
  return (
    <SectionCard
      title="Languages"
      icon={<Languages className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {languages.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {languages.map((lang, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-[8px] border border-gray-100 px-3 py-2"
            >
              <span className="text-sm font-medium text-navy">
                {lang.language}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  getProficiencyColor(lang.proficiency)
                )}
              >
                {lang.proficiency}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No language data available.
        </p>
      )}
    </SectionCard>
  );
}
