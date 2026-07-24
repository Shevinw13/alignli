"use client";

import { ComparisonSummary } from "./comparison-summary";
import { CandidateColumn } from "./candidate-column";
import { CriterionScoreRow } from "./criterion-score-row";
import { DimensionRow } from "./dimension-row";
import type {
  ComparisonCandidate,
  ComparisonSummaryData,
  CriterionScore,
} from "./types";
import { ALL_DIMENSION_KEYS, DIMENSION_LABELS } from "./types";

interface ComparisonViewProps {
  candidates: ComparisonCandidate[];
  summaryData: ComparisonSummaryData | null;
  summaryLoading: boolean;
}

/**
 * Collects all unique criteria across candidates for aligned row display.
 */
function getUniqueCriteria(
  candidates: ComparisonCandidate[]
): { criterionId: string; label: string; category: string }[] {
  const seen = new Map<string, { label: string; category: string }>();
  for (const candidate of candidates) {
    for (const score of candidate.criterionScores) {
      if (!seen.has(score.criterionId)) {
        seen.set(score.criterionId, {
          label: score.label,
          category: score.category,
        });
      }
    }
  }
  return Array.from(seen.entries()).map(([id, meta]) => ({
    criterionId: id,
    ...meta,
  }));
}

export function ComparisonView({
  candidates,
  summaryData,
  summaryLoading,
}: ComparisonViewProps) {
  const allCriteria = getUniqueCriteria(candidates);

  return (
    <div className="space-y-6">
      {/* AI Comparison Summary at top */}
      <ComparisonSummary data={summaryData} isLoading={summaryLoading} />

      {/* Candidate header columns */}
      <section
        className="rounded-[16px] border border-border bg-white p-6"
        aria-labelledby="comparison-candidates-heading"
      >
        <h2
          id="comparison-candidates-heading"
          className="text-base font-semibold text-navy mb-4"
        >
          Candidates
        </h2>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${candidates.length}, 1fr)`,
          }}
        >
          {candidates.map((candidate) => (
            <CandidateColumn key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </section>

      {/* Criterion Scores — aligned rows */}
      <section
        className="rounded-[16px] border border-border bg-white p-6"
        aria-labelledby="comparison-criteria-heading"
      >
        <h2
          id="comparison-criteria-heading"
          className="text-base font-semibold text-navy mb-4"
        >
          Ranking Criteria Scores
        </h2>
        <div className="overflow-x-auto">
          {allCriteria.length > 0 ? (
            allCriteria.map((criterion) => (
              <CriterionScoreRow
                key={criterion.criterionId}
                criterionId={criterion.criterionId}
                criterionLabel={criterion.label}
                criterionCategory={criterion.category}
                candidates={candidates}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No criteria scores available.
            </p>
          )}
        </div>
      </section>

      {/* Comparison Dimensions — aligned rows */}
      <section
        className="rounded-[16px] border border-border bg-white p-6"
        aria-labelledby="comparison-dimensions-heading"
      >
        <h2
          id="comparison-dimensions-heading"
          className="text-base font-semibold text-navy mb-4"
        >
          Comparison Dimensions
        </h2>
        <div className="overflow-x-auto">
          {ALL_DIMENSION_KEYS.map((key) => (
            <DimensionRow
              key={key}
              dimensionKey={key}
              dimensionLabel={DIMENSION_LABELS[key]}
              candidates={candidates}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
