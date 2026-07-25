"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionCard } from "./section-card";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Criterion {
  label: string;
  priority: string;
}

type Rating = "Strong" | "Moderate" | "Weak" | "Not assessed";

interface CriterionScore {
  criterion: string;
  rating: Rating;
  evidence: string;
}

interface ScorecardResult {
  overallAssessment: string;
  scores: CriterionScore[];
}

interface InterviewScorecardProps {
  candidateId: string;
  criteria: Criterion[];
}

// ─── Persistence Helpers ─────────────────────────────────────────────────────

function getStorageKey(candidateId: string): string {
  return `interview-scorecard-${candidateId}`;
}

function loadFromStorage(candidateId: string): {
  notes: string;
  result: ScorecardResult | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(candidateId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(
  candidateId: string,
  notes: string,
  result: ScorecardResult | null
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getStorageKey(candidateId),
      JSON.stringify({ notes, result })
    );
  } catch {
    // localStorage might be full — fail silently
  }
}

// ─── Rating Config ───────────────────────────────────────────────────────────

const RATING_CONFIG: Record<Rating, { dot: string; bg: string; text: string }> = {
  Strong: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  Moderate: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  Weak: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  "Not assessed": { dot: "bg-gray-300", bg: "bg-gray-50", text: "text-gray-500" },
};

// ─── Fallback Client-Side Analysis ──────────────────────────────────────────

function fallbackAnalysis(notes: string, criteria: Criterion[]): ScorecardResult {
  const lower = notes.toLowerCase();

  const positiveSignals = [
    "excellent", "strong", "impressive", "great", "exceptional",
    "demonstrated", "clearly", "solid", "confident", "well",
  ];
  const negativeSignals = [
    "weak", "lacking", "unclear", "struggled", "hesitant",
    "unsure", "no experience", "gap", "concern", "missing",
  ];

  const scores: CriterionScore[] = criteria.map((c) => {
    const criterionLower = c.label.toLowerCase();
    const words = criterionLower.split(/\s+/);

    // Check if the notes mention this criterion
    const mentioned = words.some((w) => w.length > 3 && lower.includes(w));

    if (!mentioned) {
      return { criterion: c.label, rating: "Not assessed" as Rating, evidence: "Not discussed in interview notes." };
    }

    // Simple sentiment around criterion keywords
    const sentences = notes.split(/[.!?\n]+/).filter((s) =>
      words.some((w) => w.length > 3 && s.toLowerCase().includes(w))
    );
    const relevantText = sentences.slice(0, 2).join(". ").trim();

    const hasPositive = positiveSignals.some((s) => relevantText.toLowerCase().includes(s));
    const hasNegative = negativeSignals.some((s) => relevantText.toLowerCase().includes(s));

    let rating: Rating = "Moderate";
    if (hasPositive && !hasNegative) rating = "Strong";
    else if (hasNegative && !hasPositive) rating = "Weak";

    return {
      criterion: c.label,
      rating,
      evidence: relevantText || "Mentioned but no specific evidence captured.",
    };
  });

  // Overall assessment
  const strongCount = scores.filter((s) => s.rating === "Strong").length;
  const weakCount = scores.filter((s) => s.rating === "Weak").length;
  const total = scores.length;

  let overallAssessment: string;
  if (strongCount > total / 2) {
    overallAssessment = "Strong candidate — demonstrated strength in majority of criteria.";
  } else if (weakCount > total / 2) {
    overallAssessment = "Below expectations — showed weakness in majority of criteria.";
  } else {
    overallAssessment = "Mixed signals — candidate shows varied performance across criteria.";
  }

  return { overallAssessment, scores };
}

// ─── API Call ────────────────────────────────────────────────────────────────

async function generateScorecard(
  notes: string,
  criteria: Criterion[]
): Promise<ScorecardResult> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${API_URL}/api/v1/ai/interview-scorecard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, criteria }),
    });

    if (!response.ok) {
      throw new Error(`Scorecard generation failed: ${response.status}`);
    }

    return (await response.json()) as ScorecardResult;
  } catch (error) {
    console.error("AI scorecard generation failed, using fallback:", error);
    return fallbackAnalysis(notes, criteria);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InterviewScorecard({ candidateId, criteria }: InterviewScorecardProps) {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ScorecardResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    const stored = loadFromStorage(candidateId);
    if (stored) {
      setNotes(stored.notes);
      setResult(stored.result);
    }
  }, [candidateId]);

  const handleGenerate = useCallback(async () => {
    if (!notes.trim()) return;
    setIsGenerating(true);
    try {
      const scorecard = await generateScorecard(notes, criteria);
      setResult(scorecard);
      saveToStorage(candidateId, notes, scorecard);
    } finally {
      setIsGenerating(false);
    }
  }, [notes, criteria, candidateId]);

  const handleClear = () => {
    setNotes("");
    setResult(null);
    saveToStorage(candidateId, "", null);
  };

  return (
    <SectionCard
      title="Interview Notes"
      icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {/* Overall Score Summary */}
        {result && (
          <div className="rounded-[12px] border border-indigo-100 bg-indigo-50/50 p-4">
            <p className="text-sm font-medium text-navy">Overall Assessment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.overallAssessment}
            </p>
          </div>
        )}

        {/* Scorecard Results */}
        {result && (
          <div className="space-y-2">
            {result.scores.map((score) => {
              const config = RATING_CONFIG[score.rating];
              return (
                <div
                  key={score.criterion}
                  className="rounded-[12px] border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy">
                      {score.criterion}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        config.bg,
                        config.text
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} aria-hidden="true" />
                      {score.rating}
                    </span>
                  </div>
                  {score.evidence && score.rating !== "Not assessed" && (
                    <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">
                      &ldquo;{score.evidence}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea for notes input */}
        <div className="space-y-2">
          <label htmlFor="interview-notes" className="block text-sm font-medium text-navy">
            Paste Interview Notes
          </label>
          <textarea
            id="interview-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              // Persist notes as they type
              saveToStorage(candidateId, e.target.value, result);
            }}
            placeholder="Paste your raw interview notes here... The AI will analyze them against the project's ranking criteria."
            className={cn(
              "w-full min-h-[140px] resize-y rounded-[12px] border border-border",
              "bg-white px-4 py-3 text-sm text-navy placeholder:text-muted-foreground",
              "focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100",
              "transition-colors"
            )}
            aria-label="Interview notes"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!notes.trim() || isGenerating}
            className="h-9 rounded-[12px] bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Generating...
              </>
            ) : (
              "Generate Scorecard"
            )}
          </Button>
          {result && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="h-9 rounded-[12px] px-4 text-sm"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
