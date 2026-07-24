"""Deterministic scoring engine for candidate evaluation.

Calculates Match_Scores by computing the weighted sum of all normalized
criterion scores using only deterministic arithmetic operations.

Requirements: 15.1, 15.2, 15.3, 15.5, 15.6
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
from uuid import UUID


class Priority(str, Enum):
    """Priority levels for ranking criteria."""

    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# Deterministic weight mapping from priority levels
PRIORITY_WEIGHTS: dict[Priority, int] = {
    Priority.LOW: 1,
    Priority.MEDIUM: 2,
    Priority.HIGH: 3,
}

# Reasoning for missing/insufficient data
MISSING_DATA_REASONING = "Insufficient data for evaluation"

# Maximum allowed characters for reasoning
MAX_REASONING_LENGTH = 500


@dataclass
class CriterionInput:
    """Input data for a single ranking criterion to be scored."""

    criterion_id: UUID
    raw_score: Optional[int]  # None indicates missing data
    max_score: int  # 1-100
    priority: Priority
    reasoning: Optional[str] = None  # AI-provided reasoning for the score


@dataclass
class CriterionScore:
    """Result of scoring a single criterion."""

    criterion_id: UUID
    raw_score: int  # 0-100
    max_score: int  # 1-100
    normalized_score: float  # 0-100
    weighted_score: float
    reasoning: str  # max 500 chars


@dataclass
class ScoringResult:
    """Final scoring result for a candidate."""

    match_score: int  # 0-100 integer
    criterion_scores: List[CriterionScore] = field(default_factory=list)


def derive_weight(priority: Priority) -> int:
    """Derive numeric weight from a priority level.

    Args:
        priority: The priority level (Low, Medium, High).

    Returns:
        Integer weight: Low=1, Medium=2, High=3.
    """
    return PRIORITY_WEIGHTS[priority]


def normalize_score(raw_score: int, max_score: int) -> float:
    """Normalize a raw score to the 0-100 scale.

    Formula: normalized = (raw_score / max_score) * 100

    Args:
        raw_score: The raw criterion score (0 to max_score).
        max_score: The maximum possible score for this criterion (1-100).

    Returns:
        Normalized score in [0, 100].

    Raises:
        ValueError: If max_score < 1 or raw_score < 0 or raw_score > max_score.
    """
    if max_score < 1:
        raise ValueError(f"max_score must be >= 1, got {max_score}")
    if raw_score < 0:
        raise ValueError(f"raw_score must be >= 0, got {raw_score}")
    if raw_score > max_score:
        raise ValueError(f"raw_score ({raw_score}) cannot exceed max_score ({max_score})")

    return (raw_score / max_score) * 100.0


def _truncate_reasoning(reasoning: str) -> str:
    """Truncate reasoning to MAX_REASONING_LENGTH characters."""
    if len(reasoning) > MAX_REASONING_LENGTH:
        return reasoning[:MAX_REASONING_LENGTH]
    return reasoning


def _score_criterion(criterion: CriterionInput) -> CriterionScore:
    """Score a single criterion, handling missing data.

    If raw_score is None (missing data), assigns score 0 with
    "Insufficient data for evaluation" reasoning.

    Args:
        criterion: The criterion input data.

    Returns:
        CriterionScore with normalized and weighted values.
    """
    weight = derive_weight(criterion.priority)

    # Handle missing data
    if criterion.raw_score is None:
        return CriterionScore(
            criterion_id=criterion.criterion_id,
            raw_score=0,
            max_score=criterion.max_score,
            normalized_score=0.0,
            weighted_score=0.0,
            reasoning=MISSING_DATA_REASONING,
        )

    # Normalize the score
    normalized = normalize_score(criterion.raw_score, criterion.max_score)

    # Calculate weighted score
    weighted = normalized * weight

    # Determine reasoning
    reasoning = criterion.reasoning if criterion.reasoning else MISSING_DATA_REASONING
    reasoning = _truncate_reasoning(reasoning)

    return CriterionScore(
        criterion_id=criterion.criterion_id,
        raw_score=criterion.raw_score,
        max_score=criterion.max_score,
        normalized_score=normalized,
        weighted_score=weighted,
        reasoning=reasoning,
    )


def calculate_match_score(criteria: List[CriterionInput]) -> ScoringResult:
    """Calculate the overall match score from criterion inputs.

    Computes the weighted sum of all normalized criterion scores, then
    normalizes by the total weight to produce a final integer score 0-100.

    The calculation is fully deterministic: same inputs always produce
    the same output. No randomness is involved.

    Formula:
        match_score = round(sum(weighted_scores) / sum(weights))

    Where:
        weighted_score_i = normalize(raw_i, max_i) * weight_i
        weight_i = derive_weight(priority_i)

    Args:
        criteria: List of criterion inputs to score.

    Returns:
        ScoringResult with integer match_score (0-100) and per-criterion scores.
    """
    if not criteria:
        return ScoringResult(match_score=0, criterion_scores=[])

    criterion_scores: List[CriterionScore] = []
    total_weighted_score = 0.0
    total_weight = 0

    for criterion in criteria:
        scored = _score_criterion(criterion)
        criterion_scores.append(scored)

        weight = derive_weight(criterion.priority)
        total_weighted_score += scored.weighted_score
        total_weight += weight

    # Calculate final match score as weighted average
    if total_weight == 0:
        final_score = 0
    else:
        final_score = round(total_weighted_score / total_weight)

    # Clamp to [0, 100] for safety
    final_score = max(0, min(100, final_score))

    return ScoringResult(
        match_score=final_score,
        criterion_scores=criterion_scores,
    )
