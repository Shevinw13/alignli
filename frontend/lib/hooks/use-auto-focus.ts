"use client";

import { useRef, useEffect } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * useAutoFocus
 *
 * Auto-focuses the first editable input within a container element on mount.
 * Respects the user's reduced-motion preference by disabling scroll animation
 * when focusing (uses `preventScroll` in that case).
 *
 * @returns A ref to attach to the container element
 */
export function useAutoFocus<T extends HTMLElement>(): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Find the first editable input-like element
    const focusableSelector = [
      'input:not([type="hidden"]):not([disabled]):not([readonly])',
      "textarea:not([disabled]):not([readonly])",
      'select:not([disabled])',
      '[contenteditable="true"]',
    ].join(", ");

    const firstInput = container.querySelector<HTMLElement>(focusableSelector);

    if (firstInput) {
      // Use requestAnimationFrame to ensure the DOM is ready
      requestAnimationFrame(() => {
        firstInput.focus({ preventScroll: prefersReducedMotion });
      });
    }
  }, [prefersReducedMotion]);

  return containerRef;
}
