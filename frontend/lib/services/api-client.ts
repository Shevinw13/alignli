"use client";

import { ApiError, ApiErrorCode } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body — automatically serialized */
  body?: unknown;
  /** Skip automatic error handling (caller manages response) */
  raw?: boolean;
  /** Number of retries for network/5xx errors (default 2) */
  retries?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

// ---------------------------------------------------------------------------
// Token provider (set by ApiClientProvider)
// ---------------------------------------------------------------------------

let getToken: (() => Promise<string | null>) | null = null;

/**
 * Called once by the AuthProvider to inject the token getter function.
 */
export function setTokenProvider(provider: () => Promise<string | null>) {
  getToken = provider;
}

// ---------------------------------------------------------------------------
// Error handler callback (set by ApiClientProvider)
// ---------------------------------------------------------------------------

type ErrorHandler = (error: ApiError) => void;
let onApiError: ErrorHandler | null = null;

export function setErrorHandler(handler: ErrorHandler) {
  onApiError = handler;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s...
  return Math.min(1000 * Math.pow(2, attempt), 8000);
}

/**
 * Low-level typed fetch wrapper.
 * Handles JWT injection, JSON serialization, and error classification.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, raw, retries = 2, ...init } = options;

  const headers = new Headers(init.headers);

  // Inject JWT token
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // JSON content type for bodies
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, requestInit);

      // Success
      if (response.ok) {
        // Handle 204 No Content
        if (response.status === 204) {
          return { data: undefined as T, status: 204 };
        }
        const data = (await response.json()) as T;
        return { data, status: response.status };
      }

      // Parse error response
      const apiError = await parseErrorResponse(response);

      // Non-retryable errors — throw immediately
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status === 409 ||
        response.status === 422 ||
        response.status === 429
      ) {
        if (!raw && onApiError) {
          onApiError(apiError);
        }
        throw apiError;
      }

      // 5xx — retryable
      if (response.status >= 500) {
        lastError = apiError;
        if (attempt < retries) {
          await sleep(getRetryDelay(attempt));
          continue;
        }
        if (!raw && onApiError) {
          onApiError(apiError);
        }
        throw apiError;
      }

      // Other 4xx — not retryable
      if (!raw && onApiError) {
        onApiError(apiError);
      }
      throw apiError;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network error — retryable
      const networkError = new ApiError({
        code: "NETWORK_ERROR" as ApiErrorCode,
        message: "Unable to reach the server. Check your connection.",
        status: 0,
      });

      lastError = networkError;
      if (attempt < retries) {
        await sleep(getRetryDelay(attempt));
        continue;
      }

      if (!raw && onApiError) {
        onApiError(networkError);
      }
      throw networkError;
    }
  }

  // Should not reach here, but just in case
  throw lastError ?? new ApiError({ code: "INTERNAL_ERROR", message: "Unknown error", status: 500 });
}

// ---------------------------------------------------------------------------
// Error response parser
// ---------------------------------------------------------------------------

async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const errorData = body.error ?? body;
    return new ApiError({
      code: errorData.code ?? mapStatusToCode(response.status),
      message: errorData.message ?? response.statusText,
      status: response.status,
      details: errorData.details,
      retryAfter: parseRetryAfter(response),
    });
  } catch {
    return new ApiError({
      code: mapStatusToCode(response.status),
      message: response.statusText || "An error occurred",
      status: response.status,
      retryAfter: parseRetryAfter(response),
    });
  }
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  return isNaN(seconds) ? undefined : seconds;
}

function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}

// ---------------------------------------------------------------------------
// Typed convenience methods
// ---------------------------------------------------------------------------

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return apiFetch<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return apiFetch<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return apiFetch<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return apiFetch<T>(path, { ...options, method: "PATCH", body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return apiFetch<T>(path, { ...options, method: "DELETE" });
  },
};
