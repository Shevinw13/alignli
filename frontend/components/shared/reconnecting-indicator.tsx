"use client";

import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";
import { SSEConnectionState } from "@/lib/types/api";

interface ReconnectingIndicatorProps {
  /** Current SSE connection state */
  connectionState: SSEConnectionState;
  /** Additional class names */
  className?: string;
}

/**
 * A visual indicator shown when the SSE connection is reconnecting or disconnected.
 * Designed as a banner that appears at the top of a content area.
 */
export function ReconnectingIndicator({
  connectionState,
  className,
}: ReconnectingIndicatorProps) {
  if (connectionState === "connected" || connectionState === "connecting") {
    return null;
  }

  const isReconnecting = connectionState === "reconnecting";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
        isReconnecting
          ? "border border-amber-200 bg-amber-50 text-amber-800"
          : "border border-red-200 bg-red-50 text-red-800",
        className
      )}
    >
      {isReconnecting ? (
        <>
          <Wifi className="h-4 w-4 animate-pulse" aria-hidden="true" />
          <span>Reconnecting to live updates...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Live updates disconnected</span>
        </>
      )}
    </div>
  );
}
