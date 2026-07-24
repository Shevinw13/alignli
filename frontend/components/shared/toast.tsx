"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastProps {
  /** Whether the toast is visible */
  open: boolean;
  /** Callback when the toast should close */
  onClose: () => void;
  /** The message to display */
  message: string;
  /** Optional title for the toast */
  title?: string;
  /** The variant determines the icon and color */
  variant: ToastVariant;
  /** Auto-dismiss duration in ms (default 4000, 0 to disable) */
  duration?: number;
  /** If true, use static positioning (for use inside a container). Default: fixed. */
  inline?: boolean;
}

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle; styles: string }
> = {
  success: {
    icon: CheckCircle,
    styles: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  error: {
    icon: XCircle,
    styles: "border-red-200 bg-red-50 text-red-800",
  },
  warning: {
    icon: AlertTriangle,
    styles: "border-amber-200 bg-amber-50 text-amber-800",
  },
  info: {
    icon: Info,
    styles: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
};

/**
 * A toast notification component for displaying brief feedback messages.
 * Supports success, error, warning, and info variants with auto-dismiss.
 */
export function Toast({
  open,
  onClose,
  message,
  title,
  variant,
  duration = 4000,
  inline = false,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // Trigger entrance animation
      requestAnimationFrame(() => setIsVisible(true));

      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 150);
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [open, duration, onClose]);

  if (!open) return null;

  const { icon: Icon, styles } = variantConfig[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-start gap-3 rounded-[12px] border px-4 py-3 shadow-sm transition-all duration-150 max-w-[400px]",
        !inline && "fixed bottom-6 right-6 z-[60]",
        styles,
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold">{title}</p>
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 150);
        }}
        className="ml-2 shrink-0 rounded-full p-0.5 hover:bg-black/5"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
