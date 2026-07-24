/** Organization roles as defined in requirement 1.4 */
export type OrgRole = "Owner" | "Admin" | "Hiring_Manager" | "Recruiter" | "Viewer";

/** A current member of the organization */
export interface OrganizationMember {
  id: string;
  fullName: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
}

/** A pending invitation that has been sent but not yet accepted */
export interface PendingInvitation {
  id: string;
  email: string;
  role: OrgRole;
  sentAt: string;
  expiresAt: string;
}

/** Role permission definition for display */
export interface RolePermissionEntry {
  permission: string;
  Owner: boolean;
  Admin: boolean;
  Hiring_Manager: boolean;
  Recruiter: boolean;
  Viewer: boolean;
}

// ─── Billing Types (Requirement 17) ─────────────────────────────────────────

/** Subscription plan tiers */
export type PlanTier = "starter" | "professional" | "business" | "enterprise";

/** Subscription status values */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "grace_period"
  | "read_only";

/** Current subscription plan details */
export interface SubscriptionPlan {
  id: string;
  organizationId: string;
  planId: PlanTier;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEnd: string | null;
  limits: Record<string, number>;
}

/** A single usage metric with current value and limit */
export interface UsageMetric {
  metric: string;
  used: number;
  limit: number;
  percentage: number;
  atWarning: boolean;
  atLimit: boolean;
}

/** Usage response from API */
export interface UsageResponse {
  metrics: UsageMetric[];
  planId: PlanTier;
}

/** A billing history item */
export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created: string;
}

/** Plan configuration for display */
export interface PlanConfig {
  tier: PlanTier;
  name: string;
  description: string;
  price: number;
  limits: {
    resume_reviews: number;
    active_projects: number;
    storage_mb: number;
    ai_credits: number;
  };
}

/** Metric display labels */
export const METRIC_LABELS: Record<string, string> = {
  resume_reviews: "Resume Reviews",
  active_projects: "Active Projects",
  storage_mb: "Storage",
  ai_credits: "AI Credits",
};

/** Plan configuration data */
export const PLAN_CONFIGS: PlanConfig[] = [
  {
    tier: "starter",
    name: "Starter",
    description: "For small teams getting started",
    price: 29,
    limits: { resume_reviews: 50, active_projects: 3, storage_mb: 500, ai_credits: 100 },
  },
  {
    tier: "professional",
    name: "Professional",
    description: "For growing teams",
    price: 79,
    limits: { resume_reviews: 200, active_projects: 10, storage_mb: 2000, ai_credits: 500 },
  },
  {
    tier: "business",
    name: "Business",
    description: "For larger organizations",
    price: 199,
    limits: { resume_reviews: 1000, active_projects: 50, storage_mb: 10000, ai_credits: 2500 },
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for enterprise",
    price: -1,
    limits: { resume_reviews: -1, active_projects: -1, storage_mb: -1, ai_credits: -1 },
  },
];
