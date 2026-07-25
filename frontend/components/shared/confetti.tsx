"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ConfettiProps {
  /** Whether to show confetti */
  active: boolean;
  /** Duration in ms before confetti disappears (default: 2000) */
  duration?: number;
  /** Number of confetti particles */
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
}

const COLORS = [
  "#4F46E5", // Indigo
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#818CF8", // Indigo-400
  "#34D399", // Emerald-400
  "#FBBF24", // Amber-400
  "#A5B4FC", // Indigo-300
  "#6EE7B7", // Emerald-300
];

/**
 * Celebratory confetti animation component.
 * Renders CSS-animated particles for <2s duration.
 * Respects prefers-reduced-motion (shows static success badge instead).
 */
export function Confetti({
  active,
  duration = 2000,
  particleCount = 40,
}: ConfettiProps) {
  const [visible, setVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  // Generate particles deterministically
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: (i / particleCount) * 100 + (((i * 7) % 13) - 6),
      delay: (i * 37) % 500,
      color: COLORS[i % COLORS.length],
      size: 6 + ((i * 3) % 6),
      rotation: (i * 43) % 360,
    }));
  }, [particleCount]);

  if (!active && !visible) return null;

  // Reduced motion: show a static success indicator instead
  if (prefersReducedMotion) {
    if (!visible) return null;
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-8"
        aria-hidden="true"
      >
        <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 shadow-md">
          ✓ Complete!
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="confetti-particle absolute top-0"
          style={{
            left: `${particle.x}%`,
            animationDelay: `${particle.delay}ms`,
            backgroundColor: particle.color,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            transform: `rotate(${particle.rotation}deg)`,
            borderRadius: particle.id % 3 === 0 ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}
