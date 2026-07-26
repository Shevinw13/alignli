"""Candidate analysis service — scores candidates against a job description.

Uses Claude to evaluate each candidate's resume against the project's
job description and returns structured scoring data.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Optional

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.candidates import Candidate
from app.models.candidate_documents import CandidateDocument
from app.models.hiring_projects import HiringProject


SYSTEM_PROMPT = """You are an expert hiring evaluator. Score this candidate against the job description.

You MUST return valid JSON with exactly this structure:
{
  "score": <integer 0-100>,
  "summary": "<1 sentence summary of the candidate's fit>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "concerns": ["<concern 1>", "<concern 2>", ...],
  "redFlags": [
    {"type": "<gap|hopping|overqualified|inflation|mismatch>", "description": "<description>", "severity": "<low|medium|high>"}
  ],
  "interviewQuestions": ["<question 1>", "<question 2>", "<question 3>"]
}

Guidelines:
- Score reflects how well the candidate matches the specific job requirements
- Be fair and objective — focus on skills, experience, and role fit only
- Provide 3-5 interview questions tailored to this candidate's profile
- Red flags should only be included if genuinely concerning patterns exist
- An empty redFlags array is perfectly fine for strong candidates
"""


def _parse_json_response(text: str) -> Optional[dict[str, Any]]:
    """Parse JSON from AI response text, handling markdown code blocks."""
    text = text.strip()

    # Handle markdown code blocks
    if text.startswith("```"):
        lines = text.split("\n")
        start_idx = 1
        end_idx = len(lines) - 1
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end_idx = i
                break
        text = "\n".join(lines[start_idx:end_idx])

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def analyze_candidates(
    project_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """Analyze all candidates for a project against its job description.

    For each candidate with resume text (from documents or parsed_data),
    calls Claude to score them and stores the results in the candidates table.

    Returns:
        Dict with "analyzed" count and "errors" list.
    """
    settings = get_settings()

    # Fetch the project with its job description
    project_result = await db.execute(
        select(HiringProject).where(HiringProject.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise ValueError(f"Project {project_id} not found")

    job_description = project.job_description_raw or project.title
    if not job_description or len(job_description.strip()) < 10:
        job_description = f"Role: {project.title}, Location: {project.location}, Type: {project.employment_type}"

    # Fetch all candidates for this project
    candidates_result = await db.execute(
        select(Candidate)
        .where(Candidate.hiring_project_id == project_id)
        .where(Candidate.deleted_at.is_(None))
    )
    candidates = list(candidates_result.scalars().all())

    if not candidates:
        return {"analyzed": 0, "errors": [], "message": "No candidates found"}

    # Initialize the Anthropic client
    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=120,
    )

    analyzed = 0
    errors = []

    for candidate in candidates:
        # Get resume text from documents or parsed_data
        resume_text = await _get_resume_text(candidate, db)

        if not resume_text:
            # If no resume text, skip but don't error
            errors.append({
                "candidate_id": str(candidate.id),
                "name": candidate.full_name or "Unknown",
                "error": "No resume text available",
            })
            continue

        try:
            # Build user message
            user_message = (
                f"## Job Description\n{job_description}\n\n"
                f"## Candidate Resume\n{resume_text}"
            )

            # Call Claude
            message = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )

            # Extract text response
            raw_text = ""
            for block in message.content:
                if block.type == "text":
                    raw_text += block.text

            # Parse the JSON response
            result = _parse_json_response(raw_text)

            if result is None:
                errors.append({
                    "candidate_id": str(candidate.id),
                    "name": candidate.full_name or "Unknown",
                    "error": "Failed to parse AI response as JSON",
                })
                continue

            # Update candidate with results
            candidate.match_score = max(0, min(100, int(result.get("score", 0))))
            candidate.summary = result.get("summary", "")
            candidate.strengths = result.get("strengths", [])
            candidate.concerns = result.get("concerns", [])
            candidate.interview_questions = result.get("interviewQuestions", [])
            candidate.processing_status = "completed"
            candidate.confidence_level = "High"

            analyzed += 1

        except Exception as e:
            errors.append({
                "candidate_id": str(candidate.id),
                "name": candidate.full_name or "Unknown",
                "error": str(e),
            })

    # Commit all updates
    await db.commit()

    return {
        "analyzed": analyzed,
        "total": len(candidates),
        "errors": errors,
    }


async def _get_resume_text(candidate: Candidate, db: AsyncSession) -> Optional[str]:
    """Extract resume text for a candidate from documents or parsed_data."""
    # First try: extracted text from documents
    doc_result = await db.execute(
        select(CandidateDocument)
        .where(CandidateDocument.candidate_id == candidate.id)
        .where(CandidateDocument.deleted_at.is_(None))
        .where(CandidateDocument.extracted_text.isnot(None))
        .limit(1)
    )
    doc = doc_result.scalar_one_or_none()
    if doc and doc.extracted_text:
        return doc.extracted_text

    # Second try: parsed_data field (may contain resume text from paste/linkedin)
    if candidate.parsed_data:
        # Check various keys that might hold resume text
        for key in ("raw_text", "resume_text", "text", "content", "raw"):
            if key in candidate.parsed_data and candidate.parsed_data[key]:
                return str(candidate.parsed_data[key])

        # If parsed_data itself is substantial, serialize it
        text_repr = json.dumps(candidate.parsed_data, indent=2, default=str)
        if len(text_repr) > 100:
            return text_repr

    return None
