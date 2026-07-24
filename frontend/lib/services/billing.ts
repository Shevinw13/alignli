"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export type PlanTier = "starter" | "professional" | "business" | "enterprise";

export interface PlanResponse {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  grace_period_end: string | null;
  limits: Record<string, number>;
}

export interface UsageMetric {
  metric: string;
  used: number;
  limit: number;
  percentage: number;
  at_warning: boolean;
  at_limit: boolean;
}

export interface UsageResponse {
  metrics: UsageMetric[];
  plan_id: string;
}

export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created: string;
}

export interface BillingHistoryResponse {
  items: BillingHistoryItem[];
}

export interface UpgradeResponse {
  success: boolean;
  message: string;
  new_plan: string;
  effective_immediately: boolean;
}

export interface DowngradeResponse {
  success: boolean;
  message: string;
  new_plan: string;
  effective_at_cycle_end: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get the current subscription plan and status.
 */
export function getCurrentPlan(): Promise<ApiResponse<PlanResponse>> {
  return api.get<PlanResponse>("/api/v1/billing/plan");
}

/**
 * Get current usage metrics relative to plan limits.
 */
export function getUsage(): Promise<ApiResponse<UsageResponse>> {
  return api.get<UsageResponse>("/api/v1/billing/usage");
}

/**
 * Get billing history (recent invoices).
 */
export function getBillingHistory(): Promise<ApiResponse<BillingHistoryResponse>> {
  return api.get<BillingHistoryResponse>("/api/v1/billing/history");
}

/**
 * Initiate a plan upgrade. Takes effect immediately with prorated billing.
 */
export function upgradePlan(
  targetPlan: PlanTier
): Promise<ApiResponse<UpgradeResponse>> {
  return api.post<UpgradeResponse>("/api/v1/billing/upgrade", {
    target_plan: targetPlan,
  });
}

/**
 * Initiate a plan downgrade. Takes effect at end of current billing cycle.
 */
export function downgradePlan(
  targetPlan: PlanTier,
  acknowledgeWarnings = false
): Promise<ApiResponse<DowngradeResponse>> {
  return api.post<DowngradeResponse>("/api/v1/billing/downgrade", {
    target_plan: targetPlan,
    acknowledge_warnings: acknowledgeWarnings,
  });
}
