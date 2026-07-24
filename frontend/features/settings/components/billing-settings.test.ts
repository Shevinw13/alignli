/**
 * Unit tests for billing and subscription UI logic.
 *
 * Tests usage metric calculations, plan change validation,
 * warning thresholds, and format utilities.
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
 */

import { describe, it, expect } from "vitest";
import type { UsageMetric, PlanTier } from "../types";
import { PLAN_CONFIGS, METRIC_LABELS } from "../types";

// --- Extracted logic for testing (mirrors component behavior) ---

function formatMetricValue(metric: string, value: number): string {
  if (value === -1) return "Unlimited";
  if (metric === "storage_mb") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} GB`;
    return `${value} MB`;
  }
  return value.toLocaleString();
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
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
    const targetLimit =
      targetConfig.limits[metric.metric as keyof typeof targetConfig.limits];
    if (targetLimit !== undefined && targetLimit !== -1 && metric.used > targetLimit) {
      const label = METRIC_LABELS[metric.metric] ?? metric.metric;
      warnings.push(
        `${label}: currently using ${metric.used}, target plan limit is ${targetLimit}`
      );
    }
  }
  return warnings;
}

function getProgressColor(metric: UsageMetric): string {
  if (metric.atLimit) return "bg-red-500";
  if (metric.atWarning) return "bg-amber-500";
  return "bg-indigo-500";
}

function isAtWarningThreshold(percentage: number): boolean {
  return percentage >= 80;
}

function isAtLimitThreshold(percentage: number): boolean {
  return percentage >= 100;
}

// --- Tests ---

describe("Billing Settings - Usage Metrics", () => {
  describe("formatMetricValue", () => {
    it("formats storage values >= 1000 MB as GB", () => {
      expect(formatMetricValue("storage_mb", 2000)).toBe("2.0 GB");
      expect(formatMetricValue("storage_mb", 1500)).toBe("1.5 GB");
    });

    it("formats storage values < 1000 as MB", () => {
      expect(formatMetricValue("storage_mb", 500)).toBe("500 MB");
      expect(formatMetricValue("storage_mb", 0)).toBe("0 MB");
    });

    it("formats unlimited (-1) as 'Unlimited'", () => {
      expect(formatMetricValue("resume_reviews", -1)).toBe("Unlimited");
      expect(formatMetricValue("storage_mb", -1)).toBe("Unlimited");
    });

    it("formats numeric values with locale separators", () => {
      expect(formatMetricValue("resume_reviews", 1000)).toBe("1,000");
      expect(formatMetricValue("ai_credits", 2500)).toBe("2,500");
    });

    it("formats small values correctly", () => {
      expect(formatMetricValue("active_projects", 3)).toBe("3");
      expect(formatMetricValue("ai_credits", 50)).toBe("50");
    });
  });

  describe("warning thresholds (Requirement 17.3)", () => {
    it("returns warning at exactly 80%", () => {
      expect(isAtWarningThreshold(80)).toBe(true);
    });

    it("returns no warning below 80%", () => {
      expect(isAtWarningThreshold(79.9)).toBe(false);
      expect(isAtWarningThreshold(50)).toBe(false);
      expect(isAtWarningThreshold(0)).toBe(false);
    });

    it("returns warning above 80%", () => {
      expect(isAtWarningThreshold(85)).toBe(true);
      expect(isAtWarningThreshold(99)).toBe(true);
    });
  });

  describe("limit thresholds (Requirement 17.4)", () => {
    it("returns blocked at exactly 100%", () => {
      expect(isAtLimitThreshold(100)).toBe(true);
    });

    it("returns not blocked below 100%", () => {
      expect(isAtLimitThreshold(99.9)).toBe(false);
      expect(isAtLimitThreshold(80)).toBe(false);
    });

    it("returns blocked above 100%", () => {
      expect(isAtLimitThreshold(105)).toBe(true);
    });
  });

  describe("progress bar colors", () => {
    it("shows red when at limit", () => {
      const metric: UsageMetric = {
        metric: "ai_credits",
        used: 500,
        limit: 500,
        percentage: 100,
        atWarning: true,
        atLimit: true,
      };
      expect(getProgressColor(metric)).toBe("bg-red-500");
    });

    it("shows amber when at warning", () => {
      const metric: UsageMetric = {
        metric: "active_projects",
        used: 8,
        limit: 10,
        percentage: 80,
        atWarning: true,
        atLimit: false,
      };
      expect(getProgressColor(metric)).toBe("bg-amber-500");
    });

    it("shows indigo when normal", () => {
      const metric: UsageMetric = {
        metric: "resume_reviews",
        used: 30,
        limit: 200,
        percentage: 15,
        atWarning: false,
        atLimit: false,
      };
      expect(getProgressColor(metric)).toBe("bg-indigo-500");
    });
  });
});

describe("Billing Settings - Plan Changes", () => {
  describe("isUpgrade", () => {
    it("detects upgrade from starter to professional", () => {
      expect(isUpgrade("starter", "professional")).toBe(true);
    });

    it("detects upgrade from professional to business", () => {
      expect(isUpgrade("professional", "business")).toBe(true);
    });

    it("detects upgrade from starter to enterprise", () => {
      expect(isUpgrade("starter", "enterprise")).toBe(true);
    });

    it("detects downgrade from business to starter", () => {
      expect(isUpgrade("business", "starter")).toBe(false);
    });

    it("detects downgrade from professional to starter", () => {
      expect(isUpgrade("professional", "starter")).toBe(false);
    });

    it("returns false when same plan", () => {
      expect(isUpgrade("professional", "professional")).toBe(false);
    });
  });

  describe("getExceedingMetrics (Requirement 17.6)", () => {
    const highUsageMetrics: UsageMetric[] = [
      { metric: "resume_reviews", used: 150, limit: 200, percentage: 75, atWarning: false, atLimit: false },
      { metric: "active_projects", used: 8, limit: 10, percentage: 80, atWarning: true, atLimit: false },
      { metric: "storage_mb", used: 1200, limit: 2000, percentage: 60, atWarning: false, atLimit: false },
      { metric: "ai_credits", used: 400, limit: 500, percentage: 80, atWarning: true, atLimit: false },
    ];

    it("returns warnings when downgrading to plan with lower limits", () => {
      const warnings = getExceedingMetrics("starter", highUsageMetrics);
      // Starter limits: 50 resumes, 3 projects, 500 MB storage, 100 AI credits
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes("Resume Reviews"))).toBe(true);
      expect(warnings.some((w) => w.includes("Active Projects"))).toBe(true);
      expect(warnings.some((w) => w.includes("Storage"))).toBe(true);
      expect(warnings.some((w) => w.includes("AI Credits"))).toBe(true);
    });

    it("returns no warnings when upgrading to higher plan", () => {
      const warnings = getExceedingMetrics("business", highUsageMetrics);
      // Business limits: 1000 resumes, 50 projects, 10000 storage, 2500 credits
      expect(warnings).toHaveLength(0);
    });

    it("returns no warnings for enterprise (unlimited)", () => {
      const warnings = getExceedingMetrics("enterprise", highUsageMetrics);
      expect(warnings).toHaveLength(0);
    });

    it("returns partial warnings when some metrics exceed", () => {
      const modestMetrics: UsageMetric[] = [
        { metric: "resume_reviews", used: 40, limit: 200, percentage: 20, atWarning: false, atLimit: false },
        { metric: "active_projects", used: 5, limit: 10, percentage: 50, atWarning: false, atLimit: false },
        { metric: "storage_mb", used: 200, limit: 2000, percentage: 10, atWarning: false, atLimit: false },
        { metric: "ai_credits", used: 30, limit: 500, percentage: 6, atWarning: false, atLimit: false },
      ];
      const warnings = getExceedingMetrics("starter", modestMetrics);
      // Only active_projects (5 > 3) exceeds starter limit
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("Active Projects");
    });
  });
});

describe("Billing Settings - Currency Formatting", () => {
  it("formats cents to dollars", () => {
    expect(formatCurrency(7900, "usd")).toBe("$79.00");
    expect(formatCurrency(2900, "usd")).toBe("$29.00");
  });

  it("formats zero amount", () => {
    expect(formatCurrency(0, "usd")).toBe("$0.00");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(19900, "usd")).toBe("$199.00");
  });
});

describe("Billing Settings - Plan Configuration", () => {
  it("has 4 plan tiers defined", () => {
    expect(PLAN_CONFIGS).toHaveLength(4);
  });

  it("plans are ordered from cheapest to most expensive", () => {
    const prices = PLAN_CONFIGS.filter((p) => p.price !== -1).map((p) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it("enterprise plan has -1 (unlimited) for all limits", () => {
    const enterprise = PLAN_CONFIGS.find((p) => p.tier === "enterprise");
    expect(enterprise).toBeDefined();
    expect(enterprise!.limits.resume_reviews).toBe(-1);
    expect(enterprise!.limits.active_projects).toBe(-1);
    expect(enterprise!.limits.storage_mb).toBe(-1);
    expect(enterprise!.limits.ai_credits).toBe(-1);
  });

  it("all metric keys have display labels", () => {
    const metricKeys = ["resume_reviews", "active_projects", "storage_mb", "ai_credits"];
    for (const key of metricKeys) {
      expect(METRIC_LABELS[key]).toBeDefined();
      expect(METRIC_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
