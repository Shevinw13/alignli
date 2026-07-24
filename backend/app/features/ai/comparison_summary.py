"""AI Comparison Summary generation.

Generates evidence-based comparison narratives by loading candidate profiles
and calling the AI service with the CANDIDATE_COMPARISON prompt type.

The AI_Engine SHALL reference only data extracted from candidate profiles
and SHALL NOT rely solely on numeric scores to justify ranking differences.

Requirements: 12.3, 12.5, 12.6
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database.session import get_current_org_id
from app.core.security.exceptions import NotFoundException, ValidationException
from app.features.ai.service import AIService, AIServiceResponse, PromptType
from app.models.candidates import Candidate


class DimensionAnalysis(BaseModel):
    """A single comparison dimension analysis."""

    dimension: str
    analysis: str
    ranking: list[str] = Field(default_factory=list)


class ComparisonSummaryResponse(BaseModel):
    """Response from the AI comparison summary endpoint."""

    summary: str
    differentiators: list[DimensionAnalysis] = Field(default_factory=list)


class ComparisonSummaryService:
    """Service that generates AI-powered comparison summaries.

    Loads candidate profiles, formats them as evidence for the AI prompt,
    and returns a structured comparison narrative referencing specific
    data points from candidate profiles.
    """

    def __init__(self, session: AsyncSession, ai_service: Optional[AIService] = None) -> None:
        self.session = session
        self._ai_service = ai_service

    @property
    def ai_service(self) -> AIService:
        """Lazy-initialize the AI service on first access."""
        if self._ai_service is None:
            self._ai_service = AIService()
        return self._ai_service

    async def generate_summary(
        self,
        candidate_ids: list[uuid.UUID],
        organization_id: Optional[uuid.UUID] = None,
    ) -> ComparisonSummaryResponse:
        """Generate an evidence-based comparison summary for 2-4 candidates.

        Loads candidate profiles, formats their data as context, and calls
        the AI service to produce a comparison narrative.

        Args:
            candidate_ids: List of 2-4 candidate UUIDs.
            organization_id: Organization ID for AI response auditing.

        Returns:
            ComparisonSummaryResponse with narrative and differentiators.

        Raises:
            ValidationException: If fewer than 2 or more than 4 candidates.
            NotFoundException: If any candidate is not found.
        """
        if len(candidate_ids) < 2 or len(candidate_ids) > 4:
            raise ValidationException(
                message="Between 2 and 4 candidates must be selected for comparison"
            )

        # Load candidate profiles
        candidates = await self._load_candidates(candidate_ids)

        # Verify all requested candidates were found
        found_ids = {c.id for c in candidates}
        missing_ids = set(candidate_ids) - found_ids
        if missing_ids:
            raise NotFoundException(
                message="One or more candidates were not found"
            )

        # Build the prompt content from candidate profiles
        user_content = self._build_prompt_content(candidates)

        # Call AI service
        ai_response = await self.ai_service.call(
            prompt_type=PromptType.CANDIDATE_COMPARISON,
            user_content=user_content,
            db=self.session,
            organization_id=organization_id,
        )

        # Parse AI response into structured format
        return self._parse_ai_response(ai_response, candidates)

    async def _load_candidates(
        self, candidate_ids: list[uuid.UUID]
    ) -> list[Candidate]:
        """Load candidates by IDs with their scores, org-scoped."""
        org_id = get_current_org_id()

        query = (
            select(Candidate)
            .options(selectinload(Candidate.scores))
            .where(
                Candidate.id.in_(candidate_ids),
                Candidate.deleted_at.is_(None),
            )
        )

        if org_id:
            query = query.where(Candidate.organization_id == org_id)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    def _build_prompt_content(self, candidates: list[Candidate]) -> str:
        """Build user content for the AI prompt from candidate profiles.

        Formats each candidate's profile data as structured text that the AI
        can reference for evidence-based comparison. Includes parsed_data,
        scores, strengths, concerns, and key profile fields.
        """
        candidate_sections = []

        for candidate in candidates:
            section = self._format_candidate_profile(candidate)
            candidate_sections.append(section)

        return "\n\n---\n\n".join(candidate_sections)

    def _format_candidate_profile(self, candidate: Candidate) -> str:
        """Format a single candidate's profile for the AI prompt.

        References only extracted profile data — not just numeric scores.
        """
        lines = [f"## Candidate: {candidate.full_name or 'Unknown'} (ID: {candidate.id})"]

        # Basic profile info
        if candidate.current_company:
            lines.append(f"Current Company: {candidate.current_company}")
        if candidate.location:
            lines.append(f"Location: {candidate.location}")
        if candidate.years_experience is not None:
            lines.append(f"Years of Experience: {candidate.years_experience}")
        if candidate.match_score is not None:
            lines.append(f"Match Score: {candidate.match_score}/100")

        # Parsed data (the full extracted resume content)
        parsed = candidate.parsed_data or {}
        if parsed:
            lines.append("\n### Extracted Profile Data:")
            lines.append(self._format_parsed_data(parsed))

        # Strengths
        if candidate.strengths:
            lines.append("\n### Strengths:")
            for strength in candidate.strengths:
                if isinstance(strength, str):
                    lines.append(f"- {strength}")
                elif isinstance(strength, dict):
                    lines.append(f"- {strength.get('description', str(strength))}")

        # Concerns
        if candidate.concerns:
            lines.append("\n### Concerns:")
            for concern in candidate.concerns:
                if isinstance(concern, str):
                    lines.append(f"- {concern}")
                elif isinstance(concern, dict):
                    lines.append(f"- {concern.get('description', str(concern))}")

        # Criterion scores with reasoning
        if candidate.scores:
            lines.append("\n### Criterion Scores:")
            for score in candidate.scores:
                lines.append(
                    f"- Score: {score.raw_score}/100 | Reasoning: {score.reasoning}"
                )

        # Summary
        if candidate.summary:
            lines.append(f"\n### AI Summary:\n{candidate.summary}")

        return "\n".join(lines)

    def _format_parsed_data(self, parsed: dict[str, Any]) -> str:
        """Format parsed_data dict into readable text for the AI prompt."""
        lines = []

        # Work experience
        experience = parsed.get("experience") or parsed.get("work_experience")
        if experience:
            lines.append("  Work Experience:")
            if isinstance(experience, list):
                for exp in experience:
                    if isinstance(exp, dict):
                        role = exp.get("title") or exp.get("role", "")
                        company = exp.get("company", "")
                        duration = exp.get("duration", "")
                        desc = exp.get("description", "")
                        entry = f"    - {role}"
                        if company:
                            entry += f" at {company}"
                        if duration:
                            entry += f" ({duration})"
                        lines.append(entry)
                        if desc:
                            lines.append(f"      {desc[:200]}")
                    elif isinstance(exp, str):
                        lines.append(f"    - {exp}")
            elif isinstance(experience, str):
                lines.append(f"    {experience}")

        # Education
        education = parsed.get("education")
        if education:
            lines.append("  Education:")
            if isinstance(education, list):
                for edu in education:
                    if isinstance(edu, dict):
                        degree = edu.get("degree", "")
                        institution = edu.get("institution") or edu.get("school", "")
                        entry = f"    - {degree}"
                        if institution:
                            entry += f" from {institution}"
                        lines.append(entry)
                    elif isinstance(edu, str):
                        lines.append(f"    - {edu}")
            elif isinstance(education, str):
                lines.append(f"    {education}")

        # Skills
        skills = parsed.get("skills") or parsed.get("technical_skills")
        if skills:
            lines.append("  Skills:")
            if isinstance(skills, list):
                lines.append(f"    {', '.join(str(s) for s in skills)}")
            elif isinstance(skills, str):
                lines.append(f"    {skills}")

        # Certifications
        certs = parsed.get("certifications")
        if certs:
            lines.append("  Certifications:")
            if isinstance(certs, list):
                for cert in certs:
                    if isinstance(cert, dict):
                        lines.append(f"    - {cert.get('name', str(cert))}")
                    elif isinstance(cert, str):
                        lines.append(f"    - {cert}")

        # Projects
        projects = parsed.get("projects")
        if projects:
            lines.append("  Projects:")
            if isinstance(projects, list):
                for proj in projects:
                    if isinstance(proj, dict):
                        lines.append(f"    - {proj.get('name', str(proj))}")
                    elif isinstance(proj, str):
                        lines.append(f"    - {proj}")

        # Other fields
        for key in ("leadership", "career_growth", "job_stability",
                    "industry_knowledge", "communication"):
            value = parsed.get(key)
            if value:
                lines.append(f"  {key.replace('_', ' ').title()}: {value}")

        return "\n".join(lines) if lines else "  No structured data available."

    def _parse_ai_response(
        self,
        ai_response: AIServiceResponse,
        candidates: list[Candidate],
    ) -> ComparisonSummaryResponse:
        """Parse the AI response into a ComparisonSummaryResponse.

        Handles both successful structured responses and error/fallback cases.
        """
        if ai_response.error or not ai_response.content:
            # Return a fallback response if AI call failed
            return ComparisonSummaryResponse(
                summary="Unable to generate comparison summary at this time.",
                differentiators=[],
            )

        content = ai_response.content

        # Extract the summary narrative
        summary = content.get("comparison_summary", "")
        if not summary:
            # Try alternate field names
            summary = content.get("summary", content.get("raw_response", ""))

        # Extract dimension analyses
        differentiators: list[DimensionAnalysis] = []
        dimensions = content.get("dimensions", [])
        if isinstance(dimensions, list):
            for dim in dimensions:
                if isinstance(dim, dict):
                    differentiators.append(
                        DimensionAnalysis(
                            dimension=dim.get("dimension", ""),
                            analysis=dim.get("analysis", ""),
                            ranking=dim.get("ranking", []),
                        )
                    )

        return ComparisonSummaryResponse(
            summary=summary,
            differentiators=differentiators,
        )
