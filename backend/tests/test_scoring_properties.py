"""Property-based tests for scoring determinism and normalization.

These tests verify universal scoring properties under randomized inputs:
- Property 1: Deterministic Scoring Produces Consistent Results
- Property 2: Score Normalization Bounds
- Property 3: Missing Data Criterion Scores Zero with Reasoning

Validates: Requirements 15.1, 15.2, 15.3, 15.5, 15.6
"""

from __future__ import annotations

import uuid

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.features.scoring.engine import (
    MISSING_DATA_REASONING,
    MAX_REASONING_LENGTH,
    CriterionInput,
    Priority,
    calculate_match_score,
    normalize_score,
)


# --- Strategies ---

# Priority strategy
priority_strategy = st.sampled_from([Priority.LOW, Priority.MEDIUM, Priority.HIGH])

# max_score: integer 1-100 as per the schema constraint
max_score_strategy = st.integers(min_value=1, max_value=100)

# Generate a valid raw_score given a max_score (0 to max_score)
def raw_score_strategy(max_score: int) -> st.SearchStrategy[int]:
    return st.integers(min_value=0, max_value=max_score)


# Generate a reasoning string (non-empty, up to 600 chars to test truncation too)
reasoning_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=600,
)

# Generate a valid CriterionInput with a present raw_score
@st.composite
def valid_criterion_strategy(draw: st.DrawFn) -> CriterionInput:
    max_score = draw(max_score_strategy)
    raw_score = draw(raw_score_strategy(max_score))
    priority = draw(priority_strategy)
    reasoning = draw(reasoning_strategy)
    return CriterionInput(
        criterion_id=uuid.uuid4(),
        raw_score=raw_score,
        max_score=max_score,
        priority=priority,
        reasoning=reasoning,
    )


# Generate a CriterionInput with missing data (raw_score=None)
@st.composite
def missing_criterion_strategy(draw: st.DrawFn) -> CriterionInput:
    max_score = draw(max_score_strategy)
    priority = draw(priority_strategy)
    return CriterionInput(
        criterion_id=uuid.uuid4(),
        raw_score=None,
        max_score=max_score,
        priority=priority,
        reasoning=None,
    )


# Generate a list of criteria (mix of valid and missing)
criteria_list_strategy = st.lists(
    st.one_of(valid_criterion_strategy(), missing_criterion_strategy()),
    min_size=1,
    max_size=20,
)

# Generate a list of only valid criteria (for determinism testing with fixed UUIDs)
valid_criteria_list_strategy = st.lists(
    valid_criterion_strategy(),
    min_size=1,
    max_size=20,
)


# --- Property 1: Deterministic Scoring Produces Consistent Results ---


