"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import { Toast, type ToastVariant } from "./toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
}

type ToastAction =
  | { type: "ADD"; toast: ToastItem }
  | { type: "REMOVE"; id: string };

interface ToastContextValue {
  /** Show a toast notification */
  showToast: (opts: Omit<ToastItem, "id">) => void;
  /** Shortcut: success toast */
  success: (message: string, title?: string) => void;
  /** Shortcut: error toast */
  error: (message: string, title?: string) => void;
  /** Shortcut: warning toast */
  warning: (message: string, title?: string) => void;
  /** Shortcut: info toast */
  info: (message: string, title?: string) => void;
  /** Dismiss a specific toast by id */
  dismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const MAX_VISIBLE_TOASTS = 3;

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD": {
      // Keep only the most recent toasts to avoid stacking too many
      const updated = [...state.toasts, action.toast];
      return {
        toasts: updated.slice(-MAX_VISIBLE_TOASTS),
      };
    }
    case "REMOVE":
      return {
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let toastCounter = 0;

function generateToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

/**
 * ToastProvider manages a global queue of toast notifications.
 * Wrap your app (or layout) with this provider, then use `useToast()`
 * in any client component to trigger toasts.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const showToast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = generateToastId();
    dispatch({ type: "ADD", toast: { ...opts, id } });
  }, []);

  const success = useCallback(
    (message: string, title?: string) =>
      showToast({ message, title, variant: "success" }),
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) =>
      showToast({ message, title, variant: "error" }),
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string) =>
      showToast({ message, title, variant: "warning", duration: 6000 }),
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) =>
      showToast({ message, title, variant: "info" }),
    [showToast]
  );

  const contextValue: ToastContextValue = {
    showToast,
    success,
    error,
    warning,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Render stacked toasts from bottom */}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-[60] flex flex-col-reverse gap-2 pointer-events-none"
      >
        {state.toasts.map((toast, index) => (
          <div key={toast.id} className="pointer-events-auto" style={{ zIndex: 60 + index }}>
            <Toast
              open={true}
              onClose={() => dismiss(toast.id)}
              message={toast.message}
              title={toast.title}
              variant={toast.variant}
              duration={toast.duration}
              inline
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access the global toast notification system.
 * Must be used within a `<ToastProvider>`.
 *
 * @example
 * ```tsx
 * const toast = useToast();
 * toast.success("Pipeline complete!");
 * toast.error("Failed to send email");
 * toast.warning("Approaching usage limit");
 * toast.info("Processing resumes...");
 * ```
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
