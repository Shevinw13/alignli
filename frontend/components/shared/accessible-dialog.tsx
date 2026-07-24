"use client";

import { useEffect, useCallback, useId } from "react";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { cn } from "@/lib/utils";

interface AccessibleDialogProps {
  /** Whether the dialog is currently open */
  open: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
  /** The dialog title displayed in the header */
  title: string;
  /** Optional description displayed below the title */
  description?: string;
  /** Dialog content */
  children: React.ReactNode;
  /** Additional className for the dialog panel */
  className?: string;
}

/**
 * An accessible dialog component that implements WAI-ARIA 1.2 dialog pattern.
 *
 * Features:
 * - Focus trap when open (Tab/Shift+Tab cycles within dialog)
 * - Focus returns to trigger element on close
 * - Escape key closes the dialog
 * - Backdrop click closes the dialog
 * - ARIA role="dialog", aria-modal, aria-labelledby, aria-describedby
 * - Prevents body scroll when open
 */
export function AccessibleDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: AccessibleDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Prevent body scroll when dialog is open
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-150"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-50 w-full max-w-lg rounded-[20px] bg-background p-6 shadow-sm",
          "border border-border",
          className
        )}
      >
        {/* Title */}
        <h2
          id={titleId}
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