class TestDeterministicScoringConsistency:
    """Property 1: Deterministic Scoring Produces Consistent Results.

    *For any* set of candidate criterion scores and ranking criteria weights,
    the Scoring Engine SHALL compute the final Match_Score as the same integer
    value every time, using only deterministic arithmetic.

    **Validates: Requirements 15.1, 15.2**
    """

    @given(
        max_scores=st.lists(max_score_strategy, min_size=1, max_size=10),
        priorities=st.lists(priority_strategy, min_size=1, max_size=10),
        data=st.data(),
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_same_inputs_always_produce_same_match_score(
        self, max_scores: list[int], priorities: list[Priority], data: st.DataObject
    ):
        """Same inputs always produce the same Match_Score."""
        # Use the shorter list length to pair them
        n = min(len(max_scores), len(priorities))
        max_scores = max_scores[:n]
        priorities = priorities[:n]

        # Generate fixed raw_scores based on max_scores
        raw_scores = [
            data.draw(raw_score_strategy(ms), label=f"raw_score_{i}")
            for i, ms in enumerate(max_scores)
        ]

        # Build criteria with fixed UUIDs for reproducibility
        fixed_ids = [uuid.UUID(int=i) for i in range(n)]
        criteria = [
            CriterionInput(
                criterion_id=fixed_ids[i],
                raw_score=raw_scores[i],
                max_score=max_scores[i],
                priority=priorities[i],
                reasoning="Test reasoning",
            )
            for i in range(n)
        ]

        # Score twice with identical inputs
        result1 = calculate_match_score(criteria)
        result2 = calculate_match_score(criteria)

        # Match scores must be identical
        assert result1.match_score == result2.match_score

        # Per-criterion scores must also be identical
        for s1, s2 in zip(result1.criterion_scores, result2.criterion_scores):
            assert s1.raw_score == s2.raw_score
            assert s1.normalized_score == s2.normalized_score
            assert s1.weighted_score == s2.weighted_score
            assert s1.reasoning == s2.reasoning

    @given(criteria=valid_criteria_list_strategy)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_scoring_is_idempotent(self, criteria: list[CriterionInput]):
        """Calling calculate_match_score multiple times yields the same result."""
        result_a = calculate_match_score(criteria)
        result_b = calculate_match_score(criteria)
        result_c = calculate_match_score(criteria)

        assert result_a.match_score == result_b.match_score == result_c.match_score


# --- Property 2: Score Normalization Bounds ---


class TestScoreNormalizationBounds:
    """Property 2: Score Normalization Bounds.

    *For any* raw criterion score (integer 0 to max_score) and any max_score
    (integer 1 to 100), the normalized score SHALL be in [0, 100], and the
    final weighted sum SHALL produce a Match_Score in [0, 100].

    **Validates: Requirements 15.5, 15.1**
    """

    @given(max_score=max_score_strategy, data=st.data())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_normalized_score_in_0_100(self, max_score: int, data: st.DataObject):
        """normalize_score always returns a value in [0, 100]."""
        raw_score = data.draw(raw_score_strategy(max_score), label="raw_score")

        result = normalize_score(raw_score, max_score)

        assert 0.0 <= result <= 100.0

    @given(criteria=criteria_list_strategy)
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_match_score_in_0_100(self, criteria: list[CriterionInput]):
        """Final Match_Score is always an integer in [0, 100]."""
        result = calculate_match_score(criteria)

        assert isinstance(result.match_score, int)
        assert 0 <= result.match_score <= 100

    @given(criteria=criteria_list_strategy)
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_all_criterion_normalized_scores_in_0_100(
        self, criteria: list[CriterionInput]
    ):
        """Every per-criterion normalized score is in [0, 100]."""
        result = calculate_match_score(criteria)

        for cs in result.criterion_scores:
            assert 0.0 <= cs.normalized_score <= 100.0


# --- Property 3: Missing Data Criterion Scores Zero with Reasoning ---


class TestMissingDataCriterionScoresZero:
    """Property 3: Missing Data Criterion Scores Zero with Reasoning.

    *For any* criterion that cannot be evaluated due to missing candidate data,
    the Scoring Engine SHALL assign a score of 0 and record reasoning indicating
    insufficient data, where the reasoning is a non-empty string of at most 500 chars.

    **Validates: Requirements 15.6, 15.3**
    """

    @given(criterion=missing_criterion_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_data_assigns_zero_score(self, criterion: CriterionInput):
        """Missing data (raw_score=None) always gets a raw_score of 0."""
        result = calculate_match_score([criterion])

        score = result.criterion_scores[0]
        assert score.raw_score == 0
        assert score.normalized_score == 0.0
        assert score.weighted_score == 0.0

    @given(criterion=missing_criterion_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_data_has_non_empty_reasoning(self, criterion: CriterionInput):
        """Missing data always has a non-empty reasoning string."""
        result = calculate_match_score([criterion])

        score = result.criterion_scores[0]
        assert len(score.reasoning) > 0

    @given(criterion=missing_criterion_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_data_reasoning_within_500_chars(self, criterion: CriterionInput):
        """Missing data reasoning is at most 500 characters."""
        result = calculate_match_score([criterion])

        score = result.criterion_scores[0]
        assert len(score.reasoning) <= MAX_REASONING_LENGTH

    @given(criterion=missing_criterion_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_data_reasoning_indicates_insufficient_data(
        self, criterion: CriterionInput
    ):
        """Missing data reasoning is the standard 'Insufficient data' message."""
        result = calculate_match_score([criterion])

        score = result.criterion_scores[0]
        assert score.reasoning == MISSING_DATA_REASONING

    @given(criteria=criteria_list_strategy)
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_all_criteria_have_reasoning_within_bounds(
        self, criteria: list[CriterionInput]
    ):
        """All scored criteria (valid or missing) have reasoning ≤500 chars and non-empty."""
        result = calculate_match_score(criteria)

        for cs in result.criterion_scores:
            assert len(cs.reasoning) > 0
            assert len(cs.reasoning) <= MAX_REASONING_LENGTH
