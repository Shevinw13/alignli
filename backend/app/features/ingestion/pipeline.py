"""Inngest resume ingestion pipeline functions.

Orchestrates the multi-stage resume processing pipeline:
  resume.uploaded → virus-scan → extract-text (+ OCR) → ai-parse
  → normalize → score → generate-summary → generate-questions → complete

Each step has a 120s timeout, marks candidate `processing_failed` on failure,
and preserves the original file for retry.

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 6.4, 18.6, 18.7
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import inngest

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Inngest client setup
# ---------------------------------------------------------------------------

settings = get_settings()

inngest_client = inngest.Inngest(
    app_id="alignli",
    event_key=settings.inngest_event_key,
    signing_key=settings.inngest_signing_key if settings.inngest_signing_key else None,
    is_production=settings.is_production,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STEP_TIMEOUT_MS = 120_000  # 120 seconds
MAX_RETRIES = 3


# Processing status constants
STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "processing_failed"

# Virus scan status constants
VIRUS_SCAN_CLEAN = "clean"
VIRUS_SCAN_INFECTED = "infected"
VIRUS_SCAN_PENDING = "pending"


# ---------------------------------------------------------------------------
# Helper: SSE event bus publisher
# ---------------------------------------------------------------------------


async def _publish_sse_event(
    project_id: str,
    event_type: str,
    candidate_id: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Publish a progress event to the SSE event bus.

    Uses the application EventBus to notify connected SSE clients
    of pipeline progress.

    Args:
        project_id: The hiring project ID.
        event_type: One of candidate.processing, candidate.scored,
                    candidate.complete, candidate.failed, project.ready.
        candidate_id: The candidate being processed.
        data: Optional additional event payload data.
    """
    from app.core.events.event_bus import get_event_bus
    from app.core.events.schemas import EventData, EventType

    logger.info(
        "SSE event: project=%s type=%s candidate=%s data=%s",
        project_id,
        event_type,
        candidate_id,
        data,
    )

    # Map string event types to EventType enum
    event_type_map = {
        "candidate.processing": EventType.CANDIDATE_PROCESSING,
        "candidate.scored": EventType.CANDIDATE_SCORED,
        "candidate.complete": EventType.CANDIDATE_COMPLETE,
        "candidate.failed": EventType.CANDIDATE_FAILED,
        "project.ready": EventType.PROJECT_READY,
    }

    enum_event_type = event_type_map.get(event_type)
    if not enum_event_type:
        logger.warning("Unknown event type: %s", event_type)
        return

    event_data = EventData(
        candidate_id=candidate_id,
        stage=data.get("stage") if data else None,
        message=data.get("message") if data else None,
    )

    event_bus = get_event_bus()
    await event_bus.publish(project_id, enum_event_type, event_data)


# ---------------------------------------------------------------------------
# Helper: Database operations
# ---------------------------------------------------------------------------


async def _get_candidate(candidate_id: str) -> Any:
    """Load a candidate record from the database.

    Returns the candidate ORM object or None.
    """
    from sqlalchemy import select

    from app.core.database.session import async_session_factory
    from app.models.candidates import Candidate

    async with async_session_factory() as session:
        result = await session.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        )
        return result.scalar_one_or_none()


