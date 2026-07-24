"use client";

import { useState } from "react";
import { CurrentPlanCard } from "./current-plan-card";
import { UsageMetrics } from "./usage-metrics";
import { BillingHistory } from "./billing-history";
import { PlanSelector } from "./plan-selector";
import { PlanChangeDialog } from "./plan-change-dialog";
import type {
  SubscriptionPlan,
  UsageMetric,
  BillingHistoryItem,
  PlanTier,
} from "../types";

// ─── Mock data (will be replaced by API integration in task 20) ──────────────

const mockPlan: SubscriptionPlan = {
  id: "sub-1",
  organizationId: "org-1",
  planId: "professional",
  status: "active",
  stripeCustomerId: "cus_mock123",
  stripeSubscriptionId: "sub_mock456",
  currentPeriodStart: "2024-12-01T00:00:00Z",
  currentPeriodEnd: "2025-01-01T00:00:00Z",
  gracePeriodEnd: null,
  limits: {
    resume_reviews: 200,
    active_projects: 10,
    storage_mb: 2000,
    ai_credits: 500,
  },
};

const mockMetrics: UsageMetric[] = [
  {
    metric: "resume_reviews",
    used: 142,
    limit: 200,
    percentage: 71.0,
    atWarning: false,
    atLimit: false,
  },
  {
    metric: "active_projects",
    used: 8,
    limit: 10,
    percentage: 80.0,
    atWarning: true,
    atLimit: false,
  },
  {
    metric: "storage_mb",
    used: 1240,
    limit: 2000,
    percentage: 62.0,
    atWarning: false,
    atLimit: false,
  },
  {
    metric: "ai_credits",
    used: 485,
    limit: 500,
    percentage: 97.0,
    atWarning: true,
    atLimit: false,
  },
];

const mockBillingHistory: BillingHistoryItem[] = [
  {
    id: "inv-1",
    amount: 7900,
    currency: "usd",
    status: "paid",
    description: "Professional Plan - December 2024",
    created: "2024-12-01T00:00:00Z",
  },
  {
    id: "inv-2",
    amount: 7900,
    currency: "usd",
    status: "paid",
    description: "Professional Plan - November 2024",
    created: "2024-11-01T00:00:00Z",
  },
  {
    id: "inv-3",
    amount: 7900,
    currency: "usd",
    status: "paid",
    description: "Professional Plan - October 2024",
    created: "2024-10-01T00:00:00Z",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BillingSettings() {
  const [plan] = useState<SubscriptionPlan>(mockPlan);
  const [metrics] = useState<UsageMetric[]>(mockMetrics);
  const [billingHistory] = useState<BillingHistoryItem[]>(mockBillingHistory);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanTier | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  function handleManagePayment() {
    // Will redirect to Stripe Customer Portal in task 20 API wiring
    console.log("Opening Stripe Customer Portal...");
  }

  function handleSelectPlan(selectedPlan: PlanTier) {
    setTargetPlan(selectedPlan);
    setChangeDialogOpen(true);
  }

  function handleConfirmChange(acknowledge: boolean) {
    setIsChanging(true);
    // Will be replaced with actual API call in task 20
    console.log("Changing plan to:", targetPlan, "Acknowledged:", acknowledge);
    setTimeout(() => {
      setIsChanging(false);
      setChangeDialogOpen(false);
      setTargetPlan(null);
    }, 1500);
  }

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <CurrentPlanCard plan={plan} onManagePayment={handleManagePayment} />

      {/* Usage Metrics */}
      <UsageMetrics metrics={metrics} />

      {/* Plan Selection */}
      <PlanSelector currentPlan={plan.planId} onSelectPlan={handleSelectPlan} />

      {/* Billing History */}
      <BillingHistory items={billingHistory} />

      {/* Plan Change Dialog */}
      {targetPlan && (
        <PlanChangeDialog
          open={changeDialogOpen}
          onClose={() => {
            setChangeDialogOpen(false);
            setTargetPlan(null);
          }}
          currentPlan={plan.planId}
          targetPlan={targetPlan}
          currentMetrics={metrics}
          onConfirm={handleConfirmChange}
          isLoading={isChanging}
        />
      )}
    </div>
  );
}
