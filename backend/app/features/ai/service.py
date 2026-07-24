"""AI service: Anthropic Claude client wrapper with structured JSON response contract.

All AI calls return a standardized response and are stored in the ai_responses table
for auditability. Includes retry logic, timeout handling, and bias guard enforcement.
"""

from __future__ import annotations

import json
import time
import uuid
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import anthropic
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.ai_responses import AIResponse

# Base path for prompt files
PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"


class ConfidenceLevel(str, Enum):
    """Confidence level for AI responses."""

    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class AIResponseMetadata(BaseModel):
    """Metadata for an AI response."""

    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    prompt_version: str = ""


class AIServiceResponse(BaseModel):
    """Standardized response from all AI calls."""

    content: Optional[dict[str, Any]] = None
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    metadata: AIResponseMetadata = Field(default_factory=AIResponseMetadata)
    error: Optional[str] = None


class PromptType(str, Enum):
    """Available prompt types mapped to file paths."""

    RESUME_TO_JSON = "extraction/resume_to_json"
    JOB_DESCRIPTION = "analysis/job_description"
    CANDIDATE_SUMMARY = "analysis/candidate_summary"
    CANDIDATE_COMPARISON = "analysis/candidate_comparison"
    INTERVIEW_QUESTIONS = "generation/interview_questions"
    AI_BRIEF = "generation/ai_brief"
    RANKING_CRITERIA = "generation/ranking_criteria"


# Maximum retries and backoff configuration
MAX_RETRIES = 2
BACKOFF_BASE_SECONDS = 2
BACKOFF_MULTIPLIER = 4  # 2s, 8s
TIMEOUT_SECONDS = 60


def load_prompt(prompt_type: PromptType) -> tuple[str, str]:
    """Load a prompt file and extract its version.

    Returns:
        Tuple of (prompt_text, version_string).
    """
    prompt_path = PROMPTS_DIR / f"{prompt_type.value}.txt"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    content = prompt_path.read_text(encoding="utf-8")

    # Extract version from the last line if present
    version = "unknown"
    lines = content.strip().split("\n")
    for line in reversed(lines):
        if line.strip().lower().startswith("version:"):
            version = line.strip().split(":", 1)[1].strip()
            break

    return content, version


def load_bias_guard() -> str:
    """Load the bias guard system prompt."""
    bias_guard_path = PROMPTS_DIR / "safety" / "bias_guard.txt"
    if not bias_guard_path.exists():
        raise FileNotFoundError(f"Bias guard prompt not found: {bias_guard_path}")
    return bias_guard_path.read_text(encoding="utf-8")


def _parse_json_response(text: str) -> Optional[dict[str, Any]]:
    """Parse JSON from AI response text, handling markdown code blocks."""
    text = text.strip()

    # Handle markdown code blocks
    if text.startswith("```"):
        # Remove first line (```json or ```) and last line (```)
        lines = text.split("\n")
        # Find the opening and closing backticks
        start_idx = 1  # Skip first line with ```
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