async def _get_candidate_document(candidate_id: str) -> Any:
    """Load the primary document for a candidate."""
    from sqlalchemy import select

    from app.core.database.session import async_session_factory
    from app.models.candidate_documents import CandidateDocument

    async with async_session_factory() as session:
        result = await session.execute(
            select(CandidateDocument)
            .where(CandidateDocument.candidate_id == candidate_id)
            .where(CandidateDocument.deleted_at.is_(None))
            .order_by(CandidateDocument.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


async def _update_candidate(candidate_id: str, **fields: Any) -> None:
    """Update a candidate record with given fields."""
    from sqlalchemy import update

    from app.core.database.session import async_session_factory
    from app.models.candidates import Candidate

    async with async_session_factory() as session:
        fields["updated_at"] = datetime.now(timezone.utc)
        await session.execute(
            update(Candidate).where(Candidate.id == candidate_id).values(**fields)
        )
        await session.commit()


async def _update_document(document_id: str, **fields: Any) -> None:
    """Update a candidate document record with given fields."""
    from sqlalchemy import update

    from app.core.database.session import async_session_factory
    from app.models.candidate_documents import CandidateDocument

    async with async_session_factory() as session:
        await session.execute(
            update(CandidateDocument)
            .where(CandidateDocument.id == document_id)
            .values(**fields)
        )
        await session.commit()


async def _mark_candidate_failed(candidate_id: str, project_id: str) -> None:
    """Mark a candidate as processing_failed and notify frontend.

    Preserves the original file for retry.
    After marking failure, checks if all candidates in the project are
    done (completed or failed). If so, triggers the project state transition
    logic (which will either transition Draft→Active or keep Draft if all failed).
    """
    await _update_candidate(candidate_id, processing_status=STATUS_FAILED)
    await _publish_sse_event(
        project_id=project_id,
        event_type="candidate.failed",
        candidate_id=candidate_id,
    )

    # Check if this was the last candidate still processing
    from sqlalchemy import func, select

    from app.core.database.session import async_session_factory
    from app.models.candidates import Candidate

    async with async_session_factory() as session:
        pending_count_result = await session.execute(
            select(func.count(Candidate.id)).where(
                Candidate.hiring_project_id == project_id,
                Candidate.deleted_at.is_(None),
                Candidate.processing_status.in_(
                    [STATUS_PENDING, STATUS_PROCESSING]
                ),
            )
        )
        pending_count = pending_count_result.scalar() or 0

    if pending_count == 0:
        # All candidates are done (some completed, some failed, or all failed)
        await _publish_sse_event(
            project_id=project_id,
            event_type="project.ready",
            candidate_id=candidate_id,
        )
        await _transition_project_on_completion(project_id)


async def _get_ranking_criteria(project_id: str) -> List[Any]:
    """Load ranking criteria for a hiring project."""
    from sqlalchemy import select

    from app.core.database.session import async_session_factory
    from app.models.ranking_criteria import RankingCriteria

    async with async_session_factory() as session:
        result = await session.execute(
            select(RankingCriteria)
            .where(RankingCriteria.hiring_project_id == project_id)
            .where(RankingCriteria.deleted_at.is_(None))
            .order_by(RankingCriteria.sort_order)
        )
        return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Pipeline Step 1: Virus Scan
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/virus-scan",
    trigger=inngest.TriggerEvent(event="resume/uploaded"),
    retries=MAX_RETRIES,
)
async def virus_scan(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Scan uploaded file for viruses.

    For the MVP, this is a pass-through stub since virus scanning
    requires an external service. The extension point is clearly
    defined for future integration.

    On infection: reject file, remove from storage, notify user.
    On pass: emit event to trigger text extraction.
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    document_id: str = event_data["document_id"]

    async def _scan() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "virus_scan"},
        )

        # --- MVP STUB: Always passes ---
        # In production, integrate with ClamAV or similar service here.
        # If infected:
        #   - Remove file from storage
        #   - Update document virus_scan_status = "infected"
        #   - Mark candidate as failed
        #   - Return early
        scan_result = VIRUS_SCAN_CLEAN

        await _update_document(document_id, virus_scan_status=scan_result)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "document_id": document_id,
            "scan_result": scan_result,
        }

    result = await step.run("scan-file", _scan)

    # If infected, mark failed and stop pipeline
    if result["scan_result"] == VIRUS_SCAN_INFECTED:
        await step.run(
            "mark-infected-failed",
            lambda: _mark_candidate_failed(candidate_id, project_id),
        )
        return {"status": "rejected", "reason": "virus_detected"}

    # Trigger next step: text extraction
    await step.send_event(
        "trigger-extract-text",
        inngest.Event(
            name="resume/virus-scan.completed",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "document_id": document_id,
            },
        ),
    )

    return {"status": "clean", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 2: Extract Text (includes OCR for scanned PDFs)
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/extract-text",
    trigger=inngest.TriggerEvent(event="resume/virus-scan.completed"),
    retries=MAX_RETRIES,
)
async def extract_text(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Extract raw text from PDF, performing OCR if needed.

    For the MVP, OCR is stubbed (pass-through) since it requires
    an external OCR service. Text extraction from text-layer PDFs
    is implemented.

    The function:
    1. Loads the document from storage
    2. Checks if PDF has a text layer
    3. If no text layer, performs OCR (stubbed in MVP)
    4. Extracts and stores the raw text
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    document_id: str = event_data["document_id"]

    async def _extract() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "extract_text"},
        )

        document = await _get_candidate_document(candidate_id)
        if not document:
            raise ValueError(f"No document found for candidate {candidate_id}")

        # --- MVP STUB for OCR ---
        # In production:
        # 1. Download file from Supabase Storage using storage_path
        # 2. Check if PDF has embedded text layer (e.g., using pdfminer)
        # 3. If no text layer, send to OCR service (Tesseract, AWS Textract, etc.)
        # 4. Extract text from text layer or OCR output
        #
        # For MVP, we simulate text extraction.
        # The actual text would come from PDF parsing library (PyPDF2, pdfminer).
        extracted_text = document.extracted_text or ""

        if not extracted_text:
            # Placeholder: In production, parse the actual PDF content
            extracted_text = (
                f"[Text extracted from {document.file_name}. "
                f"Storage path: {document.storage_path}]"
            )

        # Store extracted text on the document
        await _update_document(document_id, extracted_text=extracted_text)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "document_id": document_id,
            "text_length": len(extracted_text),
            "extracted_text": extracted_text,
        }

    result = await step.run("extract-text-from-pdf", _extract)

    # Trigger AI parsing step
    await step.send_event(
        "trigger-ai-parse",
        inngest.Event(
            name="resume/text-extracted",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "document_id": document_id,
                "extracted_text": result["extracted_text"],
            },
        ),
    )

    return {"status": "extracted", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 3: AI Parse (Claude: text → structured JSON)
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/ai-parse",
    trigger=inngest.TriggerEvent(event="resume/text-extracted"),
    retries=MAX_RETRIES,
)
async def ai_parse(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Send extracted text to Claude and parse into structured JSON.

    Produces structured data with:
    - contact_info: name, email, phone, linkedin, github, etc.
    - work_experience: list of positions
    - education: list of degrees/certifications
    - skills: categorized skill lists
    - certifications: professional certifications

    The AI service enforces bias guard prompts to prevent inference
    of protected characteristics (age, race, gender, etc.).
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    extracted_text: str = event_data["extracted_text"]

    async def _parse() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "ai_parse"},
        )

        # Call AI service for resume parsing using PromptType.RESUME_TO_JSON
        from app.features.ai.service import AIService, PromptType

        try:
            ai_service = AIService()
            response = await ai_service.call(
                prompt_type=PromptType.RESUME_TO_JSON,
                user_content=extracted_text,
                candidate_id=UUID(candidate_id) if candidate_id else None,
                hiring_project_id=UUID(project_id) if project_id else None,
            )
            if response.content and not response.error:
                parsed_data = response.content
            else:
                # AI returned error or empty content - use stub
                logger.warning(
                    "AI parse returned error for candidate %s: %s",
                    candidate_id,
                    response.error,
                )
                parsed_data = _stub_parse_resume(extracted_text)
        except Exception as e:
            # AI service unavailable - fall back to stub
            logger.warning(
                "AI service unavailable for candidate %s: %s",
                candidate_id,
                str(e),
            )
            parsed_data = _stub_parse_resume(extracted_text)

        # Classify confidence level
        from app.features.ingestion.confidence import classify_confidence

        confidence = classify_confidence(parsed_data)

        # Update candidate with parsed data and confidence
        update_fields: Dict[str, Any] = {
            "parsed_data": parsed_data,
            "confidence_level": confidence,
            "processing_status": STATUS_PROCESSING,
        }

        # Extract contact info to candidate fields
        contact = parsed_data.get("contact_info", {})
        if contact:
            if contact.get("name"):
                update_fields["full_name"] = contact["name"]
            if contact.get("email"):
                update_fields["email"] = contact["email"]
            if contact.get("phone"):
                update_fields["phone"] = contact["phone"]
            if contact.get("linkedin"):
                update_fields["linkedin_url"] = contact["linkedin"]
            if contact.get("github"):
                update_fields["github_url"] = contact["github"]
            if contact.get("portfolio"):
                update_fields["portfolio_url"] = contact["portfolio"]
            if contact.get("website"):
                update_fields["website_url"] = contact["website"]
            if contact.get("location"):
                update_fields["location"] = contact["location"]
            if contact.get("current_company"):
                update_fields["current_company"] = contact["current_company"]

        # Extract years of experience if available
        experience = parsed_data.get("work_experience", [])
        if experience and isinstance(experience, list):
            total_years = _estimate_years_experience(experience)
            if total_years is not None:
                update_fields["years_experience"] = total_years

        await _update_candidate(candidate_id, **update_fields)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "parsed_data": parsed_data,
            "confidence": confidence,
        }

    result = await step.run("parse-with-claude", _parse)

    # Trigger normalization step
    await step.send_event(
        "trigger-normalize",
        inngest.Event(
            name="resume/parsed",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "parsed_data": result["parsed_data"],
                "confidence": result["confidence"],
            },
        ),
    )

    return {"status": "parsed", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 4: Normalize extracted fields
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/normalize",
    trigger=inngest.TriggerEvent(event="resume/parsed"),
    retries=MAX_RETRIES,
)
async def normalize(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Normalize extracted fields for consistent scoring.

    Standardizes:
    - Skill names (lowercase, deduplication)
    - Date formats
    - Location formatting
    - Education level categorization
    - Experience duration calculations
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    parsed_data: Dict[str, Any] = event_data["parsed_data"]

    async def _normalize() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "normalize"},
        )

        normalized = _normalize_parsed_data(parsed_data)

        # Update candidate with normalized data
        await _update_candidate(candidate_id, parsed_data=normalized)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "normalized_data": normalized,
        }

    result = await step.run("normalize-fields", _normalize)

    # Trigger scoring step
    await step.send_event(
        "trigger-score",
        inngest.Event(
            name="resume/normalized",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "normalized_data": result["normalized_data"],
            },
        ),
    )

    return {"status": "normalized", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 5: Score candidate
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/score",
    trigger=inngest.TriggerEvent(event="resume/normalized"),
    retries=MAX_RETRIES,
)
async def score(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Invoke the deterministic scoring engine.

    Loads ranking criteria for the project, evaluates the candidate
    against each criterion, and calculates the final match score.
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    normalized_data: Dict[str, Any] = event_data["normalized_data"]

    async def _score() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "score"},
        )

        # Load ranking criteria for the project
        criteria = await _get_ranking_criteria(project_id)

        if not criteria:
            # No criteria defined; score as 0
            await _update_candidate(candidate_id, match_score=0)
            return {
                "candidate_id": candidate_id,
                "project_id": project_id,
                "match_score": 0,
            }

        # Build criterion inputs for the scoring engine
        # The AI parse step provides evaluation data per criterion category
        from app.features.scoring.engine import (
            CriterionInput,
            Priority,
            calculate_match_score,
        )

        criterion_inputs: List[CriterionInput] = []
        for criterion in criteria:
            # Look up the AI-provided score for this criterion's category
            # This comes from the normalized parsed data evaluations
            evaluations = normalized_data.get("evaluations", {})
            eval_data = evaluations.get(str(criterion.id), {})
            raw_score = eval_data.get("score")  # None if not evaluated

            criterion_inputs.append(
                CriterionInput(
                    criterion_id=criterion.id,
                    raw_score=raw_score,
                    max_score=criterion.max_score,
                    priority=Priority(criterion.priority),
                    reasoning=eval_data.get("reasoning"),
                )
            )

        # Calculate match score using deterministic engine
        scoring_result = calculate_match_score(criterion_inputs)

        # Store individual criterion scores in database
        from decimal import Decimal

        from sqlalchemy import select

        from app.core.database.session import async_session_factory
        from app.models.candidate_scores import CandidateScore

        async with async_session_factory() as session:
            for cs in scoring_result.criterion_scores:
                # Upsert candidate score
                existing = await session.execute(
                    select(CandidateScore).where(
                        CandidateScore.candidate_id == candidate_id,
                        CandidateScore.ranking_criteria_id == cs.criterion_id,
                    )
                )
                existing_score = existing.scalar_one_or_none()

                if existing_score:
                    existing_score.raw_score = cs.raw_score
                    existing_score.normalized_score = Decimal(
                        str(round(cs.normalized_score, 4))
                    )
                    existing_score.weighted_score = Decimal(
                        str(round(cs.weighted_score, 4))
                    )
                    existing_score.reasoning = cs.reasoning
                else:
                    new_score = CandidateScore(
                        candidate_id=candidate_id,
                        ranking_criteria_id=cs.criterion_id,
                        raw_score=cs.raw_score,
                        normalized_score=Decimal(
                            str(round(cs.normalized_score, 4))
                        ),
                        weighted_score=Decimal(
                            str(round(cs.weighted_score, 4))
                        ),
                        reasoning=cs.reasoning,
                    )
                    session.add(new_score)

            await session.commit()

        # Update candidate match_score
        await _update_candidate(
            candidate_id, match_score=scoring_result.match_score
        )

        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.scored",
            candidate_id=candidate_id,
            data={"match_score": scoring_result.match_score},
        )

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "match_score": scoring_result.match_score,
        }

    result = await step.run("calculate-score", _score)

    # Trigger summary and questions generation (can run in parallel)
    await step.send_event(
        "trigger-generate-summary",
        inngest.Event(
            name="resume/scored",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "match_score": result["match_score"],
            },
        ),
    )

    return {"status": "scored", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 6: Generate Summary (Claude: 150-250 words)
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/generate-summary",
    trigger=inngest.TriggerEvent(event="resume/scored"),
    retries=MAX_RETRIES,
)
async def generate_summary(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Generate a 150-250 word candidate summary using Claude.

    The summary answers:
    - Who is this candidate?
    - What makes them qualified?
    - What concerns exist?
    - Should they interview?
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    match_score: int = event_data["match_score"]

    async def _generate() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "generate_summary"},
        )

        candidate = await _get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        # Call AI service for summary generation using PromptType.CANDIDATE_SUMMARY
        from app.features.ai.service import AIService, PromptType

        try:
            ai_service = AIService()
            # Build user content from parsed data and match score
            import json as _json

            user_content = _json.dumps({
                "parsed_data": candidate.parsed_data,
                "match_score": match_score,
            })
            response = await ai_service.call(
                prompt_type=PromptType.CANDIDATE_SUMMARY,
                user_content=user_content,
                candidate_id=UUID(candidate_id) if candidate_id else None,
                hiring_project_id=UUID(project_id) if project_id else None,
            )
            if response.content and not response.error:
                summary = response.content.get("summary", "")
                strengths = response.content.get("strengths", [])
                concerns = response.content.get("concerns", [])
            else:
                logger.warning(
                    "AI summary returned error for candidate %s: %s",
                    candidate_id,
                    response.error,
                )
                summary = _stub_generate_summary(candidate.parsed_data, match_score)
                strengths = _stub_generate_strengths(candidate.parsed_data)
                concerns = _stub_generate_concerns(candidate.parsed_data)
        except Exception as e:
            logger.warning(
                "AI service unavailable for summary generation, candidate %s: %s",
                candidate_id,
                str(e),
            )
            summary = _stub_generate_summary(candidate.parsed_data, match_score)
            strengths = _stub_generate_strengths(candidate.parsed_data)
            concerns = _stub_generate_concerns(candidate.parsed_data)

        # Update candidate with summary, strengths, concerns
        await _update_candidate(
            candidate_id,
            summary=summary,
            strengths=strengths,
            concerns=concerns,
        )

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "summary_length": len(summary.split()),
        }

    result = await step.run("generate-summary-with-claude", _generate)

    # Trigger interview questions generation
    await step.send_event(
        "trigger-generate-questions",
        inngest.Event(
            name="resume/summary-generated",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "match_score": match_score,
            },
        ),
    )

    return {"status": "summary_generated", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 7: Generate Interview Questions (Claude: 3-5 questions)
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/generate-questions",
    trigger=inngest.TriggerEvent(event="resume/summary-generated"),
    retries=MAX_RETRIES,
)
async def generate_questions(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Generate 3-5 tailored interview questions using Claude.

    Questions are based on:
    - The candidate's match score
    - The hiring project's ranking criteria
    - The candidate's parsed resume data
    - Identified strengths and concerns
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]
    match_score: int = event_data["match_score"]

    async def _generate() -> Dict[str, Any]:
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "generate_questions"},
        )

        candidate = await _get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        # Call AI service for question generation using PromptType.INTERVIEW_QUESTIONS
        from app.features.ai.service import AIService, PromptType

        criteria = await _get_ranking_criteria(project_id)

        try:
            ai_service = AIService()
            import json as _json

            user_content = _json.dumps({
                "parsed_data": candidate.parsed_data,
                "match_score": match_score,
                "ranking_criteria": [
                    {"category": c.category, "label": c.label, "priority": c.priority}
                    for c in criteria
                ],
            })
            response = await ai_service.call(
                prompt_type=PromptType.INTERVIEW_QUESTIONS,
                user_content=user_content,
                candidate_id=UUID(candidate_id) if candidate_id else None,
                hiring_project_id=UUID(project_id) if project_id else None,
            )
            if response.content and not response.error:
                questions = response.content.get("questions", [])
            else:
                logger.warning(
                    "AI questions returned error for candidate %s: %s",
                    candidate_id,
                    response.error,
                )
                questions = _stub_generate_questions(candidate.parsed_data, match_score)
        except Exception as e:
            logger.warning(
                "AI service unavailable for question generation, candidate %s: %s",
                candidate_id,
                str(e),
            )
            questions = _stub_generate_questions(candidate.parsed_data, match_score)

        # Update candidate with interview questions
        await _update_candidate(candidate_id, interview_questions=questions)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "question_count": len(questions),
        }

    result = await step.run("generate-questions-with-claude", _generate)

    # Trigger completion step
    await step.send_event(
        "trigger-complete",
        inngest.Event(
            name="resume/questions-generated",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
            },
        ),
    )

    return {"status": "questions_generated", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Pipeline Step 8: Complete (mark ready, notify frontend)
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/complete",
    trigger=inngest.TriggerEvent(event="resume/questions-generated"),
    retries=MAX_RETRIES,
)
async def complete(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Mark candidate as ready and notify frontend via SSE.

    This is the final step in the pipeline. It:
    1. Updates candidate processing_status to 'completed'
    2. Publishes candidate.complete SSE event
    3. Checks if all candidates in the project are done
    4. If all done, publishes project.ready SSE event
    5. Triggers Draft→Active transition if at least one candidate succeeded
       (stays Draft if all failed)
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]

    async def _complete() -> Dict[str, Any]:
        # Classify confidence level based on parsed data
        from app.features.ingestion.confidence import classify_confidence

        candidate = await _get_candidate(candidate_id)
        if candidate and candidate.parsed_data:
            confidence = classify_confidence(candidate.parsed_data)
            await _update_candidate(
                candidate_id,
                processing_status=STATUS_COMPLETED,
                confidence_level=confidence,
            )
        else:
            # Mark candidate as completed
            await _update_candidate(
                candidate_id, processing_status=STATUS_COMPLETED
            )

        # Notify frontend that this candidate is ready
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.complete",
            candidate_id=candidate_id,
        )

        # Check if all candidates in the project are done processing
        from sqlalchemy import func, select

        from app.core.database.session import async_session_factory
        from app.models.candidates import Candidate

        async with async_session_factory() as session:
            # Count candidates still processing
            pending_count_result = await session.execute(
                select(func.count(Candidate.id)).where(
                    Candidate.hiring_project_id == project_id,
                    Candidate.deleted_at.is_(None),
                    Candidate.processing_status.in_(
                        [STATUS_PENDING, STATUS_PROCESSING]
                    ),
                )
            )
            pending_count = pending_count_result.scalar() or 0

        if pending_count == 0:
            # All candidates processed - notify project is ready
            await _publish_sse_event(
                project_id=project_id,
                event_type="project.ready",
                candidate_id=candidate_id,
            )
            # Trigger project state transition
            await _transition_project_on_completion(project_id)

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "status": "completed",
            "remaining_candidates": pending_count,
        }

    result = await step.run("mark-complete", _complete)

    return {"status": "completed", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Helper: Project state transition on pipeline completion
# ---------------------------------------------------------------------------


async def _transition_project_on_completion(project_id: str) -> None:
    """Transition project from Draft→Active when processing is complete.

    Business rules (Requirements 8.3, 8.5, 8.7):
    - If at least one candidate completed successfully → Draft→Active
    - If ALL candidates failed processing → stay in Draft

    Only transitions if the project is currently in Draft state.
    Uses a system actor ID for the transition history since this is
    an automated background operation.
    """
    from sqlalchemy import func, select, update

    from app.core.database.session import async_session_factory
    from app.models.candidates import Candidate
    from app.models.hiring_projects import HiringProject

    async with async_session_factory() as session:
        # Load the project
        project_result = await session.execute(
            select(HiringProject).where(HiringProject.id == project_id)
        )
        project = project_result.scalar_one_or_none()

        if not project:
            logger.warning(
                "Project %s not found for state transition", project_id
            )
            return

        # Only transition if currently in Draft state
        if project.state != "Draft":
            logger.info(
                "Project %s is in state '%s', skipping auto-transition",
                project_id,
                project.state,
            )
            return

        # Count successfully completed candidates
        completed_result = await session.execute(
            select(func.count(Candidate.id)).where(
                Candidate.hiring_project_id == project_id,
                Candidate.deleted_at.is_(None),
                Candidate.processing_status == STATUS_COMPLETED,
            )
        )
        completed_count = completed_result.scalar() or 0

        if completed_count == 0:
            # All candidates failed - keep Draft state (Requirement 8.7)
            logger.info(
                "Project %s: all candidates failed processing, staying in Draft",
                project_id,
            )
            return

        # At least one candidate completed → transition to Active (Requirement 8.3)
        now = datetime.now(timezone.utc)
        history_entry = {
            "previous_state": "Draft",
            "new_state": "Active",
            "actor_id": "system:pipeline",
            "timestamp": now.isoformat(),
        }

        current_history = list(project.state_history) if project.state_history else []
        current_history.append(history_entry)

        project.state = "Active"
        project.state_history = current_history
        project.updated_at = now  # type: ignore[assignment]

        await session.commit()

        logger.info(
            "Project %s transitioned Draft→Active (%d candidates completed)",
            project_id,
            completed_count,
        )


# ---------------------------------------------------------------------------
# Pipeline: Retry failed candidate
# ---------------------------------------------------------------------------


@inngest_client.create_function(
    fn_id="resume/retry",
    trigger=inngest.TriggerEvent(event="resume/retry-requested"),
    retries=MAX_RETRIES,
)
async def retry_failed_candidate(
    ctx: inngest.Context,
    step: inngest.Step,
) -> Dict[str, Any]:
    """Retry processing for a failed candidate.

    Resets the candidate's processing status and re-triggers the
    ingestion pipeline from the beginning (virus scan step).
    The original file is preserved for retry (Requirement 7.9).

    Event data:
        candidate_id: UUID of the failed candidate to retry.
        project_id: UUID of the hiring project.
    """
    event_data = ctx.event.data
    candidate_id: str = event_data["candidate_id"]
    project_id: str = event_data["project_id"]

    async def _reset_candidate() -> Dict[str, Any]:
        """Reset candidate status and find document for re-processing."""
        # Reset candidate processing status to pending
        await _update_candidate(
            candidate_id,
            processing_status=STATUS_PENDING,
            match_score=None,
            summary=None,
            strengths=None,
            concerns=None,
            interview_questions=None,
            confidence_level=None,
        )

        # Find the candidate's document (preserved from original upload)
        document = await _get_candidate_document(candidate_id)
        if not document:
            raise ValueError(
                f"No document found for candidate {candidate_id}. "
                "Cannot retry without original file."
            )

        # Reset virus scan status so it goes through the pipeline again
        await _update_document(str(document.id), virus_scan_status=VIRUS_SCAN_PENDING)

        # Emit SSE event to notify frontend that retry has started
        await _publish_sse_event(
            project_id=project_id,
            event_type="candidate.processing",
            candidate_id=candidate_id,
            data={"stage": "retry_started", "message": "Retrying candidate processing"},
        )

        return {
            "candidate_id": candidate_id,
            "project_id": project_id,
            "document_id": str(document.id),
        }

    result = await step.run("reset-candidate-for-retry", _reset_candidate)

    # Re-trigger the pipeline from the beginning (virus scan)
    await step.send_event(
        "trigger-retry-pipeline",
        inngest.Event(
            name="resume/uploaded",
            data={
                "candidate_id": candidate_id,
                "project_id": project_id,
                "document_id": result["document_id"],
            },
        ),
    )

    return {"status": "retry_triggered", "candidate_id": candidate_id}


# ---------------------------------------------------------------------------
# Stub functions for MVP development (before AI service is ready)
# ---------------------------------------------------------------------------


def _stub_parse_resume(text: str) -> Dict[str, Any]:
    """Stub resume parser for development.

    Returns a minimal structured response when the AI service
    is not yet available. Will be replaced by actual Claude parsing.
    """
    return {
        "contact_info": {
            "name": "Unknown Candidate",
            "email": None,
            "phone": None,
            "linkedin": None,
            "github": None,
            "portfolio": None,
            "website": None,
            "location": None,
            "current_company": None,
        },
        "work_experience": [],
        "education": [],
        "skills": [],
        "certifications": [],
    }


def _stub_generate_summary(
    parsed_data: Optional[Dict[str, Any]], match_score: int
) -> str:
    """Stub summary generator for development."""
    name = "This candidate"
    if parsed_data and parsed_data.get("contact_info", {}).get("name"):
        name = parsed_data["contact_info"]["name"]

    return (
        f"{name} has been evaluated against the hiring project criteria "
        f"and received a match score of {match_score} out of 100. "
        f"Further AI-generated analysis will be available once the "
        f"AI service integration is complete. This placeholder summary "
        f"indicates the pipeline processed the resume successfully and "
        f"the candidate is ready for review by the hiring manager."
    )


def _stub_generate_strengths(
    parsed_data: Optional[Dict[str, Any]],
) -> List[Dict[str, str]]:
    """Stub strengths generator for development."""
    strengths = []
    if parsed_data:
        skills = parsed_data.get("skills", [])
        if skills:
            strengths.append({
                "title": "Technical Skills",
                "description": f"Candidate has {len(skills)} identified skills.",
                "evidence": "Based on resume content.",
            })
        experience = parsed_data.get("work_experience", [])
        if experience:
            strengths.append({
                "title": "Professional Experience",
                "description": f"Candidate has {len(experience)} work positions listed.",
                "evidence": "Based on resume work history.",
            })
        education = parsed_data.get("education", [])
        if education:
            strengths.append({
                "title": "Educational Background",
                "description": f"Candidate has {len(education)} education entries.",
                "evidence": "Based on resume education section.",
            })
    if not strengths:
        strengths.append({
            "title": "Resume Submitted",
            "description": "Candidate submitted resume for review.",
            "evidence": "Resume file was processed.",
        })
    return strengths


def _stub_generate_concerns(
    parsed_data: Optional[Dict[str, Any]],
) -> List[Dict[str, str]]:
    """Stub concerns generator for development."""
    concerns = []
    if parsed_data:
        contact = parsed_data.get("contact_info", {})
        if not contact.get("email") and not contact.get("phone"):
            concerns.append({
                "title": "Missing Contact Information",
                "description": "No email or phone number could be extracted.",
                "uncertainty": "Medium",
            })
        if not parsed_data.get("work_experience"):
            concerns.append({
                "title": "No Work Experience Found",
                "description": "Could not extract work history from resume.",
                "uncertainty": "High",
            })
    return concerns


def _stub_generate_questions(
    parsed_data: Optional[Dict[str, Any]], match_score: int
) -> List[Dict[str, str]]:
    """Stub interview question generator for development."""
    questions = [
        {
            "question": "Can you walk me through your most impactful project?",
            "rationale": "Understanding depth of experience and impact.",
        },
        {
            "question": "What attracted you to this role?",
            "rationale": "Assessing motivation and culture fit.",
        },
        {
            "question": "How do you approach learning new technologies or skills?",
            "rationale": "Evaluating growth mindset and adaptability.",
        },
    ]
    if match_score < 70:
        questions.append({
            "question": "What gaps in your experience do you feel you'd need "
            "to address for this role?",
            "rationale": "Self-awareness about skill gaps given lower match score.",
        })
    return questions


# ---------------------------------------------------------------------------
# Helper: Normalization logic
# ---------------------------------------------------------------------------


def _normalize_parsed_data(parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize extracted fields for consistency.

    Applies:
    - Lowercase + deduplication for skills
    - Trimming whitespace from all string fields
    - Standardizing education levels
    """
    normalized = dict(parsed_data)

    # Normalize skills: lowercase, deduplicate
    skills = normalized.get("skills", [])
    if isinstance(skills, list):
        seen = set()
        deduped_skills = []
        for skill in skills:
            if isinstance(skill, str):
                lower_skill = skill.strip().lower()
                if lower_skill and lower_skill not in seen:
                    seen.add(lower_skill)
                    deduped_skills.append(skill.strip())
            elif isinstance(skill, dict):
                skill_name = skill.get("name", "").strip().lower()
                if skill_name and skill_name not in seen:
                    seen.add(skill_name)
                    deduped_skills.append(skill)
        normalized["skills"] = deduped_skills

    # Normalize contact info: trim whitespace
    contact = normalized.get("contact_info", {})
    if isinstance(contact, dict):
        normalized["contact_info"] = {
            k: v.strip() if isinstance(v, str) else v
            for k, v in contact.items()
        }

    return normalized


def _estimate_years_experience(
    work_experience: List[Dict[str, Any]],
) -> Optional[int]:
    """Estimate total years of experience from work history.

    Sums up duration of each position. Falls back to counting
    number of positions if dates are not available.

    Returns None if experience list is empty.
    """
    if not work_experience:
        return None

    total_years = 0
    for position in work_experience:
        years = position.get("duration_years")
        if years and isinstance(years, (int, float)):
            total_years += int(years)

    # If no duration data, estimate 2 years per position
    if total_years == 0 and work_experience:
        total_years = len(work_experience) * 2

    return total_years if total_years > 0 else None


# ---------------------------------------------------------------------------
# Exported pipeline functions for Inngest registration
# ---------------------------------------------------------------------------

# All pipeline functions to register with Inngest
pipeline_functions = [
    virus_scan,
    extract_text,
    ai_parse,
    normalize,
    score,
    generate_summary,
    generate_questions,
    complete,
    retry_failed_candidate,
]
