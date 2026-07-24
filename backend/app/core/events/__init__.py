"""Events: SSE for real-time updates.

Provides an in-memory event bus and SSE endpoint for streaming
pipeline progress to connected clients.
"""

from app.core.events.event_bus import EventBus, get_event_bus
from app.core.events.router import router as events_router
from app.core.events.schemas import EventData, EventType, ProgressInfo

__all__ = [
    "EventBus",
    "EventData",
    "EventType",
    "ProgressInfo",
    "events_router",
    "get_event_bus",
]
