"use client";

import { Award } from "lucide-react";
import { SectionCard } from "./section-card";

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

interface CertificationsSectionProps {
  certifications: Certification[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Certifications section — professional certifications and credentials.
 *
 * Requirement 11.1
 */
export function CertificationsSection({
  certifications,
  error = false,
  onRetry,
}: CertificationsSectionProps) {
  return (
    <SectionCard
      title="Certifications"
      icon={<Award className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {certifications.length > 0 ? (
        <div className="space-y-3">
          {certifications.map((cert, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-navy">{cert.name}</p>
                <p className="text-xs text-muted-foreground">{cert.issuer}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {cert.year}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No certifications listed.
        </p>
      )}
    </SectionCard>
  );
}
