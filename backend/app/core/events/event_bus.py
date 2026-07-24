"""In-memory event bus for real-time SSE updates.

Provides a pub/sub mechanism where pipeline stages publish events
and SSE clients subscribe to receive them in real time.

Uses asyncio.Queue for each subscriber to ensure non-blocking delivery.

Requirements: 8.1, 8.2
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import AsyncGenerator

from app.core.events.schemas import EventData, EventType


@dataclass
class Event:
    """A single event published to the bus."""

    event_type: EventType
    data: EventData


class EventBus:
    """In-memory pub/sub event bus scoped by project ID.

    Pipeline stages call `publish(project_id, event_type, data)` to emit events.
    SSE clients call `subscribe(project_id)` to get an async generator of events.

    Each subscriber gets its own asyncio.Queue so events are delivered independently.
    Subscribers are cleaned up when they disconnect.
    """

    def __init__(self) -> None:
        # Map of project_id -> list of subscriber queues
        self._subscribers: dict[str, list[asyncio.Queue[Event | None]]] = {}
        self._lock = asyncio.Lock()

    async def publish(self, project_id: str, event_type: EventType, data: EventData) -> None:
        """Publish an event to all subscribers of a project.

        Args:
            project_id: The project to publish the event for.
            event_type: The type of event being emitted.
            data: The event payload data.
        """
        async with self._lock:
            subscribers = self._subscribers.get(project_id, [])
            for queue in subscribers:
                try:
                    queue.put_nowait(Event(event_type=event_type, data=data))
                except asyncio.QueueFull:
                    # Drop events if subscriber is too slow (bounded queue)
                    pass

    async def subscribe(self, project_id: str) -> AsyncGenerator[Event, None]:
        """Subscribe to events for a project.

        Yields events as they are published. The subscription is cleaned up
        when the generator is closed (client disconnects).

        Args:
            project_id: The project to subscribe to.

        Yields:
            Event objects as they are published.
        """
        queue: asyncio.Queue[Event | None] = asyncio.Queue(maxsize=100)

        async with self._lock:
            if project_id not in self._subscribers:
                self._subscribers[project_id] = []
            self._subscribers[project_id].append(queue)

        try:
            while True:
                event = await queue.get()
                if event is None:
                    # None signals the subscription should end
                    break
                yield event
        finally:
            async with self._lock:
                subscribers = self._subscribers.get(project_id, [])
                if queue in subscribers:
                    subscribers.remove(queue)
                # Clean up empty subscriber lists
                if project_id in self._subscribers and not self._subscribers[project_id]:
                    del self._subscribers[project_id]

    async def close_project(self, project_id: str) -> None:
        """Close all subscriptions for a project.

        Sends None to all subscriber queues to signal them to stop.
        Called when the project is fully processed or no longer needs updates.

        Args:
            project_id: The project to close subscriptions for.
        """
        async with self._lock:
            subscribers = self._subscribers.get(project_id, [])
            for queue in subscribers:
                try:
                    queue.put_nowait(None)
                except asyncio.QueueFull:
                    pass

    def subscriber_count(self, project_id: str) -> int:
        """Get the number of active subscribers for a project.

        Args:
            project_id: The project to check.

        Returns:
            Number of active subscribers.
        """
        return len(self._subscribers.get(project_id, []))


# Singleton event bus instance for the application
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get the global EventBus singleton.

    Returns:
        The application-wide EventBus instance.
    """
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus
