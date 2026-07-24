"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Job Description" },
  { number: 3, label: "Ranking Criteria" },
  { number: 4, label: "Upload Resumes" },
  { number: 5, label: "Processing" },
] as const;

interface WizardShellProps {
  currentStep: number;
  children: React.ReactNode;
}

export function WizardShell({ currentStep, children }: WizardShellProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">New Hiring Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {currentStep} of {STEPS.length}
        </p>
      </div>

      {/* Step Indicator */}
      <nav aria-label="Progress">
        <ol className="flex items-center gap-2">
          {STEPS.map((step, index) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;

            return (
              <li key={step.number} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                      isCompleted &&
                        "bg-indigo-600 text-white",
                      isCurrent &&
                        "border-2 border-indigo-600 bg-indigo-50 text-indigo-600",
                      !isCompleted &&
                        !isCurrent &&
                        "border-2 border-border-default bg-white text-muted-foreground"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      isCurrent ? "text-indigo-600" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line between steps */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "hidden h-0.5 w-6 sm:block md:w-10",
                      isCompleted ? "bg-indigo-600" : "bg-border-default"
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="rounded-[16px] border border-border bg-white p-6 md:p-8">
        {children}
      </div>
    </div>
  );
}
