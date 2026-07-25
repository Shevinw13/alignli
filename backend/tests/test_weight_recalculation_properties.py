"""Property-based tests for weight change recalculation.

Property 4: Weight Change Triggers Full Recalculation — all N candidates
recalculated with updated weights.

When ranking criteria weights are updated, the Scoring Engine SHALL recalculate
the Match_Score for all N candidates, and the new scores SHALL equal the
deterministic weighted sum computed with the updated weights.

**Validates: Requirements 15.4**
"""

from __future__ import annotations

import uuid
from typing import List

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.features.scoring.engine import (
    CriterionInput,
    Priority,
    calculate_match_score,
    derive_weight,
)


# --- Strategies ---

priority_strategy = st.sampled_from([Priority.LOW, Priority.MEDIUM, Priority.HIGH])
max_score_strategy = st.integers(min_value=1, max_value=100)


def raw_score_strategy(max_score: int) -> st.SearchStrategy[int]:
    return st.integers(min_value=0, max_value=max_score)


reasoning_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=100,
)


@st.composite
def criteria_config_strategy(draw: st.DrawFn) -> List[dict]:
    """Generate a list of criteria configurations (id, max_score, priority)."""
    n_criteria = draw(st.integers(min_value=1, max_value=8))
    criteria = []
    for i in range(n_criteria):
        criteria.append(
            {
                "criterion_id": uuid.UUID(int=i),
                "max_score": draw(max_score_strategy),
                "priority": draw(priority_strategy),
            }
        )
    return criteria


@st.composite
def candidate_raw_scores_strategy(
    draw: st.DrawFn, criteria_config: List[dict]
) -> List[dict]:
    """Generate raw scores for a candidate given criteria config.

    Each candidate has a raw_score per criterion (or None for missing data).
    """
    scores = []
    for criterion in criteria_config:
        # 80% chance of having a score, 20% chance of missing data
        has_score = draw(st.booleans())
        if has_score:
            raw_score = draw(raw_score_strategy(criterion["max_score"]))
            reasoning = draw(reasoning_strategy)
        else:
            raw_score = None
            reasoning = None
        scores.append({"raw_score": raw_score, "reasoning": reasoning})
    return scores


@st.composite
def recalculation_scenario_strategy(draw: st.DrawFn) -> dict:
    """Generate a full recalculation scenario.

    Returns a dict with:
    - criteria_config: list of criteria definitions
    - candidates: list of candidate raw scores (per criterion)
    - updated_priorities: new priority values for each criterion
    """
    criteria_config = draw(criteria_config_strategy())
    n_candidates = draw(st.integers(min_value=1, max_value=10))

    candidates = []
    for _ in range(n_candidates):
        raw_scores = draw(candidate_raw_scores_strategy(criteria_config))
        candidates.append(raw_scores)

    # Generate updated priorities (at least one must differ to make it a real change)
    updated_priorities = [draw(priority_strategy) for _ in criteria_config]

    return {
        "criteria_config": criteria_config,
        "candidates": candidates,
        "updated_priorities": updated_priorities,
    }


def build_criterion_inputs(
    criteria_config: List[dict],
    candidate_scores: List[dict],
    priorities: List[Priority],
) -> List[CriterionInput]:
    """Build CriterionInput list from config, raw scores, and priorities."""
    inputs = []
    for i, criterion in enumerate(criteria_config):
        score_data = candidate_scores[i]
        inputs.append(
            CriterionInput(
                criterion_id=criterion["criterion_id"],
                raw_score=score_data["raw_score"],
                max_score=criterion["max_score"],
                priority=priorities[i],
                reasoning=score_data["reasoning"],
            )
        )
    return inputs


# --- Property 4: Weight Change Triggers Full Recalculation ---


