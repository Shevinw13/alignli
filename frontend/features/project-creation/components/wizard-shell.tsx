"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWizardContext } from "../wizard-context";

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
  /** Called when Next is clicked — parent handles step-specific logic */
  onNext?: () => void;
}

export function WizardShell({ currentStep, children, onNext }: WizardShellProps) {
  const router = useRouter();
  const {
    previousStep,
    nextStep,
    saveDraft,
    isDirty,
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
    router.push("/projects");
  }

  function handleSaveDraftAndLeave() {
    saveDraft();
    setCancelDialogOpen(false);
    router.push("/projects");
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <div className="flex-1 space-y-8 pb-24">
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
              const isCompleted =
                completedSteps.has(step.number) || currentStep > step.number;
              const isCurrent = currentStep === step.number;
              const isRemaining = !isCompleted && !isCurrent;

              return (
                <li key={step.number} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        isCompleted && "bg-indigo-600 text-white",
                        isCurrent &&
                          "border-2 border-indigo-600 bg-indigo-50 text-indigo-600",
                        isRemaining &&
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
                        isCompleted && "text-indigo-600",
                        isCurrent && "text-indigo-600 font-semibold",
                        isRemaining && "text-muted-foreground"
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
            <X className="h-4 w-4" data-icon="inline-start" />
            Cancel
          </Button>

          {/* Right: Navigation buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={saveDraft} disabled={!isDirty}>
              <Save className="h-4 w-4" data-icon="inline-start" />
              Save Draft
            </Button>

            <Button
              variant="outline"
              onClick={previousStep}
              disabled={isFirstStep}
            >
              <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
              Previous
            </Button>

            {!isLastStep && (
              <Button onClick={handleNext}>
                Next
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
        title="Leave wizard?"
        description="You have unsaved changes. If you leave now, your progress will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={handleConfirmCancel}
        alternativeLabel="Save Draft & Leave"
        onAlternative={handleSaveDraftAndLeave}
      />
    </div>
  );
}
