"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AccessibleDialog } from "@/components/shared/accessible-dialog";
import { Toast } from "@/components/shared/toast";
import { Award } from "lucide-react";
import type { ProjectState } from "@/features/hiring-project";

// --- Types ---

export interface HireCandidateButtonProps {
  /** The candidate's ID */
  candidateId: string;
  /** The candidate's display name */
  candidateName: string;
  /** The hiring project's current state */
  projectState: ProjectState;
  /** Callback when the candidate is successfully hired */
  onHired?: (candidateId: string) => void;
  /** Callback when the project is transitioned to Filled */
  onProjectFilled?: () => void;
}

type DialogStep = "idle" | "confirm-hire" | "prompt-fill-project";

/**
 * HireCandidateButton implements the hire candidate flow:
 * 1. Click "Mark as Hired" → confirmation dialog
 * 2. On confirm → success toast + prompt to transition project to Filled
 * 3. On "Yes" to fill → project transitions to Filled (onProjectFilled callback)
 * 4. On "No" to fill → keep current state, retain Hired status
 * 5. Block hire on Filled/Archived projects with error toast
 *
 * Requirements: 14.1-14.7
 */
export function HireCandidateButton({
  candidateId,
  candidateName,
  projectState,
  onHired,
  onProjectFilled,
}: HireCandidateButtonProps) {
  const [dialogStep, setDialogStep] = useState<DialogStep>("idle");
  const [toastState, setToastState] = useState<{
    open: boolean;
    message: string;
    variant: "success" | "error";
  }>({ open: false, message: "", variant: "success" });

  const isProjectClosed = projectState === "Filled" || projectState === "Archived";

  const showToast = useCallback(
    (message: string, variant: "success" | "error") => {
      setToastState({ open: true, message, variant });
    },
    []
  );

  const closeToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, open: false }));
  }, []);

  /** Step 1: User clicks "Mark as Hired" */
  const handleHireClick = useCallback(() => {
    // Requirement 14.7: Block hire on Filled/Archived projects
    if (isProjectClosed) {
      showToast(
        "This project is no longer accepting candidates. The project has been closed.",
        "error"
      );
      return;
    }
    setDialogStep("confirm-hire");
  }, [isProjectClosed, showToast]);

  /** Step 2: User confirms the hire */
  const handleConfirmHire = useCallback(() => {
    // Requirement 14.1: Update candidate status to Hired and display confirmation
    setDialogStep("idle");
    onHired?.(candidateId);
    showToast(`${candidateName} has been marked as Hired.`, "success");

    // Requirement 14.2: Prompt to transition project to Filled
    // Show the fill project prompt after a brief delay to let the toast appear
    setTimeout(() => {
      setDialogStep("prompt-fill-project");
    }, 500);
  }, [candidateId, candidateName, onHired, showToast]);

  /** Step 3a: User accepts transitioning project to Filled */
  const handleAcceptFill = useCallback(() => {
    // Requirement 14.4: Move project to Filled state / closed list
    setDialogStep("idle");
    onProjectFilled?.();
    showToast("Project has been moved to Filled. It will appear in your closed projects.", "success");
  }, [onProjectFilled, showToast]);

  /** Step 3b: User declines transitioning project to Filled */
  const handleDeclineFill = useCallback(() => {
    // Requirement 14.3: Keep current state, retain Hired status
    setDialogStep("idle");
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogStep("idle");
  }, []);

  return (
    <>
      {/* Mark as Hired button */}
      <Button
        variant="default"
        size="default"
        onClick={handleHireClick}
        disabled={isProjectClosed}
        aria-label={`Mark ${candidateName} as hired`}
      >
        <Award className="h-4 w-4" aria-hidden="true" data-icon="inline-start" />
        Mark as Hired
      </Button>

      {/* Confirmation dialog: Are you sure you want to hire? */}
      <AccessibleDialog
        open={dialogStep === "confirm-hire"}
        onClose={handleCloseDialog}
        title="Confirm Hire"
        description={`Are you sure you want to mark ${candidateName} as hired? This will update their status to Hired.`}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="default" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button variant="default" size="default" onClick={handleConfirmHire}>
            Confirm Hire
          </Button>
        </div>
      </AccessibleDialog>

      {/* Prompt dialog: Transition project to Filled? */}
      <AccessibleDialog
        open={dialogStep === "prompt-fill-project"}
        onClose={handleDeclineFill}
        title="Close Hiring Project?"
        description={`${candidateName} has been marked as hired. Would you like to transition this project to Filled? This will move it to your closed projects list.`}
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="default" onClick={handleDeclineFill}>
            No, Keep Open
          </Button>
          <Button variant="default" size="default" onClick={handleAcceptFill}>
            Yes, Mark as Filled
          </Button>
        </div>
      </AccessibleDialog>

      {/* Toast notification */}
      <Toast
        open={toastState.open}
        onClose={closeToast}
        message={toastState.message}
        variant={toastState.variant}
      />
    </>
  );
}
