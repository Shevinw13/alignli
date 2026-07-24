"""Unit tests for score recalculation on weight changes.

Tests cover:
- recalculate_project() recalculates all candidates with updated weights
- Handles missing scores (new criteria added)
- Returns 0 when no criteria or no candidates exist
- Updates both candidate.match_score and candidate_scores.weighted_score
- Deterministic: same raw scores + same weights = same results

Requirements: 15.4
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.scoring.engine import (
    CriterionInput,
    Priority,
    calculate_match_score,
)
from app.features.scoring.recalculation import recalculate_project


def _make_ranking_criteria(
    criterion_id: uuid.UUID,
    hiring_project_id: uuid.UUID,
    priority: str = "High",
    max_score: int = 100,
) -> MagicMock:
    """Create a mock RankingCriteria object."""
    rc = MagicMock()
    rc.id = criterion_id
    rc.hiring_project_id = hiring_project_id
    rc.priority = priority
    rc.max_score = max_score
    rc.weight = Decimal("0.5000")
    rc.deleted_at = None
    return rc


def _make_candidate(
    candidate_id: uuid.UUID,
    hiring_project_id: uuid.UUID,
    match_score: Optional[int] = 75,
) -> MagicMock:
    """Create a mock Candidate object."""
    c = MagicMock()
    c.id = candidate_id
    c.hiring_project_id = hiring_project_id
    c.match_score = match_score
    c.deleted_at = None
    c.updated_at = datetime.now(timezone.utc)
    return c


def _make_candidate_score(
    candidate_id: uuid.UUID,
    ranking_criteria_id: uuid.UUID,
    raw_score: int = 80,
    normalized_score: Decimal = Decimal("80.0000"),
    weighted_score: Decimal = Decimal("240.0000"),
    reasoning: str = "Good candidate",
) -> MagicMock:
    """Create a mock CandidateScore object."""
    cs = MagicMock()
    cs.candidate_id = candidate_id
    cs.ranking_criteria_id = ranking_criteria_id
    cs.raw_score = raw_score
    cs.normalized_score = normalized_score
    cs.weighted_score = weighted_score
    cs.reasoning = reasoning
    cs.updated_at = datetime.now(timezone.utc)
    return cs


class _MockScalarsResult:
    """Mock for SQLAlchemy scalars result."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def all(self) -> List[Any]:
        return self._items


