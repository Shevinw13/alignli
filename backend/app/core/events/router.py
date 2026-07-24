"""SSE endpoint for real-time pipeline progress.

Provides `/api/v1/projects/{id}/events` SSE endpoint that streams
real-time updates during resume ingestion pipeline processing.

Features:
- Emits typed events: candidate.processing, candidate.scored, etc.
- Periodic keepalive comments every 15 seconds to prevent connection timeout
- Auth required (validates user has access to the project)
- Supports client auto-reconnect with fallback to polling every 5 seconds

Requirements: 8.1, 8.2
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.events.event_bus import Event, get_event_bus
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.hiring_projects.service import HiringProjectService

router = APIRouter(prefix="/projects", tags=["Events"])

# Keepalive interval in seconds
_KEEPALIVE_INTERVAL = 15


def _get_service(session: AsyncSession = Depends(get_db)) -> HiringProjectService:
    """Dependency to create HiringProjectService with the current session."""
    return HiringProjectService(session)


def _format_sse_event(event: Event) -> str:
    """Format an event as an SSE message.

    SSE format:
        event: candidate.complete
        data: {"candidate_id": "uuid", "stage": "complete"}

    """
    data_dict = event.data.model_dump(exclude_none=True)
    data_json = json.dumps(data_dict)
    return f"event: {event.event_type.value}\ndata: {data_json}\n\n"


def _format_sse_keepalive() -> str:
    """Format an SSE keepalive comment.

    SSE comments start with ':' and are ignored by clients but keep
    the connection alive.
    """
    return ":keepalive\n\n"


async def _event_stream(
    project_id: str, request: Request
) -> AsyncGenerator[str, None]:
    """Generate SSE event stream for a project.

    Yields formatted SSE messages as events are published to the project.
    Sends keepalive comments every 15 seconds to prevent timeout.
    Terminates when the client disconnects.

    Args:
        project_id: The project to stream events for.
        request: The incoming HTTP request (used to detect disconnection).

    Yields:
        Formatted SSE strings (events and keepalives).
    """
    event_bus = get_event_bus()

    # Create an async generator from the event bus subscription
    subscription = event_bus.subscribe(project_id)

    try:
        async for event in _with_keepalive(subscription, request):
            yield event
    finally:
        # Ensure the subscription generator is properly closed
        await subscription.aclose()


async def _with_keepalive(
    subscription: AsyncGenerator[Event, None],
    request: Request,
) -> AsyncGenerator[str, None]:
    """Wrap an event subscription with keepalive messages and disconnect detection.

    Yields formatted SSE strings — either event data or keepalive comments.
    Checks for client disconnect and stops streaming when detected.

    Args:
        subscription: The event bus subscription to wrap.
        request: The HTTP request for disconnect detection.

    Yields:
        Formatted SSE strings.
    """
    # Use an asyncio task to pull events from the subscription
    event_queue: asyncio.Queue[Event | None] = asyncio.Queue()

    async def _reader() -> None:
        """Read events from subscription and forward to queue."""
        try:
            async for event in subscription:
                await event_queue.put(event)
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            await event_queue.put(None)  # Signal end

    reader_task = asyncio.create_task(_reader())

    try:
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            try:
                # Wait for an event with timeout for keepalive
                event = await asyncio.wait_for(
                    event_queue.get(), timeout=_KEEPALIVE_INTERVAL
                )

                if event is None:
                    # Subscription ended (project closed or bus shut down)
                    break

                yield _format_sse_event(event)

            except asyncio.TimeoutError:
                # No event received within keepalive interval — send keepalive
                if await request.is_disconnected():
                    break
                yield _format_sse_keepalive()

    finally:
        reader_task.cancel()
        try:
            await reader_task
        except asyncio.CancelledError:
            pass


@router.get("/{project_id}/events")
async def project_events(
    project_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: HiringProjectService = Depends(_get_service),
    request: Request = ...,  # type: ignore[assignment]
) -> StreamingResponse:
    """SSE endpoint for real-time pipeline progress updates.

    Streams events as the resume ingestion pipeline processes candidates
    for the given project. Requires authentication and verifies the user
    has access to the project (org-scoped).

    Event types:
    - candidate.processing: A candidate has started processing
    - candidate.scored: Scoring complete for a candidate
    - candidate.complete: All pipeline stages complete for a candidate
    - candidate.failed: Processing failed for a candidate
    - project.ready: All candidates processed, project ready

    The stream sends keepalive comments every 15 seconds to prevent
    connection timeouts. Clients should implement auto-reconnect
    with fallback to polling every 5 seconds on connection loss.

    Args:
        project_id: The hiring project UUID.
        user: The authenticated user (validates access).
        service: Hiring project service (verifies project exists and user has access).
        request: The HTTP request object.

    Returns:
        StreamingResponse with text/event-stream content type.
    """
    # Verify the project exists and user has access (org-scoped query)
    # This will raise 404 if project doesn't exist or belongs to different org
    await service.get_project(project_id)

    return StreamingResponse(
        _event_stream(str(project_id), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