class AIService:
    """AI client wrapper for Anthropic Claude API.

    Provides structured JSON response contract, retry logic,
    bias guard enforcement, and auditability via ai_responses table.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key,
            timeout=TIMEOUT_SECONDS,
        )
        self._model = settings.anthropic_model
        self._bias_guard = load_bias_guard()

    async def call(
        self,
        prompt_type: PromptType,
        user_content: str,
        *,
        db: Optional[AsyncSession] = None,
        organization_id: Optional[uuid.UUID] = None,
        hiring_project_id: Optional[uuid.UUID] = None,
        candidate_id: Optional[uuid.UUID] = None,
        additional_system_context: Optional[str] = None,
    ) -> AIServiceResponse:
        """Make an AI call with the specified prompt type.

        Args:
            prompt_type: The type of prompt to use.
            user_content: The user message content to send.
            db: Optional database session for storing the response.
            organization_id: Organization context for auditability.
            hiring_project_id: Optional hiring project context.
            candidate_id: Optional candidate context.
            additional_system_context: Optional extra system instructions.

        Returns:
            Standardized AIServiceResponse with content, confidence, and metadata.
        """
        # Load prompt and version
        prompt_text, prompt_version = load_prompt(prompt_type)

        # Build system prompt with bias guard
        system_prompt = f"{self._bias_guard}\n\n---\n\n{prompt_text}"
        if additional_system_context:
            system_prompt = f"{system_prompt}\n\n---\n\nAdditional Context:\n{additional_system_context}"

        # Execute with retries
        response = await self._execute_with_retries(
            system_prompt=system_prompt,
            user_content=user_content,
            prompt_type=prompt_type,
            prompt_version=prompt_version,
        )

        # Store response in database if session provided
        if db and organization_id:
            await self._store_response(
                db=db,
                organization_id=organization_id,
                hiring_project_id=hiring_project_id,
                candidate_id=candidate_id,
                prompt_type=prompt_type.value,
                prompt_version=prompt_version,
                response=response,
            )

        return response

    async def _execute_with_retries(
        self,
        system_prompt: str,
        user_content: str,
        prompt_type: PromptType,
        prompt_version: str,
    ) -> AIServiceResponse:
        """Execute an AI call with retry logic (2 retries, exponential backoff: 2s, 8s)."""
        last_error: Optional[str] = None

        for attempt in range(MAX_RETRIES + 1):
            try:
                start_time = time.time()

                # Make synchronous call (anthropic SDK is sync by default)
                message = self._client.messages.create(
                    model=self._model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_content}
                    ],
                )

                latency_ms = int((time.time() - start_time) * 1000)

                # Extract text content
                raw_text = ""
                for block in message.content:
                    if block.type == "text":
                        raw_text += block.text

                # Parse JSON response
                parsed_content = _parse_json_response(raw_text)

                if parsed_content is None:
                    # If we can't parse JSON, return the raw text wrapped
                    parsed_content = {"raw_response": raw_text}
                    confidence = ConfidenceLevel.LOW
                else:
                    confidence = self._determine_confidence(parsed_content)

                return AIServiceResponse(
                    content=parsed_content,
                    confidence=confidence,
                    metadata=AIResponseMetadata(
                        input_tokens=message.usage.input_tokens,
                        output_tokens=message.usage.output_tokens,
                        latency_ms=latency_ms,
                        prompt_version=prompt_version,
                    ),
                    error=None,
                )

            except anthropic.APITimeoutError as e:
                last_error = f"Request timed out after {TIMEOUT_SECONDS}s: {str(e)}"
            except anthropic.RateLimitError as e:
                last_error = f"Rate limited by Anthropic API: {str(e)}"
            except anthropic.APIStatusError as e:
                last_error = f"API error (status {e.status_code}): {str(e)}"
            except anthropic.APIConnectionError as e:
                last_error = f"Connection error: {str(e)}"
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"

            # If not the last attempt, wait with exponential backoff
            if attempt < MAX_RETRIES:
                backoff = BACKOFF_BASE_SECONDS * (BACKOFF_MULTIPLIER**attempt)
                import asyncio

                await asyncio.sleep(backoff)

        # All retries exhausted
        return AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(
                input_tokens=0,
                output_tokens=0,
                latency_ms=0,
                prompt_version=prompt_version,
            ),
            error=last_error,
        )

    def _determine_confidence(self, content: dict[str, Any]) -> ConfidenceLevel:
        """Determine confidence level based on response completeness.

        If the AI response includes an explicit confidence field, use that.
        Otherwise, estimate based on the number of non-null fields.
        """
        # Check if the response explicitly specifies confidence
        if "confidence" in content:
            conf_value = str(content["confidence"]).capitalize()
            if conf_value in ("High", "Medium", "Low"):
                return ConfidenceLevel(conf_value)

        # Estimate from data completeness
        non_null_fields = sum(
            1 for v in content.values() if v is not None and v != [] and v != {}
        )
        total_fields = len(content)

        if total_fields == 0:
            return ConfidenceLevel.LOW

        ratio = non_null_fields / total_fields
        if ratio >= 0.9:
            return ConfidenceLevel.HIGH
        elif ratio >= 0.6:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW

    async def _store_response(
        self,
        db: AsyncSession,
        organization_id: uuid.UUID,
        hiring_project_id: Optional[uuid.UUID],
        candidate_id: Optional[uuid.UUID],
        prompt_type: str,
        prompt_version: str,
        response: AIServiceResponse,
    ) -> None:
        """Store an AI response in the ai_responses table for auditability."""
        ai_response = AIResponse(
            organization_id=organization_id,
            hiring_project_id=hiring_project_id,
            candidate_id=candidate_id,
            prompt_type=prompt_type,
            prompt_version=prompt_version,
            input_tokens=response.metadata.input_tokens,
            output_tokens=response.metadata.output_tokens,
            latency_ms=response.metadata.latency_ms,
            confidence=response.confidence.value if response.confidence else None,
            response_content=response.content or {},
            error=response.error,
        )
        db.add(ai_response)
        await db.flush()
