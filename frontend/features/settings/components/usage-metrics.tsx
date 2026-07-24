"use client";

import { cn } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  HardDrive,
  Sparkles,
  AlertTriangle,
  Ban,
} from "lucide-react";
import type { UsageMetric } from "../types";
import { METRIC_LABELS } from "../types";

interface UsageMetricsProps {
  metrics: UsageMetric[];
}

const METRIC_ICONS: Record<string, typeof FileText> = {
  resume_reviews: FileText,
  active_projects: FolderOpen,
  storage_mb: HardDrive,
  ai_credits: Sparkles,
};

function formatMetricValue(metric: string, value: number): string {
  if (value === -1) return "Unlimited";
  if (metric === "storage_mb") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} GB`;
    return `${value} MB`;
  }
  return value.toLocaleString();
}

function getProgressColor(metric: UsageMetric): string {
  if (metric.atLimit) return "bg-red-500";
  if (metric.atWarning) return "bg-amber-500";
  return "bg-indigo-500";
}

function getStatusIndicator(metric: UsageMetric) {
  if (metric.atLimit) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <Ban className="h-3 w-3" aria-hidden="true" />
        Limit reached
      </span>
    );
  }
  if (metric.atWarning) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        80% used
      </span>
    );
  }
  return null;
}

export function UsageMetrics({ metrics }: UsageMetricsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-navy">Usage This Period</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your consumption across plan limits.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.metric] ?? FileText;
          const label = METRIC_LABELS[metric.metric] ?? metric.metric;
          const isUnlimited = metric.limit === -1;
          const percentage = isUnlimited ? 0 : Math.min(metric.percentage, 100);

          return (
            <div
              key={metric.metric}
              className={cn(
                "rounded-[16px] border p-4",
                metric.atLimit
                  ? "border-red-200 bg-red-50/50"
                  : metric.atWarning
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-border bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-[8px]",
                      metric.atLimit
                        ? "bg-red-100"
                        : metric.atWarning
                          ? "bg-amber-100"
                          : "bg-indigo-50"
                    )}
                    aria-hidden="true"
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        metric.atLimit
                          ? "text-red-600"
                          : metric.atWarning
                            ? "text-amber-600"
                            : "text-indigo-600"
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium text-navy">{label}</span>
                </div>
                {getStatusIndicator(metric)}
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-navy">
                    {formatMetricValue(metric.metric, metric.used)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {formatMetricValue(metric.metric, metric.limit)}
                  </span>
                </div>

                {/* Progress bar */}
                {!isUnlimited && (
                  <div className="mt-2">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-valuenow={metric.used}
                      aria-valuemin={0}
                      aria-valuemax={metric.limit}
                      aria-label={`${label}: ${metric.used} of ${metric.limit} used`}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          getProgressColor(metric)
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      {metric.percentage.toFixed(1)}%
                    </p>
                  </div>
                )}

                {isUnlimited && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No limit on your current plan
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Read-only mode banner */}
      {metrics.some((m) => m.atLimit) && (
        <div
          className="flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4"
          role="alert"
          aria-live="polite"
        >
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Usage limit reached — read-only mode active
            </p>
            <p className="mt-1 text-sm text-red-700">
              One or more usage limits have been reached. New actions for exceeded
              capabilities are blocked. Existing data remains accessible. Upgrade
              your plan to resume full access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
