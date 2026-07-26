"""API routes for Candidates.

Endpoints:
- GET /api/v1/projects/{project_id}/candidates
    List candidates (paginated, filtered, sorted by score DESC)
- POST /api/v1/projects/{project_id}/candidates/text
    Add candidates from pasted text
- GET /api/v1/candidates/{candidate_id} — Get full candidate profile
- POST /api/v1/candidates/{candidate_id}/hire — Mark candidate as hired

Requirements: 10.1, 10.6, 10.7, 11.1, 14.1, 14.2, 14.3, 14.7, 19.5
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.candidates.schemas import (
    AddCandidatesFromTextRequest,
    AddCandidatesFromTextResponse,
    CandidateCardResponse,
    CandidateListResponse,
    CandidateProfileResponse,
    ConfidenceLevel,
    HireCandidateResponse,
)
from app.features.candidates.service import CandidateService
from app.models.candidates import Candidate

# Router for project-scoped candidate list
candidates_list_router = APIRouter(
    prefix="/projects/{project_id}/candidates",
    tags=["Candidates"],
)

# Router for candidate profile (not project-scoped in URL)
candidates_profile_router = APIRouter(
    prefix="/candidates",
    tags=["Candidates"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> CandidateService:
    """Dependency to create CandidateService with the current session."""
    return CandidateService(session)


@candidates_list_router.get("", response_model=CandidateListResponse)
async def list_candidates(
    project_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=50, description="Items per page (max 50)"),
    min_score: Optional[int] = Query(
        None, ge=0, le=100, description="Minimum match score (0-100)"
    ),
    max_score: Optional[int] = Query(
        None, ge=0, le=100, description="Maximum match score (0-100)"
    ),
    confidence: Optional[ConfidenceLevel] = Query(
        None, description="Filter by confidence level"
    ),
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> CandidateListResponse:
    """List candidates for a hiring project.

    Returns candidates sorted by Match_Score descending with pagination.
    Supports filtering by score range and confidence level.
    """
    result = await service.list_candidates(
        project_id=project_id,
        page=page,
        page_size=page_size,
        min_score=min_score,
        max_score=max_score,
        confidence=confidence.value if confidence else None,
    )

    # Build card responses with truncated summaries
    items = [
        CandidateCardResponse(
            id=c.id,
            full_name=c.full_name,
            current_company=c.current_company,
            location=c.location,
            years_experience=c.years_experience,
            match_score=c.match_score,
            confidence_level=c.confidence_level,
            summary=CandidateService.truncate_summary(c.summary),
            processing_status=c.processing_status,
        )
        for c in result.items
    ]

    return CandidateListResponse(
        items=items,
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
        has_next=result.has_next,
        has_previous=result.has_previous,
    )


@candidates_profile_router.get(
    "/{candidate_id}", response_model=CandidateProfileResponse
)
async def get_candidate_profile(
    candidate_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> CandidateProfileResponse:
    """Get a full candidate profile.

    Returns all candidate fields including parsed data, AI-generated
    summary, strengths, concerns, and interview questions.
    Returns 404 if the candidate does not exist or belongs to a different org.
    """
    candidate = await service.get_candidate_profile(candidate_id)
    return CandidateProfileResponse.model_validate(candidate)


@candidates_profile_router.post(
    "/{candidate_id}/hire", response_model=HireCandidateResponse
)
async def hire_candidate(
    candidate_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> HireCandidateResponse:
    """Mark a candidate as hired.

    Updates the candidate's status to 'hired'. Returns 409 if the
    project is in Filled or Archived state. On success, includes a
    `project_fillable` flag indicating whether the frontend should
    prompt the user to close the hiring project.
    """
    result = await service.hire_candidate(candidate_id)
    return HireCandidateResponse(
        candidate=CandidateProfileResponse.model_validate(result.candidate),
        project_fillable=result.project_fillable,
    )


@candidates_list_router.post("/text", response_model=AddCandidatesFromTextResponse)
async def add_candidates_from_text(
    project_id: UUID,
    body: AddCandidatesFromTextRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AddCandidatesFromTextResponse:
    """Add candidates from pasted text (resume or LinkedIn profile content).

    Creates a Candidate record for each text entry with processing_status='pending'.
    The full text is stored in parsed_data for later AI analysis.
    """
    from app.core.database.session import get_current_org_id, set_current_org_id

    if not get_current_org_id() and user.org_id:
        set_current_org_id(user.org_id)

    org_id = get_current_org_id()
    created = 0

    for entry in body.candidates:
        # Parse name from first non-empty line
        full_name = _parse_name_from_text(entry.text)

        candidate = Candidate(
            hiring_project_id=project_id,
            organization_id=UUID(org_id) if org_id else project_id,
            full_name=full_name,
            processing_status="pending",
            status="active",
            parsed_data={"raw_text": entry.text, "source": entry.source},
        )
        session.add(candidate)
        created += 1

    await session.commit()

    return AddCandidatesFromTextResponse(created=created)


def _parse_name_from_text(text: str) -> Optional[str]:
    """Extract candidate name from the first line of pasted text."""
    lines = text.strip().split("\n")
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        # A name is typically short, not a URL or email
        if (
            len(trimmed) <= 60
            and not trimmed.startswith("http")
            and not trimmed.startswith("About")
            and not trimmed.startswith("Experience")
            and "@" not in trimmed
        ):
            return trimmed
        break
    return "Unknown"


from fastapi import UploadFile, File as FastAPIFile


@candidates_list_router.post("/upload")
async def upload_candidate_files(
    project_id: UUID,
    files: list[UploadFile] = FastAPIFile(...),
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Upload PDF/DOCX/TXT resume files. Extracts text and creates candidate records."""
    from app.core.database.session import get_current_org_id, set_current_org_id

    if not get_current_org_id() and user.org_id:
        set_current_org_id(user.org_id)

    org_id = get_current_org_id()
    created = 0
    errors = []

    for file in files:
        try:
            content = await file.read()
            text = _extract_text_from_file(content, file.filename or "unknown.pdf")

            if not text or len(text.strip()) < 20:
                errors.append({"filename": file.filename, "error": "Could not extract text from file"})
                continue

            full_name = _parse_name_from_text(text)

            candidate = Candidate(
                hiring_project_id=project_id,
                organization_id=UUID(org_id) if org_id else project_id,
                full_name=full_name,
                processing_status="pending",
                status="active",
                parsed_data={"raw_text": text, "source": "file", "filename": file.filename},
            )
            session.add(candidate)
            created += 1
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    await session.commit()
    return {"created": created, "errors": errors}


def _extract_text_from_file(content: bytes, filename: str) -> Optional[str]:
    """Extract text from PDF, DOCX, or TXT file bytes."""
    import io

    lower = filename.lower()

    if lower.endswith(".pdf"):
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n".join(text_parts)
        except Exception:
            return None

    elif lower.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
        except Exception:
            return None

    elif lower.endswith(".txt"):
        try:
            return content.decode("utf-8")
        except Exception:
            return content.decode("latin-1", errors="ignore")

    return None
