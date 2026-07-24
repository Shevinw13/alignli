"use client";

import { SSEConnectionState, SSEEvent, SSEEventType } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Initial reconnect delay in ms */
const INITIAL_RECONNECT_DELAY = 1000;
/** Maximum reconnect delay in ms */
const MAX_RECONNECT_DELAY = 30000;
/** Backoff multiplier */
const BACKOFF_MULTIPLIER = 2;
/** Jitter factor (0–1) to avoid thundering herd */
const JITTER_FACTOR = 0.3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SSEEventHandler<T = unknown> = (event: SSEEvent<T>) => void;
export type SSEStateHandler = (state: SSEConnectionState) => void;
export type SSEErrorHandler = (error: Error) => void;

export interface SSEClientOptions {
  /** Token provider function (from Clerk) */
  getToken: () => Promise<string | null>;
  /** Called on each received event */
  onEvent?: SSEEventHandler;
  /** Called when connection state changes */
  onStateChange?: SSEStateHandler;
  /** Called on errors */
  onError?: SSEErrorHandler;
  /** Maximum number of reconnect attempts before giving up (default: Infinity) */
  maxReconnectAttempts?: number;
}

// ---------------------------------------------------------------------------
// SSE Client Class
// ---------------------------------------------------------------------------

/**
 * SSE client with auto-reconnect and exponential backoff.
 *
 * Usage:
 * ```ts
 * const client = new SSEClient("/api/v1/projects/123/events", {
 *   getToken: () => clerk.session?.getToken() ?? null,
 *   onEvent: (event) => console.log(event),
 *   onStateChange: (state) => setConnectionState(state),
 * });
 *
 * client.connect();
 * // Later:
 * client.disconnect();
 * ```
 */
export class SSEClient {
  private path: string;
  private options: SSEClientOptions;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastEventId: string | null = null;
  private state: SSEConnectionState = "disconnected";
  private aborted = false;

  constructor(path: string, options: SSEClientOptions) {
    this.path = path;
    this.options = options;
  }

  /** Current connection state */
  get connectionState(): SSEConnectionState {
    return this.state;
  }

  /** Connect to the SSE endpoint */
  async connect(): Promise<void> {
    this.aborted = false;
    this.reconnectAttempts = 0;
    await this.establishConnection();
  }

  /** Disconnect and stop reconnecting */
  disconnect(): void {
    this.aborted = true;
    this.cleanup();
    this.setState("disconnected");
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private async establishConnection(): Promise<void> {
    if (this.aborted) return;

    this.setState(
      this.reconnectAttempts === 0 ? "connecting" : "reconnecting"
    );

    try {
      // Get fresh token
      const token = await this.options.getToken();

      // Build URL with auth token and last event ID
      const url = new URL(`${API_BASE_URL}${this.path}`);
      if (token) {
        url.searchParams.set("token", token);
      }
      if (this.lastEventId) {
        url.searchParams.set("lastEventId", this.lastEventId);
      }

      // Close existing connection if any
      this.closeEventSource();

      // Create new EventSource
      const eventSource = new EventSource(url.toString());
      this.eventSource = eventSource;

      eventSource.onopen = () => {
        if (this.aborted) {
          this.closeEventSource();
          return;
        }
        this.reconnectAttempts = 0;
        this.setState("connected");
      };

      eventSource.onmessage = (messageEvent) => {
        if (this.aborted) return;
        this.handleMessage(messageEvent);
      };

      eventSource.onerror = () => {
        if (this.aborted) return;
        this.handleError();
      };
    } catch (error) {
      if (this.aborted) return;
      this.options.onError?.(
        error instanceof Error ? error : new Error("SSE connection failed")
      );
      this.scheduleReconnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      // Track last event ID for reconnection
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }

      const data = JSON.parse(event.data);
      const sseEvent: SSEEvent = {
        type: data.type as SSEEventType,
        data: data.data ?? data,
        id: event.lastEventId || undefined,
      };

      this.options.onEvent?.(sseEvent);
    } catch (error) {
      this.options.onError?.(
        error instanceof Error ? error : new Error("Failed to parse SSE event")
      );
    }
  }

  private handleError(): void {
    this.closeEventSource();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.aborted) return;

    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity;
    if (this.reconnectAttempts >= maxAttempts) {
      this.setState("disconnected");
      this.options.onError?.(new Error("Max reconnection attempts reached"));
      return;
    }

    this.setState("reconnecting");

    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.establishConnection();
    }, delay);
  }

  private getReconnectDelay(): number {
    const baseDelay =
      INITIAL_RECONNECT_DELAY *
      Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempts);
    const cappedDelay = Math.min(baseDelay, MAX_RECONNECT_DELAY);

    // Add jitter to avoid thundering herd
    const jitter = cappedDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitter);
  }

  private setState(newState: SSEConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState);
    }
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.onopen = null;
      this.eventSource.onmessage = null;
      this.eventSource.onerror = null;
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private cleanup(): void {
    this.closeEventSource();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
