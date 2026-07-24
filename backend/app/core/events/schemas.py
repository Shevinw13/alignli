"""Event data models for SSE real-time updates.

Defines the event types emitted during the resume ingestion pipeline
and the data format for each event.

Requirements: 8.1, 8.2
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class EventType(str, Enum):
    """SSE event types emitted during pipeline processing."""

    CANDIDATE_PROCESSING = "candidate.processing"
    CANDIDATE_SCORED = "candidate.scored"
    CANDIDATE_COMPLETE = "candidate.complete"
    CANDIDATE_FAILED = "candidate.failed"
    PROJECT_READY = "project.ready"


class ProgressInfo(BaseModel):
    """Progress information for batch processing."""

    completed: int
    total: int


class EventData(BaseModel):
    """Data payload for SSE events.

    Format:
    {
        "candidate_id": "uuid",
        "stage": "extracting|scoring|summarizing|complete",
        "progress": {"completed": 5, "total": 10}
    }
    """

    candidate_id: Optional[str] = None
    stage: Optional[str] = None
    progress: Optional[ProgressInfo] = None
    message: Optional[str] = None
