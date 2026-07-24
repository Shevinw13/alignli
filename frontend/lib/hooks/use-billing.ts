"use client";

import { useCallback } from "react";
import { useApi, useMutation } from "./use-api";
import {
  getCurrentPlan,
  getUsage,
  getBillingHistory,
  upgradePlan,
  downgradePlan,
} from "@/lib/services/billing";
import type {
  PlanResponse,
  UsageResponse,
  BillingHistoryResponse,
  UpgradeResponse,
  DowngradeResponse,
  PlanTier,
} from "@/lib/services/billing";

/**
 * Hook to fetch the current subscription plan (settings/billing page).
 */
export function useCurrentPlan() {
  return useApi<PlanResponse>(() => getCurrentPlan(), []);
}

/**
 * Hook to fetch current usage metrics.
 */
export function useUsage() {
  return useApi<UsageResponse>(() => getUsage(), []);
}

/**
 * Hook to fetch billing history (invoices).
 */
export function useBillingHistory() {
  return useApi<BillingHistoryResponse>(() => getBillingHistory(), []);
}

/**
 * Hook to upgrade the subscription plan.
 */
export function useUpgradePlan() {
  const mutationFn = useCallback(
    (targetPlan: PlanTier) => upgradePlan(targetPlan),
    []
  );
  return useMutation(mutationFn);
}

/**
 * Hook to downgrade the subscription plan.
 */
export function useDowngradePlan() {
  const mutationFn = useCallback(
    (targetPlan: PlanTier, acknowledgeWarnings?: boolean) =>
      downgradePlan(targetPlan, acknowledgeWarnings),
    []
  );
  return useMutation(mutationFn);
}
