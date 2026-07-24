/**
 * Alignli Design Tokens
 *
 * Centralized design system values for use in components.
 * These complement Tailwind CSS utility classes for cases where
 * programmatic access to design values is needed.
 */

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
  warning: "#F59E0B",
  error: "#EF4444",
  text: {
    primary: "#0F172A",
    secondary: "#6B7280",
  },
  background: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
  },
  border: "#E5E7EB",
} as const;

// ─── Spacing (8pt grid) ──────────────────────────────────────────────────────

export const spacing = {
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

// ─── Border Radius ───────────────────────────────────────────────────────────

export const borderRadius = {
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

// ─── Shadows (very minimal per design system) ────────────────────────────────

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.03)",
  md: "0 2px 4px rgba(0, 0, 0, 0.05)",
  lg: "0 4px 4px rgba(0, 0, 0, 0.05)",
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export const layout = {
  maxContentWidth: "1280px",
} as const;
