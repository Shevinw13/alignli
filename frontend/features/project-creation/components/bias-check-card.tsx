"use client";

import { useMemo } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BiasFlag {
  phrase: string;
  category: "gendered" | "age" | "ability" | "cultural";
  suggestion: string;
}

type BiasStatus = "pass" | "warning" | "alert";

// ─── Bias Dictionary ─────────────────────────────────────────────────────────

const BIAS_RULES: {
  pattern: RegExp;
  category: BiasFlag["category"];
  phrase: string;
  suggestion: string;
}[] = [
  // Gendered
  { pattern: /\brockstar\b/i, category: "gendered", phrase: "rockstar", suggestion: "high performer" },
  { pattern: /\bninja\b/i, category: "gendered", phrase: "ninja", suggestion: "expert" },
  { pattern: /\bmanpower\b/i, category: "gendered", phrase: "manpower", suggestion: "workforce" },
  { pattern: /\bchairman\b/i, category: "gendered", phrase: "chairman", suggestion: "chairperson" },
  { pattern: /\bhe\/his\b/i, category: "gendered", phrase: "he/his", suggestion: "they/their" },
  { pattern: /\bguys\b/i, category: "gendered", phrase: "guys", suggestion: "team, folks, everyone" },
  // Age-biased
  { pattern: /\bdigital native\b/i, category: "age", phrase: "digital native", suggestion: "digitally proficient" },
  { pattern: /\byoung and energetic\b/i, category: "age", phrase: "young and energetic", suggestion: "motivated and enthusiastic" },
  { pattern: /\brecent graduate only\b/i, category: "age", phrase: "recent graduate only", suggestion: "entry-level candidates welcome" },
  { pattern: /\bmature\b/i, category: "age", phrase: "mature", suggestion: "experienced" },
  // Ability-biased
  { pattern: /\bmust be able to stand\b/i, category: "ability", phrase: "must be able to stand", suggestion: "specify if genuinely required for role" },
  { pattern: /\bphysically fit\b/i, category: "ability", phrase: "physically fit", suggestion: "specify physical requirements if essential" },
  // Cultural
  { pattern: /\bculture fit\b/i, category: "cultural", phrase: "culture fit", suggestion: "culture add" },
  { pattern: /\bnative english speaker\b/i, category: "cultural", phrase: "native English speaker", suggestion: "fluent in English" },
];

// ─── Bias Check Logic ────────────────────────────────────────────────────────

export function runBiasCheck(text: string): BiasFlag[] {
  const flags: BiasFlag[] = [];
  for (const rule of BIAS_RULES) {
    if (rule.pattern.test(text)) {
      flags.push({
        phrase: rule.phrase,
        category: rule.category,
        suggestion: rule.suggestion,
      });
    }
  }
  return flags;
}

function getStatus(flags: BiasFlag[]): BiasStatus {
  if (flags.length === 0) return "pass";
  if (flags.length <= 2) return "warning";
  return "alert";
}

const STATUS_CONFIG: Record<BiasStatus, { bg: string; text: string; dot: string; label: string }> = {
  pass: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "No issues" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Minor issues" },
  alert: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Review needed" },
};

const CATEGORY_LABELS: Record<BiasFlag["category"], string> = {
  gendered: "Gendered",
  age: "Age-biased",
  ability: "Ability-biased",
  cultural: "Cultural",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface BiasCheckCardProps {
  text: string;
}

export function BiasCheckCard({ text }: BiasCheckCardProps) {
  const flags = useMemo(() => runBiasCheck(text), [text]);
  const status = getStatus(flags);
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("rounded-[12px] border border-border-default p-4", config.bg)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/70">
          <Shield className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-navy">Inclusive Language Check</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", config.dot)} aria-hidden="true" />
          <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
        </div>
      </div>

      {/* Results */}
      {flags.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-700">✓ No biased language detected</p>
      ) : (
        <ul className="mt-3 space-y-2" aria-label="Flagged phrases">
          {flags.map((flag) => (
            <li key={flag.phrase} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight",
                  config.text,
                  "bg-white/60"
                )}
              >
                {CATEGORY_LABELS[flag.category]}
              </span>
              <span className="text-navy">
                <span className="font-medium">&ldquo;{flag.phrase}&rdquo;</span>
                {" → "}
                <span className="text-muted-foreground">try &ldquo;{flag.suggestion}&rdquo;</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
