"""Tests for the SSE event bus and endpoint.

Tests cover:
- EventBus publish/subscribe functionality
- Event formatting for SSE
- Keepalive behavior
- Subscriber cleanup

Requirements: 8.1, 8.2
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.core.events.event_bus import Event, EventBus, get_event_bus
from app.core.events.router import _format_sse_event, _format_sse_keepalive
from app.core.events.schemas import EventData, EventType, ProgressInfo


@pytest.fixture
def event_bus() -> EventBus:
    """Create a fresh EventBus instance for each test."""
    return EventBus()


class TestEventBus:
    """Tests for EventBus pub/sub functionality."""

    async def test_subscribe_receives_published_event(self, event_bus: EventBus) -> None:
        """Published events are received by subscribers."""
        project_id = "test-project-1"
        event_data = EventData(
            candidate_id="candidate-123",
            stage="extracting",
            progress=ProgressInfo(completed=3, total=10),
        )

        received_events: list[Event] = []

        async def consumer() -> None:
            async for event in event_bus.subscribe(project_id):
                received_events.append(event)
                break  # Exit after first event

        consumer_task = asyncio.create_task(consumer())

        # Give the subscriber time to register
        await asyncio.sleep(0.01)

        await event_bus.publish(project_id, EventType.CANDIDATE_PROCESSING, event_data)

        await asyncio.wait_for(consumer_task, timeout=1.0)

        assert len(received_events) == 1
        assert received_events[0].event_type == EventType.CANDIDATE_PROCESSING
        assert received_events[0].data.candidate_id == "candidate-123"
        assert received_events[0].data.stage == "extracting"
        assert received_events[0].data.progress is not None
        assert received_events[0].data.progress.completed == 3
        assert received_events[0].data.progress.total == 10

    async def test_multiple_subscribers_receive_events(self, event_bus: EventBus) -> None:
        """All subscribers for a project receive published events."""
        project_id = "test-project-2"
        event_data = EventData(candidate_id="c-1", stage="scoring")

        received_1: list[Event] = []
        received_2: list[Event] = []

        async def consumer_1() -> None:
            async for event in event_bus.subscribe(project_id):
                received_1.append(event)
                break

        async def consumer_2() -> None:
            async for event in event_bus.subscribe(project_id):
                received_2.append(event)
                break

        task_1 = asyncio.create_task(consumer_1())
        task_2 = asyncio.create_task(consumer_2())

        await asyncio.sleep(0.01)

        await event_bus.publish(project_id, EventType.CANDIDATE_SCORED, event_data)

        await asyncio.wait_for(asyncio.gather(task_1, task_2), timeout=1.0)

        assert len(received_1) == 1
        assert len(received_2) == 1
        assert received_1[0].event_type == EventType.CANDIDATE_SCORED
        assert received_2[0].event_type == EventType.CANDIDATE_SCORED

    async def test_events_scoped_to_project(self, event_bus: EventBus) -> None:
        """Events for one project are not received by subscribers of another."""
        project_a = "project-a"
        project_b = "project-b"

        received_a: list[Event] = []
        received_b: list[Event] = []

        async def consumer_a() -> None:
            async for event in event_bus.subscribe(project_a):
                received_a.append(event)
                break

        async def consumer_b() -> None:
            async for event in event_bus.subscribe(project_b):
                received_b.append(event)
                break

        task_a = asyncio.create_task(consumer_a())
        task_b = asyncio.create_task(consumer_b())

        await asyncio.sleep(0.01)

        # Publish only to project A
        await event_bus.publish(
            project_a, EventType.CANDIDATE_COMPLETE, EventData(candidate_id="c-1")
        )

        await asyncio.wait_for(task_a, timeout=1.0)

        # project_b subscriber should not have received anything
        assert len(received_a) == 1
        assert len(received_b) == 0

        # Cancel the waiting subscriber
        task_b.cancel()
        try:
            await task_b
        except asyncio.CancelledError:
            pass

    async def test_close_project_signals_subscribers(self, event_bus: EventBus) -> None:
        """close_project sends None to all subscribers, ending their loops."""
        project_id = "project-close"
        received: list[Event] = []

        async def consumer() -> None:
            async for event in event_bus.subscribe(project_id):
                received.append(event)

        task = asyncio.create_task(consumer())

        await asyncio.sleep(0.01)

        # Publish one event then close
        await event_bus.publish(
            project_id, EventType.PROJECT_READY, EventData(message="done")
        )
        await asyncio.sleep(0.01)
        await event_bus.close_project(project_id)

        await asyncio.wait_for(task, timeout=1.0)

        assert len(received) == 1
        assert received[0].event_type == EventType.PROJECT_READY

    async def test_subscriber_count(self, event_bus: EventBus) -> None:
        """subscriber_count reflects active subscriptions."""
        project_id = "project-count"

        assert event_bus.subscriber_count(project_id) == 0

        async def consumer() -> None:
            async for _ in event_bus.subscribe(project_id):
                break

        task = asyncio.create_task(consumer())
        await asyncio.sleep(0.01)

        assert event_bus.subscriber_count(project_id) == 1

        # End the subscriber by publishing an event
        await event_bus.publish(
            project_id, EventType.CANDIDATE_COMPLETE, EventData(candidate_id="x")
        )
        await asyncio.wait_for(task, timeout=1.0)
        await asyncio.sleep(0.01)

        assert event_bus.subscriber_count(project_id) == 0

    async def test_publish_to_project_with_no_subscribers(self, event_bus: EventBus) -> None:
        """Publishing to a project with no subscribers does not raise."""
        # Should not raise
        await event_bus.publish(
            "no-subscribers",
            EventType.CANDIDATE_FAILED,
            EventData(candidate_id="c-1", message="error"),
        )

    async def test_get_event_bus_returns_singleton(self) -> None:
        """get_event_bus returns the same instance on subsequent calls."""
        bus_1 = get_event_bus()
        bus_2 = get_event_bus()
        assert bus_1 is bus_2


class TestSSEFormatting:
    """Tests for SSE message formatting."""

    def test_format_sse_event_candidate_processing(self) -> None:
        """candidate.processing event is formatted correctly as SSE."""
        event = Event(
            event_type=EventType.CANDIDATE_PROCESSING,
            data=EventData(
                candidate_id="abc-123",
                stage="extracting",
                progress=ProgressInfo(completed=2, total=5),
            ),
        )
        result = _format_sse_event(event)

        assert result.startswith("event: candidate.processing\n")
        assert "data: " in result
        assert result.endswith("\n\n")

        # Parse the data line
        data_line = result.split("data: ")[1].rstrip("\n")
        data = json.loads(data_line)
        assert data["candidate_id"] == "abc-123"
        assert data["stage"] == "extracting"
        assert data["progress"]["completed"] == 2
        assert data["progress"]["total"] == 5

    def test_format_sse_event_project_ready(self) -> None:
        """project.ready event is formatted correctly."""
        event = Event(
            event_type=EventType.PROJECT_READY,
            data=EventData(
                progress=ProgressInfo(completed=10, total=10),
                message="All candidates processed",
            ),
        )
        result = _format_sse_event(event)

        assert "event: project.ready\n" in result
        data_line = result.split("data: ")[1].rstrip("\n")
        data = json.loads(data_line)
        assert data["progress"]["completed"] == 10
        assert data["progress"]["total"] == 10
        assert data["message"] == "All candidates processed"

    def test_format_sse_event_excludes_none_fields(self) -> None:
        """None fields are excluded from the JSON payload."""
        event = Event(
            event_type=EventType.CANDIDATE_FAILED,
            data=EventData(candidate_id="fail-1"),
        )
        result = _format_sse_event(event)

        data_line = result.split("data: ")[1].rstrip("\n")
        data = json.loads(data_line)
        assert "candidate_id" in data
        assert "stage" not in data
        assert "progress" not in data
        assert "message" not in data

    def test_format_sse_keepalive(self) -> None:
        """Keepalive is formatted as an SSE comment."""
        result = _format_sse_keepalive()
        assert result == ":keepalive\n\n"

    def test_all_event_types_format_correctly(self) -> None:
        """All event types can be formatted without error."""
        for event_type in EventType:
            event = Event(
                event_type=event_type,
                data=EventData(candidate_id="test"),
            )
            result = _format_sse_event(event)
            assert f"event: {event_type.value}\n" in result
            assert "data: " in result
            assert result.endswith("\n\n")
