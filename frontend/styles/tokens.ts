/**
 * Alignli Design Tokens
 *
 * Centralized design system values for use in components.
 * These complement Tailwind CSS utility classes for cases where
 * programmatic access to design values is needed (JS-driven animations,
 * conditional logic, etc.).
 *
 * All values mirror the CSS custom properties defined in globals.css.
 */

// ─── Duration Tokens ─────────────────────────────────────────────────────────

export const durations = {
  instant: 50,
  fast: 100,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;

export type Duration = keyof typeof durations;

// ─── Easing Tokens ───────────────────────────────────────────────────────────

export const easings = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.45, 0, 0.55, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export type Easing = keyof typeof easings;

// ─── Spacing (8pt grid) ──────────────────────────────────────────────────────

export const spacing = {
  0: "0px",
  0.5: "4px",
  1: "8px",
  1.5: "12px",
  2: "16px",
  3: "24px",
  4: "32px",
  5: "40px",
  6: "48px",
  8: "64px",
  10: "80px",
  12: "96px",
} as const;

export type SpacingKey = keyof typeof spacing;

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  primary: {
    DEFAULT: "#4F46E5",
    50: "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
    950: "#1E1B4B",
  },
  success: "#10B981",
  successBg: "rgba(16, 185, 129, 0.1)",
  warning: "#F59E0B",
  warningBg: "rgba(245, 158, 11, 0.1)",
  error: "#EF4444",
  errorBg: "rgba(239, 68, 68, 0.1)",
  text: {
    primary: "#0F172A",
    secondary: "#6B7280",
  },
  background: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
  },
  border: "#E5E7EB",
  emerald500: "#10B981",
  amber500: "#F59E0B",
  red500: "#EF4444",
  navy: "#0F172A",
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadows = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.03)",
  sm: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03)",
  md: "0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.03)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.02)",
} as const;

export type Shadow = keyof typeof shadows;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const borderRadius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "28px",
  "4xl": "32px",
  button: "12px",
  card: "16px",
  dialog: "20px",
} as const;

// ─── Typography Scale ────────────────────────────────────────────────────────

export const typography = {
  display: {
    fontSize: "48px",
    lineHeight: "56px",
    fontWeight: 800,
  },
  h1: {
    fontSize: "36px",
    lineHeight: "44px",
    fontWeight: 700,
  },
  h2: {
    fontSize: "30px",
    lineHeight: "38px",
    fontWeight: 700,
  },
  h3: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
  },
  title: {
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 600,
  },
  body: {
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 400,
  },
  caption: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 400,
  },
  small: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 400,
  },
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export const layout = {
  maxContentWidth: "1280px",
} as const;

// ─── Utility: build a CSS transition string ──────────────────────────────────

/**
 * Build a CSS transition string from token values.
 *
 * @example
 * buildTransition(["opacity", "transform"], "normal", "out")
 * // => "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)"
 */
export function buildTransition(
  properties: string[],
  duration: Duration = "normal",
  easing: Easing = "out"
): string {
  const ms = durations[duration];
  const curve = easings[easing];
  return properties.map((prop) => `${prop} ${ms}ms ${curve}`).join(", ");
}
