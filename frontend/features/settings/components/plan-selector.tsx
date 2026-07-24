"use client";

import { cn } from "@/lib/utils";
import { Check, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanTier } from "../types";
import { PLAN_CONFIGS, METRIC_LABELS } from "../types";

interface PlanSelectorProps {
  currentPlan: PlanTier;
  onSelectPlan: (plan: PlanTier) => void;
}

const PLAN_ORDER: PlanTier[] = ["starter", "professional", "business", "enterprise"];

export function PlanSelector({ currentPlan, onSelectPlan }: PlanSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-navy">Change Plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upgrade for more capacity or downgrade to reduce costs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_CONFIGS.map((plan) => {
          const isCurrent = plan.tier === currentPlan;
          const currentIndex = PLAN_ORDER.indexOf(currentPlan);
          const planIndex = PLAN_ORDER.indexOf(plan.tier);
          const isUpgrade = planIndex > currentIndex;

          return (
            <div
              key={plan.tier}
              className={cn(
                "relative flex flex-col rounded-[16px] border p-4",
                isCurrent
                  ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                  : "border-border bg-white hover:border-indigo-200 hover:shadow-sm"
              )}
            >
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  Current Plan
                </span>
              )}

              <div className="flex-1">
                <h4 className="text-sm font-semibold text-navy">{plan.name}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {plan.description}
                </p>
                <p className="mt-2 text-xl font-bold text-navy">
                  {plan.price === -1 ? (
                    "Custom"
                  ) : (
                    <>
                      ${plan.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </>
                  )}
                </p>

                <ul className="mt-3 space-y-1">
                  {Object.entries(plan.limits).map(([key, value]) => (
                    <li
                      key={key}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      {value === -1 ? "Unlimited" : value.toLocaleString()}{" "}
                      {METRIC_LABELS[key] ?? key}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                {isCurrent ? (
                  <div className="text-center text-xs font-medium text-indigo-600">
                    Your current plan
                  </div>
                ) : plan.tier === "enterprise" ? (
                  <Button
                    type="button"
                    className="h-8 w-full rounded-[8px] border border-indigo-200 bg-white text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                    onClick={() => onSelectPlan(plan.tier)}
                  >
                    Contact Sales
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => onSelectPlan(plan.tier)}
                    className={cn(
                      "h-8 w-full rounded-[8px] text-xs font-medium text-white",
                      isUpgrade
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    )}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {isUpgrade ? (
                        <>
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          Upgrade
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          Downgrade
                        </>
                      )}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
