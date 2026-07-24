import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SSEClient } from "./sse-client";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0; // CONNECTING
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: string, lastEventId?: string) {
    const event = new MessageEvent("message", {
      data,
      lastEventId: lastEventId ?? "",
    });
    this.onmessage?.(event);
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

// Install mock
const OriginalEventSource = global.EventSource;

describe("SSEClient", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    // @ts-expect-error - mock EventSource
    global.EventSource = MockEventSource;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.EventSource = OriginalEventSource;
  });

  it("connects and emits connected state", async () => {
    const onStateChange = vi.fn();
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
      onStateChange,
    });

    await client.connect();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/v1/projects/1/events");
    expect(MockEventSource.instances[0].url).toContain("token=test-token");
    expect(onStateChange).toHaveBeenCalledWith("connecting");

    // Simulate connection open
    MockEventSource.instances[0].simulateOpen();
    expect(onStateChange).toHaveBeenCalledWith("connected");
    expect(client.connectionState).toBe("connected");

    client.disconnect();
  });

  it("parses and delivers events", async () => {
    const onEvent = vi.fn();
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
      onEvent,
    });

    await client.connect();
    MockEventSource.instances[0].simulateOpen();
    MockEventSource.instances[0].simulateMessage(
      JSON.stringify({ type: "candidate.scored", data: { candidateId: "123", score: 85 } }),
      "evt-001"
    );

    expect(onEvent).toHaveBeenCalledWith({
      type: "candidate.scored",
      data: { candidateId: "123", score: 85 },
      id: "evt-001",
    });

    client.disconnect();
  });

  it("auto-reconnects on error with exponential backoff", async () => {
    const onStateChange = vi.fn();
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
      onStateChange,
      maxReconnectAttempts: 3,
    });

    await client.connect();
    MockEventSource.instances[0].simulateOpen();
    onStateChange.mockClear();

    // Simulate disconnection
    MockEventSource.instances[0].simulateError();

    expect(onStateChange).toHaveBeenCalledWith("reconnecting");
    expect(client.connectionState).toBe("reconnecting");

    // Advance timer to trigger reconnect (initial delay ~1000ms with jitter)
    await vi.advanceTimersByTimeAsync(1500);

    // A new EventSource should have been created
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);

    client.disconnect();
  });

  it("stops reconnecting after max attempts", async () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
      onStateChange,
      onError,
      maxReconnectAttempts: 2,
    });

    await client.connect();
    MockEventSource.instances[0].simulateOpen();

    // First error → reconnect attempt 1
    MockEventSource.instances[0].simulateError();
    await vi.advanceTimersByTimeAsync(1500);

    // Second error → reconnect attempt 2
    const latestInstance = MockEventSource.instances[MockEventSource.instances.length - 1];
    latestInstance.simulateError();
    await vi.advanceTimersByTimeAsync(3000);

    // Third error → should give up
    const lastInstance = MockEventSource.instances[MockEventSource.instances.length - 1];
    lastInstance.simulateError();

    expect(onStateChange).toHaveBeenCalledWith("disconnected");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Max reconnection attempts reached" })
    );

    client.disconnect();
  });

  it("disconnect prevents further reconnection", async () => {
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
    });

    await client.connect();
    MockEventSource.instances[0].simulateOpen();

    client.disconnect();

    expect(client.connectionState).toBe("disconnected");
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it("includes lastEventId on reconnection", async () => {
    const client = new SSEClient("/api/v1/projects/1/events", {
      getToken: async () => "test-token",
      maxReconnectAttempts: 2,
    });

    await client.connect();
    MockEventSource.instances[0].simulateOpen();

    // Receive a message with an ID
    MockEventSource.instances[0].simulateMessage(
      JSON.stringify({ type: "candidate.complete", data: {} }),
      "evt-042"
    );

    // Simulate disconnect
    MockEventSource.instances[0].simulateError();
    await vi.advanceTimersByTimeAsync(1500);

    // New connection should include lastEventId
    const lastUrl = MockEventSource.instances[MockEventSource.instances.length - 1].url;
    expect(lastUrl).toContain("lastEventId=evt-042");

    client.disconnect();
  });
});
