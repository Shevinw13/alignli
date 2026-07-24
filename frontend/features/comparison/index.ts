// Comparison feature module
// Side-by-side candidate comparison views
export {
  ComparisonView,
  ComparisonSummary,
  CriterionScoreRow,
  DimensionRow,
  CandidateColumn,
  type ComparisonCandidate,
  type ComparisonDimension,
  type CriterionScore,
  type ComparisonSummaryData,
} from "./components";

export {
  validateCandidateSelection,
  MIN_CANDIDATES,
  MAX_CANDIDATES,
  type ValidationResult,
} from "./utils";
