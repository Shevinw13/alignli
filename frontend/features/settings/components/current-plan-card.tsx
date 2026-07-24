"use client";

import { cn } from "@/lib/utils";
import { CreditCard, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import type { SubscriptionPlan, PlanTier } from "../types";
import { PLAN_CONFIGS } from "../types";

interface CurrentPlanCardProps {
  plan: SubscriptionPlan;
  onManagePayment: () => void;
}

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  active: { label: "Active", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  past_due: { label: "Past Due", style: "bg-amber-50 text-amber-700 border-amber-200" },
  canceled: { label: "Canceled", style: "bg-gray-50 text-gray-700 border-gray-200" },
  incomplete: { label: "Incomplete", style: "bg-amber-50 text-amber-700 border-amber-200" },
  trialing: { label: "Trial", style: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  grace_period: { label: "Grace Period", style: "bg-amber-50 text-amber-700 border-amber-200" },
  read_only: { label: "Read Only", style: "bg-red-50 text-red-700 border-red-200" },
};

function getPlanName(tier: PlanTier): string {
  const config = PLAN_CONFIGS.find((c) => c.tier === tier);
  return config?.name ?? tier;
}

function getPlanPrice(tier: PlanTier): string {
  const config = PLAN_CONFIGS.find((c) => c.tier === tier);
  if (!config || config.price === -1) return "Custom";
  return `$${config.price}/mo`;
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function CurrentPlanCard({ plan, onManagePayment }: CurrentPlanCardProps) {
  const statusConfig = STATUS_STYLES[plan.status] ?? STATUS_STYLES.active;
  const isWarningStatus = ["past_due", "grace_period", "read_only"].includes(plan.status);

  return (
    <div className="rounded-[16px] border border-border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-navy">
              {getPlanName(plan.planId)} Plan
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                statusConfig.style
              )}
            >
              {isWarningStatus ? (
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
              )}
              {statusConfig.label}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-navy">
            {getPlanPrice(plan.planId)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>
            Current period: {formatDate(plan.currentPeriodStart)} –{" "}
            {formatDate(plan.currentPeriodEnd)}
          </span>
        </div>
      </div>

      {/* Grace period warning */}
      {plan.status === "grace_period" && plan.gracePeriodEnd && (
        <div
          className="mt-4 flex items-start gap-2 rounded-[8px] border border-amber-200 bg-amber-50 p-3"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-700">
            Payment failed. Access will be restricted to read-only after{" "}
            <strong>{formatDate(plan.gracePeriodEnd)}</strong>. Please update your
            payment method.
          </p>
        </div>
      )}

      {/* Payment method button */}
      <div className="mt-4 border-t border-border pt-4">
        <button
          onClick={onManagePayment}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Manage payment method
        </button>
      </div>
    </div>
  );
}
