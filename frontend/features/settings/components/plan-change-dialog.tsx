"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessibleDialog } from "@/components/shared/accessible-dialog";
import type { PlanTier, UsageMetric } from "../types";
import { PLAN_CONFIGS, METRIC_LABELS } from "../types";

interface PlanChangeDialogProps {
  open: boolean;
  onClose: () => void;
  currentPlan: PlanTier;
  targetPlan: PlanTier;
  currentMetrics: UsageMetric[];
  onConfirm: (acknowledge: boolean) => void;
  isLoading?: boolean;
}

const PLAN_ORDER: PlanTier[] = ["starter", "professional", "business", "enterprise"];

function isUpgrade(current: PlanTier, target: PlanTier): boolean {
  return PLAN_ORDER.indexOf(target) > PLAN_ORDER.indexOf(current);
}

function getExceedingMetrics(
  targetPlan: PlanTier,
  currentMetrics: UsageMetric[]
): string[] {
  const targetConfig = PLAN_CONFIGS.find((c) => c.tier === targetPlan);
  if (!targetConfig) return [];

  const warnings: string[] = [];
  for (const metric of currentMetrics) {
    const targetLimit = targetConfig.limits[metric.metric as keyof typeof targetConfig.limits];
    if (targetLimit !== undefined && targetLimit !== -1 && metric.used > targetLimit) {
      const label = METRIC_LABELS[metric.metric] ?? metric.metric;
      warnings.push(
        `${label}: currently using ${metric.used}, target plan limit is ${targetLimit}`
      );
    }
  }
  return warnings;
}

export function PlanChangeDialog({
  open,
  onClose,
  currentPlan,
  targetPlan,
  currentMetrics,
  onConfirm,
  isLoading = false,
}: PlanChangeDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const upgrade = isUpgrade(currentPlan, targetPlan);
  const targetConfig = PLAN_CONFIGS.find((c) => c.tier === targetPlan);
  const currentConfig = PLAN_CONFIGS.find((c) => c.tier === currentPlan);

  const exceedingMetrics = !upgrade ? getExceedingMetrics(targetPlan, currentMetrics) : [];
  const hasWarnings = exceedingMetrics.length > 0;

  if (!targetConfig || !currentConfig) return null;

  const title = upgrade ? "Upgrade Plan" : "Downgrade Plan";
  const description = upgrade
    ? "Your new plan will take effect immediately with prorated billing."
    : "Your downgrade will take effect at the end of your current billing cycle.";

  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="space-y-4">
        {/* Plan comparison */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-[12px] border border-border bg-gray-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="mt-1 text-sm font-semibold text-navy">{currentConfig.name}</p>
            <p className="text-xs text-muted-foreground">
              {currentConfig.price === -1 ? "Custom" : `$${currentConfig.price}/mo`}
            </p>
          </div>

          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              upgrade ? "bg-emerald-100" : "bg-amber-100"
            )}
            aria-hidden="true"
          >
            {upgrade ? (
              <ArrowUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowDown className="h-4 w-4 text-amber-600" />
            )}
          </div>

          <div className="flex-1 rounded-[12px] border border-indigo-200 bg-indigo-50 p-3 text-center">
            <p className="text-xs text-indigo-600">New Plan</p>
            <p className="mt-1 text-sm font-semibold text-navy">{targetConfig.name}</p>
            <p className="text-xs text-muted-foreground">
              {targetConfig.price === -1 ? "Custom" : `$${targetConfig.price}/mo`}
            </p>
          </div>
        </div>

        {/* New plan limits */}
        <div className="rounded-[12px] border border-border bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {targetConfig.name} Plan Includes
          </p>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(targetConfig.limits).map(([key, value]) => (
              <li key={key} className="flex items-center gap-2 text-sm text-navy">
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                {value === -1 ? "Unlimited" : value.toLocaleString()}{" "}
                {METRIC_LABELS[key] ?? key}
              </li>
            ))}
          </ul>
        </div>

        {/* Downgrade warnings */}
        {hasWarnings && (
          <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Current usage exceeds target plan limits
                </p>
                <ul className="mt-2 space-y-1">
                  {exceedingMetrics.map((warning) => (
                    <li key={warning} className="text-sm text-amber-700">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-700">
                I understand that usage exceeding the new plan limits may be
                restricted after the downgrade takes effect.
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[12px] border border-border bg-white px-4 text-sm font-medium text-navy hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(acknowledged)}
            disabled={isLoading || (hasWarnings && !acknowledged)}
            className={cn(
              "h-9 rounded-[12px] px-4 text-sm font-medium text-white",
              upgrade
                ? "bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                : "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
            )}
          >
            {isLoading
              ? "Processing..."
              : upgrade
                ? "Confirm Upgrade"
                : "Confirm Downgrade"}
          </Button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
