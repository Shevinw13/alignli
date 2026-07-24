// ---------------------------------------------------------------------------
// API Error Types
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  status: number;
  details?: ApiErrorDetail[];
  retryAfter?: number;
}

/**
 * Structured API error that can be caught and handled by the error handler.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[];
  /** Seconds to wait before retrying (from 429 responses) */
  readonly retryAfter?: number;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
  }

  /** Check if this is a network connectivity error */
  get isNetworkError(): boolean {
    return this.code === "NETWORK_ERROR";
  }

  /** Check if this is a rate limit error */
  get isRateLimited(): boolean {
    return this.code === "RATE_LIMITED";
  }

  /** Check if this is an auth error requiring sign-in */
  get isUnauthorized(): boolean {
    return this.code === "UNAUTHORIZED";
  }

  /** Check if this is a server error (retryable) */
  get isServerError(): boolean {
    return this.code === "INTERNAL_ERROR";
  }
}

// ---------------------------------------------------------------------------
// SSE Event Types
// ---------------------------------------------------------------------------

export type SSEEventType =
  | "candidate.processing"
  | "candidate.scored"
  | "candidate.complete"
  | "candidate.failed"
  | "project.ready";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  id?: string;
  retry?: number;
}

export type SSEConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
