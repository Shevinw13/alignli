"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWizardContext } from "../wizard-context";

const STEPS = [
  { number: 1, label: "Role" },
  { number: 2, label: "Candidates" },
  { number: 3, label: "Results" },
] as const;

interface WizardShellProps {
  currentStep: number;
  children: React.ReactNode;
  /** Called when Next is clicked — parent handles step-specific logic */
  onNext?: () => void;
}

export function WizardShell({ currentStep, children, onNext }: WizardShellProps) {
  const router = useRouter();
  const {
    previousStep,
    nextStep,
    completedSteps,
    validateStep,
    isFirstStep,
    isLastStep,
  } = useWizardContext();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  function handleNext() {
    if (onNext) {
      onNext();
    } else if (validateStep(currentStep)) {
      nextStep();
    }
  }

  function handleCancel() {
    setCancelDialogOpen(true);
  }

  function handleConfirmCancel() {
    setCancelDialogOpen(false);
    router.push("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <div className="flex-1 space-y-8 pb-24">
        <div>
          <h1 className="text-xl font-bold text-navy">New Project</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </p>
        </div>

        {/* Step Indicator */}
        <nav aria-label="Progress">
          <ol className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const isCompleted =
                completedSteps.has(step.number) || currentStep > step.number;
              const isCurrent = currentStep === step.number;
              const isRemaining = !isCompleted && !isCurrent;

              return (
                <li key={step.number} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isCompleted && "bg-violet-600 text-white",
                        isCurrent &&
                          "border-2 border-violet-600 bg-violet-100 text-violet-600",
                        isRemaining &&
                          "border-2 border-gray-200 bg-white text-gray-400"
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={cn(
                        "hidden text-xs font-medium sm:inline",
                        isCompleted && "text-violet-600",
                        isCurrent && "text-violet-600 font-semibold",
                        isRemaining && "text-gray-400"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line between steps */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "hidden h-0.5 w-4 sm:block md:w-8",
                        isCompleted ? "bg-violet-600" : "bg-gray-200"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step Content with animation */}
        <div
          key={currentStep}
          className="animate-in-up rounded-[16px] border border-border bg-white p-6 md:p-8"
        >
          {children}
        </div>
      </div>

      {/* Fixed Footer Navigation Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          {/* Left: Cancel */}
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>

          {/* Right: Navigation buttons */}
          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={previousStep}
              >
                <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
                Back
              </Button>
            )}

            {!isLastStep && (
              <Button
                onClick={handleNext}
                className="bg-violet-600 text-white hover:bg-violet-700 px-5"
              >
                Continue
                <ChevronRight className="h-4 w-4" data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Leave this project?"
        description="Your progress won't be saved. You can always start a new project later."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
