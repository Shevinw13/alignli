"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  error?: boolean;
  onRetry?: () => void;
  headingId?: string;
}

export function SectionCard({
  title,
  icon,
  children,
  error = false,
  onRetry,
  headingId,
}: SectionCardProps) {
  const id = headingId ?? `section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section
      className={cn(
        "rounded-[16px] border border-border bg-white p-6",
        "transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
      )}
      aria-labelledby={id}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600">
            {icon}
          </div>
          <h2 id={id} className="text-lg font-semibold text-navy">
            {title}
          </h2>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-red-50 p-4">
          <AlertCircle
            className="h-5 w-5 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">
              Unable to generate {title}
            </p>
            <p className="mt-0.5 text-sm text-red-600">
              This section failed to generate. Please try again.
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {!error && <div className="mt-4">{children}</div>}
    </section>
  );
}
