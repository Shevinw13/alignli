"use client";

import { useState, useCallback } from "react";

export interface UseKeyboardNavigationOptions {
  /** Total number of items */
  itemCount: number;
  /** Orientation for arrow key mapping */
  orientation?: "vertical" | "horizontal" | "grid";
  /** Number of columns (for grid orientation) */
  columns?: number;
  /** Callback when item is activated (Enter) */
  onActivate?: (index: number) => void;
  /** Whether navigation is active */
  enabled?: boolean;
}

export interface KeyboardNavigationItemProps {
  tabIndex: number;
  "aria-selected": boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface UseKeyboardNavigationReturn {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  getItemProps: (index: number) => KeyboardNavigationItemProps;
}

/**
 * useKeyboardNavigation
 *
 * Provides accessible keyboard navigation for lists, menus, and grids.
 * - Arrow keys navigate between items
 * - Enter activates the focused item
 * - Escape deselects (sets activeIndex to -1)
 *
 * Supports vertical, horizontal, and grid orientations.
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions
): UseKeyboardNavigationReturn {
  const {
    itemCount,
    orientation = "vertical",
    columns = 1,
    onActivate,
    enabled = true,
  } = options;

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      let nextIndex = activeIndex;

      switch (e.key) {
        case "ArrowDown": {
          if (orientation === "horizontal") return;
          e.preventDefault();
          if (orientation === "grid") {
            nextIndex = activeIndex + columns;
            if (nextIndex >= itemCount) nextIndex = activeIndex;
          } else {
            nextIndex = activeIndex < itemCount - 1 ? activeIndex + 1 : 0;
          }
          break;
        }
        case "ArrowUp": {
          if (orientation === "horizontal") return;
          e.preventDefault();
          if (orientation === "grid") {
            nextIndex = activeIndex - columns;
            if (nextIndex < 0) nextIndex = activeIndex;
          } else {
            nextIndex = activeIndex > 0 ? activeIndex - 1 : itemCount - 1;
          }
          break;
        }
        case "ArrowRight": {
          if (orientation === "vertical") return;
          e.preventDefault();
          nextIndex = activeIndex < itemCount - 1 ? activeIndex + 1 : 0;
          break;
        }
        case "ArrowLeft": {
          if (orientation === "vertical") return;
          e.preventDefault();
          nextIndex = activeIndex > 0 ? activeIndex - 1 : itemCount - 1;
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (activeIndex >= 0 && onActivate) {
            onActivate(activeIndex);
          }
          return;
        }
        case "Escape": {
          e.preventDefault();
          setActiveIndex(-1);
          return;
        }
        default:
          return;
      }

      setActiveIndex(nextIndex);
    },
    [enabled, itemCount, activeIndex, orientation, columns, onActivate]
  );

  const getItemProps = useCallback(
    (index: number): KeyboardNavigationItemProps => ({
      tabIndex: index === activeIndex ? 0 : -1,
      "aria-selected": index === activeIndex,
      onKeyDown: handleKeyDown,
    }),
    [activeIndex, handleKeyDown]
  );

  return {
    activeIndex,
    setActiveIndex,
    getItemProps,
  };
}
