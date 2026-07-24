"""Unit tests for the deterministic scoring engine.

Tests cover:
- normalize_score() bounds and correctness
- derive_weight() mapping from priority
- calculate_match_score() with various inputs
- Missing data handling
- Reasoning truncation
- Determinism (same inputs → same output)
"""

import uuid

import pytest

from app.features.scoring.engine import (
    MISSING_DATA_REASONING,
    MAX_REASONING_LENGTH,
    CriterionInput,
    Priority,
    ScoringResult,
    calculate_match_score,
    derive_weight,
    normalize_score,
)


class TestNormalizeScore:
    """Tests for normalize_score()."""

    def test_perfect_score(self):
        """raw_score == max_score should normalize to 100."""
        assert normalize_score(100, 100) == 100.0

    def test_zero_score(self):
        """raw_score == 0 should normalize to 0."""
        assert normalize_score(0, 100) == 0.0

    def test_half_score(self):
        """raw_score == max_score / 2 should normalize to 50."""
        assert normalize_score(50, 100) == 50.0

    def test_custom_max_score(self):
        """Normalization with max_score != 100."""
        # 3 out of 10 → 30.0
        assert normalize_score(3, 10) == 30.0

    def test_max_score_of_1(self):
        """Edge case: max_score of 1."""
        assert normalize_score(1, 1) == 100.0
        assert normalize_score(0, 1) == 0.0

    def test_invalid_max_score_zero(self):
        """max_score < 1 should raise ValueError."""
        with pytest.raises(ValueError, match="max_score must be >= 1"):
            normalize_score(0, 0)

    def test_invalid_negative_raw_score(self):
        """Negative raw_score should raise ValueError."""
        with pytest.raises(ValueError, match="raw_score must be >= 0"):
            normalize_score(-1, 100)

    def test_raw_exceeds_max(self):
        """raw_score > max_score should raise ValueError."""
        with pytest.raises(ValueError, match="cannot exceed max_score"):
            normalize_score(101, 100)


class TestDeriveWeight:
    """Tests for derive_weight()."""

    def test_low_priority(self):
        assert derive_weight(Priority.LOW) == 1

    def test_medium_priority(self):
        assert derive_weight(Priority.MEDIUM) == 2

    def test_high_priority(self):
        assert derive_weight(Priority.HIGH) == 3


