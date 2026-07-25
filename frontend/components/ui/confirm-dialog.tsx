"use client";

import { useEffect, useCallback, useId } from "react";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to control open state */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Visual variant: destructive uses Red, default uses Indigo */
  variant?: "default" | "destructive";
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Optional alternative action label (e.g., "Save Draft") */
  alternativeLabel?: string;
  /** Optional alternative action handler */
  onAlternative?: () => void;
}

/**
 * Confirmation dialog component.
 *
 * Supports destructive (Red) and default (Indigo) variants.
 * Enter confirms, Escape cancels. Focus is trapped within the dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  alternativeLabel,
  onAlternative,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      } else if (event.key === "Enter") {
        event.preventDefault();
        handleConfirm();
      }
    },
    [handleClose, handleConfirm]
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-150"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Dialog panel */}
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-50 w-full max-w-md rounded-[20px] bg-background p-6 shadow-sm border border-border"
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>

        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          {alternativeLabel && onAlternative && (
            <Button variant="outline" onClick={onAlternative}>
              {alternativeLabel}
            </Button>
          )}

          <Button variant="ghost" onClick={handleClose}>
            {cancelLabel}
          </Button>

          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            className={cn(
              variant === "destructive"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