class _MockResult:
    """Mock for SQLAlchemy execute result."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def scalars(self) -> _MockScalarsResult:
        return _MockScalarsResult(self._items)


@pytest.fixture
def project_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def criterion_id_1() -> uuid.UUID:
    return uuid.UUID("22222222-2222-2222-2222-222222222222")


@pytest.fixture
def criterion_id_2() -> uuid.UUID:
    return uuid.UUID("33333333-3333-3333-3333-333333333333")


@pytest.fixture
def candidate_id_1() -> uuid.UUID:
    return uuid.UUID("44444444-4444-4444-4444-444444444444")


@pytest.fixture
def candidate_id_2() -> uuid.UUID:
    return uuid.UUID("55555555-5555-5555-5555-555555555555")


@pytest.mark.asyncio
async def test_recalculate_project_no_criteria(project_id):
    """Returns 0 when no criteria exist for the project."""
    session = AsyncMock()
    # First query returns no criteria
    session.execute.return_value = _MockResult([])

    result = await recalculate_project(project_id, session)
    assert result == 0


@pytest.mark.asyncio
async def test_recalculate_project_no_candidates(
    project_id, criterion_id_1
):
    """Returns 0 when no candidates exist for the project."""
    session = AsyncMock()

    criteria = [_make_ranking_criteria(criterion_id_1, project_id)]
    # First call: criteria query, Second call: candidates query
    session.execute.side_effect = [
        _MockResult(criteria),
        _MockResult([]),  # No candidates
    ]

    result = await recalculate_project(project_id, session)
    assert result == 0


@pytest.mark.asyncio
async def test_recalculate_project_single_candidate(
    project_id, criterion_id_1, candidate_id_1
):
    """Single candidate is recalculated with updated weights."""
    session = AsyncMock()

    criteria = [
        _make_ranking_criteria(criterion_id_1, project_id, priority="High", max_score=100)
    ]
    candidate = _make_candidate(candidate_id_1, project_id, match_score=50)
    candidate_score = _make_candidate_score(
        candidate_id_1, criterion_id_1, raw_score=80
    )

    session.execute.side_effect = [
        _MockResult(criteria),       # criteria query
        _MockResult([candidate]),    # candidates query
        _MockResult([candidate_score]),  # candidate scores query
    ]

    result = await recalculate_project(project_id, session)

    assert result == 1
    # With raw_score=80, max_score=100, priority=High:
    # normalized = 80/100 * 100 = 80
    # weight = 3 (High)
    # weighted = 80 * 3 = 240
    # match_score = round(240 / 3) = 80
    assert candidate.match_score == 80
    session.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_recalculate_project_multiple_candidates(
    project_id, criterion_id_1, candidate_id_1, candidate_id_2
):
    """All candidates in the project are recalculated."""
    session = AsyncMock()

    criteria = [
        _make_ranking_criteria(criterion_id_1, project_id, priority="Medium", max_score=100)
    ]
    candidate1 = _make_candidate(candidate_id_1, project_id, match_score=50)
    candidate2 = _make_candidate(candidate_id_2, project_id, match_score=60)
    score1 = _make_candidate_score(candidate_id_1, criterion_id_1, raw_score=70)
    score2 = _make_candidate_score(candidate_id_2, criterion_id_1, raw_score=90)

    session.execute.side_effect = [
        _MockResult(criteria),                # criteria query
        _MockResult([candidate1, candidate2]),  # candidates query
        _MockResult([score1]),                 # candidate1 scores
        _MockResult([score2]),                 # candidate2 scores
    ]

    result = await recalculate_project(project_id, session)

    assert result == 2
    # candidate1: raw=70, max=100, Medium (weight=2)
    # normalized = 70, weighted = 140, match = round(140/2) = 70
    assert candidate1.match_score == 70
    # candidate2: raw=90, max=100, Medium (weight=2)
    # normalized = 90, weighted = 180, match = round(180/2) = 90
    assert candidate2.match_score == 90


@pytest.mark.asyncio
async def test_recalculate_project_multiple_criteria(
    project_id, criterion_id_1, criterion_id_2, candidate_id_1
):
    """Multiple criteria produce correct weighted average."""
    session = AsyncMock()

    criteria = [
        _make_ranking_criteria(criterion_id_1, project_id, priority="High", max_score=100),
        _make_ranking_criteria(criterion_id_2, project_id, priority="Low", max_score=50),
    ]
    candidate = _make_candidate(candidate_id_1, project_id)
    score1 = _make_candidate_score(candidate_id_1, criterion_id_1, raw_score=80)
    score2 = _make_candidate_score(candidate_id_1, criterion_id_2, raw_score=25)

    session.execute.side_effect = [
        _MockResult(criteria),            # criteria query
        _MockResult([candidate]),         # candidates query
        _MockResult([score1, score2]),    # candidate scores
    ]

    result = await recalculate_project(project_id, session)

    assert result == 1
    # criterion_1: raw=80, max=100, High (weight=3)
    #   normalized = 80, weighted = 240
    # criterion_2: raw=25, max=50, Low (weight=1)
    #   normalized = (25/50)*100 = 50, weighted = 50
    # total_weighted = 240 + 50 = 290
    # total_weight = 3 + 1 = 4
    # match_score = round(290 / 4) = round(72.5) = 72
    assert candidate.match_score == 72


@pytest.mark.asyncio
async def test_recalculate_project_missing_score_for_criterion(
    project_id, criterion_id_1, criterion_id_2, candidate_id_1
):
    """Missing score for a criterion is treated as 0 (missing data)."""
    session = AsyncMock()

    criteria = [
        _make_ranking_criteria(criterion_id_1, project_id, priority="High", max_score=100),
        _make_ranking_criteria(criterion_id_2, project_id, priority="High", max_score=100),
    ]
    candidate = _make_candidate(candidate_id_1, project_id)
    # Only one score exists - criterion_2 has no score
    score1 = _make_candidate_score(candidate_id_1, criterion_id_1, raw_score=100)

    session.execute.side_effect = [
        _MockResult(criteria),
        _MockResult([candidate]),
        _MockResult([score1]),  # Only score for criterion_1
    ]

    result = await recalculate_project(project_id, session)

    assert result == 1
    # criterion_1: raw=100, max=100, High (weight=3)
    #   normalized = 100, weighted = 300
    # criterion_2: missing → raw=0, normalized=0, weighted=0
    # total_weighted = 300 + 0 = 300
    # total_weight = 3 + 3 = 6
    # match_score = round(300 / 6) = 50
    assert candidate.match_score == 50


@pytest.mark.asyncio
async def test_recalculate_updates_weighted_score_on_candidate_scores(
    project_id, criterion_id_1, candidate_id_1
):
    """Candidate score records are updated with new normalized and weighted scores."""
    session = AsyncMock()

    criteria = [
        _make_ranking_criteria(criterion_id_1, project_id, priority="Medium", max_score=100)
    ]
    candidate = _make_candidate(candidate_id_1, project_id)
    score = _make_candidate_score(
        candidate_id_1,
        criterion_id_1,
        raw_score=60,
        normalized_score=Decimal("60.0000"),
        weighted_score=Decimal("180.0000"),  # old weight was High (3)
    )

    session.execute.side_effect = [
        _MockResult(criteria),
        _MockResult([candidate]),
        _MockResult([score]),
    ]

    await recalculate_project(project_id, session)

    # With Medium priority (weight=2), raw=60, max=100:
    # normalized = 60.0, weighted = 60 * 2 = 120
    assert score.normalized_score == Decimal("60.0000")
    assert score.weighted_score == Decimal("120.0000")


@pytest.mark.asyncio
async def test_recalculate_project_deterministic(
    project_id, criterion_id_1, candidate_id_1
):
    """Same inputs always produce same output (determinism)."""
    async def run_recalculation():
        session = AsyncMock()
        criteria = [
            _make_ranking_criteria(criterion_id_1, project_id, priority="High", max_score=100)
        ]
        candidate = _make_candidate(candidate_id_1, project_id, match_score=0)
        score = _make_candidate_score(candidate_id_1, criterion_id_1, raw_score=73)

        session.execute.side_effect = [
            _MockResult(criteria),
            _MockResult([candidate]),
            _MockResult([score]),
        ]

        await recalculate_project(project_id, session)
        return candidate.match_score

    result1 = await run_recalculation()
    result2 = await run_recalculation()
    assert result1 == result2
    assert result1 == 73  # 73/100 normalized=73, weight=3, weighted=219, match=round(219/3)=73