class TestCalculateMatchScore:
    """Tests for calculate_match_score()."""

    def _make_criterion(
        self,
        raw_score=80,
        max_score=100,
        priority=Priority.HIGH,
        reasoning="Good match",
    ) -> CriterionInput:
        return CriterionInput(
            criterion_id=uuid.uuid4(),
            raw_score=raw_score,
            max_score=max_score,
            priority=priority,
            reasoning=reasoning,
        )

    def test_empty_criteria_returns_zero(self):
        """No criteria should produce match_score of 0."""
        result = calculate_match_score([])
        assert result.match_score == 0
        assert result.criterion_scores == []

    def test_single_criterion_perfect_score(self):
        """Single criterion with perfect score → 100."""
        criteria = [self._make_criterion(raw_score=100, max_score=100)]
        result = calculate_match_score(criteria)
        assert result.match_score == 100

    def test_single_criterion_zero_score(self):
        """Single criterion with zero score → 0."""
        criteria = [self._make_criterion(raw_score=0, max_score=100)]
        result = calculate_match_score(criteria)
        assert result.match_score == 0

    def test_weighted_average_calculation(self):
        """Multiple criteria with different weights produce correct weighted average."""
        criteria = [
            # High priority (weight=3), score=100/100 → normalized=100, weighted=300
            self._make_criterion(raw_score=100, max_score=100, priority=Priority.HIGH),
            # Low priority (weight=1), score=0/100 → normalized=0, weighted=0
            self._make_criterion(raw_score=0, max_score=100, priority=Priority.LOW),
        ]
        result = calculate_match_score(criteria)
        # total_weighted = 300 + 0 = 300
        # total_weight = 3 + 1 = 4
        # match_score = round(300 / 4) = 75
        assert result.match_score == 75

    def test_all_same_priority(self):
        """All criteria with same priority → simple average of normalized scores."""
        criteria = [
            self._make_criterion(raw_score=80, max_score=100, priority=Priority.MEDIUM),
            self._make_criterion(raw_score=60, max_score=100, priority=Priority.MEDIUM),
        ]
        result = calculate_match_score(criteria)
        # Both weight=2: (80*2 + 60*2) / (2+2) = 280/4 = 70
        assert result.match_score == 70

    def test_custom_max_scores(self):
        """Criteria with different max_scores are normalized correctly."""
        criteria = [
            # 5/10 → normalized=50, weight=2, weighted=100
            self._make_criterion(raw_score=5, max_score=10, priority=Priority.MEDIUM),
            # 90/100 → normalized=90, weight=2, weighted=180
            self._make_criterion(raw_score=90, max_score=100, priority=Priority.MEDIUM),
        ]
        result = calculate_match_score(criteria)
        # total_weighted = 100 + 180 = 280
        # total_weight = 2 + 2 = 4
        # match_score = round(280 / 4) = 70
        assert result.match_score == 70

    def test_result_is_integer(self):
        """Match score must always be an integer."""
        criteria = [
            self._make_criterion(raw_score=33, max_score=100, priority=Priority.HIGH),
            self._make_criterion(raw_score=67, max_score=100, priority=Priority.LOW),
        ]
        result = calculate_match_score(criteria)
        assert isinstance(result.match_score, int)

    def test_result_bounded_0_100(self):
        """Match score is always in [0, 100]."""
        criteria = [
            self._make_criterion(raw_score=100, max_score=100, priority=Priority.HIGH),
        ]
        result = calculate_match_score(criteria)
        assert 0 <= result.match_score <= 100

    def test_deterministic_same_inputs(self):
        """Same inputs always produce same output (determinism)."""
        cid = uuid.UUID("12345678-1234-5678-1234-567812345678")
        criteria = [
            CriterionInput(
                criterion_id=cid,
                raw_score=75,
                max_score=100,
                priority=Priority.HIGH,
                reasoning="Solid experience",
            ),
        ]
        result1 = calculate_match_score(criteria)
        result2 = calculate_match_score(criteria)
        assert result1.match_score == result2.match_score
        assert result1.criterion_scores[0].normalized_score == result2.criterion_scores[0].normalized_score
        assert result1.criterion_scores[0].weighted_score == result2.criterion_scores[0].weighted_score

    def test_missing_data_scores_zero(self):
        """Missing criterion data (raw_score=None) → score 0 with standard reasoning."""
        criteria = [
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=None,
                max_score=100,
                priority=Priority.HIGH,
                reasoning=None,
            ),
        ]
        result = calculate_match_score(criteria)
        assert result.match_score == 0
        score = result.criterion_scores[0]
        assert score.raw_score == 0
        assert score.normalized_score == 0.0
        assert score.weighted_score == 0.0
        assert score.reasoning == MISSING_DATA_REASONING

    def test_missing_data_mixed_with_valid(self):
        """Mix of valid and missing criteria handles correctly."""
        criteria = [
            # Valid: 100/100, High (weight=3) → normalized=100, weighted=300
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=100,
                max_score=100,
                priority=Priority.HIGH,
                reasoning="Perfect match",
            ),
            # Missing: 0, High (weight=3) → normalized=0, weighted=0
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=None,
                max_score=100,
                priority=Priority.HIGH,
                reasoning=None,
            ),
        ]
        result = calculate_match_score(criteria)
        # total_weighted = 300 + 0 = 300
        # total_weight = 3 + 3 = 6
        # match_score = round(300 / 6) = 50
        assert result.match_score == 50

    def test_reasoning_truncated_to_500_chars(self):
        """Reasoning longer than 500 chars is truncated."""
        long_reasoning = "x" * 600
        criteria = [
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=80,
                max_score=100,
                priority=Priority.MEDIUM,
                reasoning=long_reasoning,
            ),
        ]
        result = calculate_match_score(criteria)
        assert len(result.criterion_scores[0].reasoning) == MAX_REASONING_LENGTH

    def test_reasoning_at_exactly_500_chars(self):
        """Reasoning at exactly 500 chars is not truncated."""
        reasoning = "y" * 500
        criteria = [
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=80,
                max_score=100,
                priority=Priority.MEDIUM,
                reasoning=reasoning,
            ),
        ]
        result = calculate_match_score(criteria)
        assert result.criterion_scores[0].reasoning == reasoning

    def test_no_reasoning_provided_uses_default(self):
        """None reasoning on a valid score uses default reasoning."""
        criteria = [
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=80,
                max_score=100,
                priority=Priority.MEDIUM,
                reasoning=None,
            ),
        ]
        result = calculate_match_score(criteria)
        assert result.criterion_scores[0].reasoning == MISSING_DATA_REASONING

    def test_criterion_scores_populated(self):
        """ScoringResult.criterion_scores contains one entry per input."""
        criteria = [
            self._make_criterion(raw_score=50, max_score=100, priority=Priority.LOW),
            self._make_criterion(raw_score=75, max_score=100, priority=Priority.HIGH),
            self._make_criterion(raw_score=90, max_score=100, priority=Priority.MEDIUM),
        ]
        result = calculate_match_score(criteria)
        assert len(result.criterion_scores) == 3

    def test_rounding_behavior(self):
        """Verify rounding to nearest integer."""
        # Create a scenario that produces a fractional result
        criteria = [
            # 33/100, High (weight=3) → normalized=33, weighted=99
            self._make_criterion(raw_score=33, max_score=100, priority=Priority.HIGH),
            # 67/100, Low (weight=1) → normalized=67, weighted=67
            self._make_criterion(raw_score=67, max_score=100, priority=Priority.LOW),
        ]
        result = calculate_match_score(criteria)
        # total_weighted = 99 + 67 = 166
        # total_weight = 3 + 1 = 4
        # match_score = round(166 / 4) = round(41.5) = 42
        assert result.match_score == 42