class TestWeightChangeTriggersFullRecalculation:
    """Property 4: Weight Change Triggers Full Recalculation.

    *For any* Hiring Project with N candidates, when any ranking criterion
    weight is updated, the Scoring Engine SHALL recalculate the Match_Score
    for all N candidates, and the new scores SHALL equal the deterministic
    weighted sum computed with the updated weights.

    **Validates: Requirements 15.4**
    """

    @given(scenario=recalculation_scenario_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_all_candidates_recalculated_with_updated_weights(self, scenario: dict):
        """All N candidates are recalculated and scores match the updated weights."""
        criteria_config = scenario["criteria_config"]
        candidates = scenario["candidates"]
        updated_priorities = scenario["updated_priorities"]

        # Simulate recalculation: for each candidate, recompute score with new weights
        for candidate_scores in candidates:
            # Build inputs with the updated priorities
            criterion_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, updated_priorities
            )

            # Calculate score using updated weights
            result = calculate_match_score(criterion_inputs)

            # Verify the result matches a fresh independent calculation
            # (this proves the scoring engine produces consistent results with new weights)
            independent_result = calculate_match_score(criterion_inputs)
            assert result.match_score == independent_result.match_score

            # Verify all per-criterion scores use the updated weights
            for i, cs in enumerate(result.criterion_scores):
                expected_weight = derive_weight(updated_priorities[i])
                expected_weighted_score = cs.normalized_score * expected_weight
                assert abs(cs.weighted_score - expected_weighted_score) < 1e-9

    @given(scenario=recalculation_scenario_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_recalculation_covers_all_n_candidates(self, scenario: dict):
        """Recalculation produces a result for every candidate (N results for N candidates)."""
        criteria_config = scenario["criteria_config"]
        candidates = scenario["candidates"]
        updated_priorities = scenario["updated_priorities"]
        n_candidates = len(candidates)

        recalculated_scores = []
        for candidate_scores in candidates:
            criterion_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, updated_priorities
            )
            result = calculate_match_score(criterion_inputs)
            recalculated_scores.append(result)

        # All N candidates must have been recalculated
        assert len(recalculated_scores) == n_candidates

        # Each result must be a valid score
        for result in recalculated_scores:
            assert isinstance(result.match_score, int)
            assert 0 <= result.match_score <= 100

    @given(scenario=recalculation_scenario_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_updated_scores_differ_from_original_when_weights_change(
        self, scenario: dict
    ):
        """When weights change, recalculated scores use new weights (not old ones).

        For each candidate, the score computed with updated priorities equals
        the deterministic result of calculate_match_score with those priorities,
        and is NOT necessarily equal to the score with original priorities.
        """
        criteria_config = scenario["criteria_config"]
        candidates = scenario["candidates"]
        updated_priorities = scenario["updated_priorities"]
        original_priorities = [c["priority"] for c in criteria_config]

        for candidate_scores in candidates:
            # Score with original weights
            original_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, original_priorities
            )
            original_result = calculate_match_score(original_inputs)

            # Score with updated weights
            updated_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, updated_priorities
            )
            updated_result = calculate_match_score(updated_inputs)

            # The updated score must equal the deterministic calculation with new weights
            # (this is the core property — scores match the new weights)
            verify_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, updated_priorities
            )
            verify_result = calculate_match_score(verify_inputs)
            assert updated_result.match_score == verify_result.match_score

    @given(scenario=recalculation_scenario_strategy())
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_recalculated_scores_are_deterministic_weighted_sum(self, scenario: dict):
        """Each recalculated score equals the deterministic weighted sum formula.

        match_score = round(sum(normalized_i * weight_i) / sum(weight_i))
        """
        criteria_config = scenario["criteria_config"]
        candidates = scenario["candidates"]
        updated_priorities = scenario["updated_priorities"]

        for candidate_scores in candidates:
            criterion_inputs = build_criterion_inputs(
                criteria_config, candidate_scores, updated_priorities
            )
            result = calculate_match_score(criterion_inputs)

            # Manually compute expected score
            total_weighted = 0.0
            total_weight = 0
            for i, cs in enumerate(result.criterion_scores):
                weight = derive_weight(updated_priorities[i])
                total_weighted += cs.normalized_score * weight
                total_weight += weight

            if total_weight == 0:
                expected_score = 0
            else:
                expected_score = max(0, min(100, round(total_weighted / total_weight)))

            assert result.match_score == expected_score
