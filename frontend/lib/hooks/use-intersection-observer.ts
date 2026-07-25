"use client";

import { useRef, useState, useEffect } from "react";

export interface UseIntersectionObserverReturn<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * useIntersectionObserver
 *
 * Observes an element's intersection with its scrolling ancestor or viewport.
 * Returns a ref to attach to the target element, plus the current intersection state.
 *
 * @param options - Standard IntersectionObserver options (root, rootMargin, threshold)
 */
export function useIntersectionObserver<T extends HTMLElement>(
  options?: IntersectionObserverInit
): UseIntersectionObserverReturn<T> {
  const ref = useRef<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([observerEntry]) => {
      setIsIntersecting(observerEntry.isIntersecting);
      setEntry(observerEntry);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.root, options?.rootMargin, options?.threshold]);

  return { ref, isIntersecting, entry };
}
