"""Business logic for Candidate Comparison.

Handles loading candidates with their scores and building comparison data.

Requirements: 12.1, 12.4
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database.session import get_current_org_id
from app.core.security.exceptions import NotFoundException, ValidationException
from app.features.comparison.schemas import (
    ComparedCandidateResponse,
    CompareResponse,
    ComparisonDimensions,
    CriterionScoreResponse,
)
from app.models.candidates import Candidate
from app.models.candidate_scores import CandidateScore


class ComparisonService:
    """Service layer for candidate comparison operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def compare_candidates(
        self, candidate_ids: list[UUID]
    ) -> CompareResponse:
        """Compare 2-4 candidates side by side.

        Loads each candidate's profile and criterion scores,
        then builds a comparison response with aligned scores
        and comparison dimensions.

        Args:
            candidate_ids: List of 2-4 candidate UUIDs.

        Returns:
            CompareResponse with all candidates' data.

        Raises:
            ValidationException: If fewer than 2 or more than 4 candidates.
            NotFoundException: If any candidate is not found.
        """
        if len(candidate_ids) < 2 or len(candidate_ids) > 4:
            raise ValidationException(
                message="Between 2 and 4 candidates must be selected for comparison"
            )

        # Load all candidates with their scores, org-scoped
        candidates = await self._load_candidates(candidate_ids)

        # Verify all requested candidates were found
        found_ids = {c.id for c in candidates}
        missing_ids = set(candidate_ids) - found_ids
        if missing_ids:
            raise NotFoundException(
                message="One or more candidates were not found"
            )

        # Build comparison response
        compared = []
        for candidate in candidates:
            criterion_scores = self._build_criterion_scores(candidate)
            dimensions = self._extract_comparison_dimensions(candidate)
            compared.append(
                ComparedCandidateResponse(
                    id=candidate.id,
                    full_name=candidate.full_name,
                    match_score=candidate.match_score,
                    criterion_scores=criterion_scores,
                    comparison_dimensions=dimensions,
                )
            )

        return CompareResponse(candidates=compared)

    async def _load_candidates(
        self, candidate_ids: list[UUID]
    ) -> list[Candidate]:
        """Load candidates by IDs with their scores, org-scoped.

        Uses eager loading to fetch scores in one query.
        """
        org_id = get_current_org_id()

        query = (
            select(Candidate)
            .options(selectinload(Candidate.scores))
            .where(
                Candidate.id.in_(candidate_ids),
                Candidate.deleted_at.is_(None),
            )
        )

        # Apply org-scoping
        if org_id:
            query = query.where(Candidate.organization_id == org_id)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    def _build_criterion_scores(
        self, candidate: Candidate
    ) -> list[CriterionScoreResponse]:
        """Build criterion score responses from a candidate's scores."""
        return [
            CriterionScoreResponse(
                criterion_id=score.ranking_criteria_id,
                raw_score=score.raw_score,
                normalized_score=float(score.normalized_score),
                reasoning=score.reasoning,
            )
            for score in candidate.scores
        ]

    def _extract_comparison_dimensions(
        self, candidate: Candidate
    ) -> ComparisonDimensions:
        """Extract comparison dimensions from candidate parsed data.

        Dimensions are derived from the candidate's parsed_data JSON field.
        If a dimension has no data, it will be None (indicating "no data").
        """
        parsed = candidate.parsed_data or {}

        return ComparisonDimensions(
            experience=self._summarize_experience(parsed),
            technical_skills=self._summarize_skills(parsed),
            leadership=self._extract_dimension(parsed, "leadership"),
            education=self._summarize_education(parsed),
            projects=self._extract_dimension(parsed, "projects"),
            career_growth=self._extract_dimension(parsed, "career_growth"),
            job_stability=self._extract_dimension(parsed, "job_stability"),
            industry_knowledge=self._extract_dimension(parsed, "industry_knowledge"),
            communication=self._extract_dimension(parsed, "communication"),
        )

    def _summarize_experience(self, parsed_data: dict) -> Optional[str]:
        """Summarize work experience from parsed data."""
        experience = parsed_data.get("experience") or parsed_data.get("work_experience")
        if not experience:
            return None
        if isinstance(experience, list):
            # Summarize as a comma-separated list of roles/companies
            summaries = []
            for exp in experience[:3]:  # Top 3 experiences
                if isinstance(exp, dict):
                    role = exp.get("title") or exp.get("role", "")
                    company = exp.get("company", "")
                    if role and company:
                        summaries.append(f"{role} at {company}")
                    elif role:
                        summaries.append(role)
                elif isinstance(exp, str):
                    summaries.append(exp)
            return "; ".join(summaries) if summaries else None
        if isinstance(experience, str):
            return experience
        return None

    def _summarize_skills(self, parsed_data: dict) -> Optional[str]:
        """Summarize technical skills from parsed data."""
        skills = parsed_data.get("skills") or parsed_data.get("technical_skills")
        if not skills:
            return None
        if isinstance(skills, list):
            return ", ".join(str(s) for s in skills[:10])  # Top 10 skills
        if isinstance(skills, str):
            return skills
        return None

    def _summarize_education(self, parsed_data: dict) -> Optional[str]:
        """Summarize education from parsed data."""
        education = parsed_data.get("education")
        if not education:
            return None
        if isinstance(education, list):
            summaries = []
            for edu in education[:2]:  # Top 2 education entries
                if isinstance(edu, dict):
                    degree = edu.get("degree", "")
                    institution = edu.get("institution") or edu.get("school", "")
                    if degree and institution:
                        summaries.append(f"{degree}, {institution}")
                    elif degree:
                        summaries.append(degree)
                elif isinstance(edu, str):
                    summaries.append(edu)
            return "; ".join(summaries) if summaries else None
        if isinstance(education, str):
            return education
        return None

    def _extract_dimension(self, parsed_data: dict, key: str) -> Optional[str]:
        """Extract a generic dimension from parsed data.

        Handles string values and list values by joining them.
        """
        value = parsed_data.get(key)
        if value is None:
            return None
        if isinstance(value, str):
            return value if value else None
        if isinstance(value, list):
            items = [str(item) for item in value if item]
            return ", ".join(items) if items else None
        return str(value) if value else None
