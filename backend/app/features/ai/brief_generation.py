"""AI Brief generation for Hiring Projects.

Generates a project overview brief containing:
- Total candidate count
- Score distribution (excellent/strong/review)
- Top 3 candidates
- Up to 3 patterns in the applicant pool
- Recommended action
- Summary narrative

For zero candidates, returns a minimal response without calling AI.

Requirements: 9.2, 9.3, 9.4, 9.5
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.ai.service import AIService, AIServiceResponse, PromptType
from app.features.candidates.repository import CandidateRepository


class TopCandidate(BaseModel):
    """A top candidate highlight in the brief."""

    name: str
    score: int


class ScoreDistribution(BaseModel):
    """Score distribution breakdown."""

    excellent: int = 0  # 95-100
    strong: int = 0  # 80-94
    review: int = 0  # 0-79


class BriefResponse(BaseModel):
    """Response schema for AI Brief generation."""

    total_candidates: int
    score_distribution: Optional[ScoreDistribution] = None
    top_candidates: Optional[list[TopCandidate]] = None
    patterns: Optional[list[str]] = None
    recommended_action: Optional[str] = None
    summary: Optional[str] = None


def _compute_score_distribution(candidates: list[Any]) -> ScoreDistribution:
    """Compute score distribution from a list of candidates.

    Categories:
    - excellent: 95-100
    - strong: 80-94
    - review: 0-79
    """
    excellent = 0
    strong = 0
    review = 0

    for c in candidates:
        score = c.match_score
        if score is None:
            review += 1
        elif score >= 95:
            excellent += 1
        elif score >= 80:
            strong += 1
        else:
            review += 1

    return ScoreDistribution(excellent=excellent, strong=strong, review=review)


def _get_top_candidates(candidates: list[Any], limit: int = 3) -> list[TopCandidate]:
    """Get the top N candidates sorted by match_score descending.

    Candidates with None scores are excluded.
    """
    scored = [c for c in candidates if c.match_score is not None]
    scored.sort(key=lambda c: c.match_score, reverse=True)

    top = scored[:limit]
    return [
        TopCandidate(
            name=c.full_name or "Unknown",
            score=c.match_score,
        )
        for c in top
    ]


def _build_ai_input(
    candidates: list[Any],
    score_distribution: ScoreDistribution,
    top_candidates: list[TopCandidate],
) -> str:
    """Build the user content string to send to the AI for brief generation."""
    candidate_summaries = []
    for c in candidates:
        entry = {
            "name": c.full_name or "Unknown",
            "score": c.match_score,
            "current_company": c.current_company,
            "location": c.location,
            "years_experience": c.years_experience,
            "confidence_level": c.confidence_level,
        }
        candidate_summaries.append(entry)

    input_data = {
        "total_candidates": len(candidates),
        "score_distribution": score_distribution.model_dump(),
        "top_candidates": [tc.model_dump() for tc in top_candidates],
        "candidates": candidate_summaries,
    }

    return json.dumps(input_data, indent=2)


async def generate_brief(
    project_id: uuid.UUID,
    session: AsyncSession,
    ai_service: AIService,
    organization_id: Optional[uuid.UUID] = None,
) -> BriefResponse:
    """Generate an AI Brief for a hiring project.

    Loads all candidates for the project, computes stats, and calls the
    AI service with PromptType.AI_BRIEF to generate the brief.

    For zero candidates, returns a minimal response without calling AI.

    Args:
        project_id: UUID of the hiring project.
        session: Database session (org-scoped).
        ai_service: Instance of AIService for AI calls.
        organization_id: Organization ID for audit trail.

    Returns:
        BriefResponse with the generated brief data.
    """
    # Load all candidates for the project
    repo = CandidateRepository(session)
    result = await repo.list_by_project(
        project_id=project_id,
        page=1,
        page_size=1000,  # Load all candidates for brief generation
    )
    candidates = result.items

    # Handle zero-candidates case
    if not candidates:
        return BriefResponse(
            total_candidates=0,
            summary="No candidates have been added yet.",
        )

    # Compute statistics
    score_distribution = _compute_score_distribution(candidates)
    top_candidates = _get_top_candidates(candidates, limit=3)

    # Build AI input
    ai_input = _build_ai_input(candidates, score_distribution, top_candidates)

    # Call AI service
    ai_response: AIServiceResponse = await ai_service.call(
        prompt_type=PromptType.AI_BRIEF,
        user_content=ai_input,
        db=session,
        organization_id=organization_id,
        hiring_project_id=project_id,
    )

    # If AI call failed, return stats without AI-generated content
    if ai_response.error or ai_response.content is None:
        return BriefResponse(
            total_candidates=len(candidates),
            score_distribution=score_distribution,
            top_candidates=top_candidates,
            summary=f"We analyzed {len(candidates)} resumes but could not generate a full brief at this time.",
        )

    # Parse AI response
    content = ai_response.content
    patterns = content.get("patterns", [])
    if patterns and len(patterns) > 3:
        patterns = patterns[:3]

    recommended_action = content.get("recommended_action")

    # Build summary from AI or generate a default
    summary = content.get("summary")
    if not summary:
        summary = (
            f"We analyzed {len(candidates)} resumes. "
            f"{score_distribution.excellent} candidates scored excellent, "
            f"{score_distribution.strong} scored strong, "
            f"and {score_distribution.review} need further review."
        )

    return BriefResponse(
        total_candidates=len(candidates),
        score_distribution=score_distribution,
        top_candidates=top_candidates,
        patterns=patterns if patterns else None,
        recommended_action=recommended_action,
        summary=summary,
    )
