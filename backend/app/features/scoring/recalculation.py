"""Score recalculation when ranking criteria weights change.

When ranking criteria weights are updated for a project, all candidates
must be rescored using the existing raw scores combined with new weights.

Requirements: 15.4
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.scoring.engine import (
    CriterionInput,
    Priority,
    calculate_match_score,
    normalize_score,
)
from app.models.candidate_scores import CandidateScore
from app.models.candidates import Candidate
from app.models.ranking_criteria import RankingCriteria


async def recalculate_project(project_id: UUID, session: AsyncSession) -> int:
    """Recalculate all candidate scores when ranking criteria weights change.

    Loads all candidates in the project, retrieves current ranking criteria,
    and recomputes match_score for each candidate using existing raw scores
    and updated weights/priorities.

    Args:
        project_id: The hiring project ID whose candidates need rescoring.
        session: The async database session.

    Returns:
        The number of candidates recalculated.
    """
    # 1. Load updated ranking criteria for the project (non-deleted)
    criteria_query = (
        select(RankingCriteria)
        .where(RankingCriteria.hiring_project_id == project_id)
        .where(RankingCriteria.deleted_at.is_(None))
    )
    criteria_result = await session.execute(criteria_query)
    criteria: Sequence[RankingCriteria] = criteria_result.scalars().all()

    if not criteria:
        return 0

    # Build a lookup map: criteria_id -> RankingCriteria
    criteria_map: dict[UUID, RankingCriteria] = {c.id: c for c in criteria}

    # 2. Load all non-deleted candidates in the project
    candidates_query = (
        select(Candidate)
        .where(Candidate.hiring_project_id == project_id)
        .where(Candidate.deleted_at.is_(None))
    )
    candidates_result = await session.execute(candidates_query)
    candidates: Sequence[Candidate] = candidates_result.scalars().all()

    if not candidates:
        return 0

    # 3. For each candidate, reload scores and recalculate
    recalculated_count = 0

    for candidate in candidates:
        # Load existing candidate_scores for this candidate
        scores_query = select(CandidateScore).where(
            CandidateScore.candidate_id == candidate.id
        )
        scores_result = await session.execute(scores_query)
        candidate_scores: Sequence[CandidateScore] = scores_result.scalars().all()

        # Build CriterionInput list using existing raw_scores + updated criteria
        criterion_inputs: List[CriterionInput] = []
        scores_by_criteria: dict[UUID, CandidateScore] = {
            cs.ranking_criteria_id: cs for cs in candidate_scores
        }

        for criterion_id, criterion in criteria_map.items():
            existing_score = scores_by_criteria.get(criterion_id)

            if existing_score is not None:
                criterion_inputs.append(
                    CriterionInput(
                        criterion_id=criterion_id,
                        raw_score=existing_score.raw_score,
                        max_score=criterion.max_score,
                        priority=Priority(criterion.priority),
                        reasoning=existing_score.reasoning,
                    )
                )
            else:
                # No existing score for this criterion - treat as missing data
                criterion_inputs.append(
                    CriterionInput(
                        criterion_id=criterion_id,
                        raw_score=None,
                        max_score=criterion.max_score,
                        priority=Priority(criterion.priority),
                    )
                )

        # Recalculate using the scoring engine
        result = calculate_match_score(criterion_inputs)

        # 4. Update candidate.match_score
        candidate.match_score = result.match_score
        candidate.updated_at = datetime.now(timezone.utc)

        # Update individual candidate_scores with new normalized and weighted values
        for scored_criterion in result.criterion_scores:
            existing_score = scores_by_criteria.get(scored_criterion.criterion_id)
            if existing_score is not None:
                existing_score.normalized_score = Decimal(
                    str(round(scored_criterion.normalized_score, 4))
                )
                existing_score.weighted_score = Decimal(
                    str(round(scored_criterion.weighted_score, 4))
                )
                existing_score.updated_at = datetime.now(timezone.utc)

        recalculated_count += 1

    await session.flush()

    return recalculated_count
