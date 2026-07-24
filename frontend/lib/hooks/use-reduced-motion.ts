"use client";

import { useState, useEffect } from "react";

/**
 * A React hook that detects whether the user has enabled reduced motion
 * preferences in their operating system.
 *
 * When reduced motion is preferred, animations should be removed and
 * transitions limited to opacity/color changes with max 200ms duration.
 *
 * @returns `true` if the user prefers reduced motion, `false` otherwise
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
