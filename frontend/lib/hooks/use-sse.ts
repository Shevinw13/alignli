"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SSEClient, SSEEventHandler } from "@/lib/services/sse-client";
import { SSEConnectionState, SSEEvent } from "@/lib/types/api";

const TOKEN_KEY = "narrowli_token";

export interface UseSSEOptions {
  /** SSE endpoint path (e.g., "/api/v1/projects/123/events") */
  path: string;
  /** Called on each received event */
  onEvent?: SSEEventHandler;
  /** Whether to auto-connect on mount (default: true) */
  enabled?: boolean;
  /** Maximum reconnect attempts before giving up */
  maxReconnectAttempts?: number;
}

export interface UseSSEReturn {
  /** Current connection state */
  connectionState: SSEConnectionState;
  /** Whether the connection is being re-established */
  isReconnecting: boolean;
  /** Whether the connection is active */
  isConnected: boolean;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Last received event */
  lastEvent: SSEEvent | null;
}

/**
 * React hook for SSE connections with auto-reconnect.
 *
 * Usage:
 * ```tsx
 * const { connectionState, isReconnecting, lastEvent } = useSSE({
 *   path: `/api/v1/projects/${projectId}/events`,
 *   onEvent: (event) => handleEvent(event),
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const { path, onEvent, enabled = true, maxReconnectAttempts } = options;

  const [connectionState, setConnectionState] =
    useState<SSEConnectionState>("disconnected");
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const clientRef = useRef<SSEClient | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep callback ref current without re-creating client
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    const client = new SSEClient(path, {
      getToken: async () => {
        return localStorage.getItem(TOKEN_KEY);
      },
      onEvent: (event) => {
        setLastEvent(event);
        onEventRef.current?.(event);
      },
      onStateChange: setConnectionState,
      maxReconnectAttempts,
    });

    clientRef.current = client;
    client.connect();
  }, [path, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, path]);

  return {
    connectionState,
    isReconnecting: connectionState === "reconnecting",
    isConnected: connectionState === "connected",
    lastEvent,
    connect,
    disconnect,
  };
}
