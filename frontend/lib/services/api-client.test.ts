import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, setTokenProvider, setErrorHandler, api } from "./api-client";
import { ApiError } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Setup: Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("api-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTokenProvider(async () => "test-jwt-token");
    setErrorHandler(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JWT injection", () => {
    it("includes Authorization header with Clerk token", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await apiFetch("/api/v1/projects");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, init] = mockFetch.mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
    });

    it("omits Authorization header when no token available", async () => {
      setTokenProvider(async () => null);
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await apiFetch("/api/v1/projects");

      const [, init] = mockFetch.mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBeNull();
    });

    it("sets Content-Type to application/json when body is provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "123" }));

      await apiFetch("/api/v1/projects", {
        method: "POST",
        body: { title: "Test" },
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("success responses", () => {
    it("returns parsed JSON data on 200", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ id: "1", title: "Project" })
      );

      const result = await apiFetch("/api/v1/projects/1");

      expect(result.data).toEqual({ id: "1", title: "Project" });
      expect(result.status).toBe(200);
    });

    it("handles 204 No Content", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 204, statusText: "No Content" })
      );

      const result = await apiFetch("/api/v1/projects/1", { method: "DELETE" });

      expect(result.data).toBeUndefined();
      expect(result.status).toBe(204);
    });
  });

  describe("error handling — 401 Unauthorized", () => {
    it("throws ApiError with UNAUTHORIZED code", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }, 401)
      );

      await expect(apiFetch("/api/v1/projects")).rejects.toThrow(ApiError);

      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.isUnauthorized).toBe(true);
    });
  });

  describe("error handling — 403 Forbidden", () => {
    it("throws ApiError with FORBIDDEN code", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: { code: "FORBIDDEN", message: "No permission" } }, 403)
      );

      await expect(apiFetch("/api/v1/projects")).rejects.toThrow(ApiError);

      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("FORBIDDEN");
    });
  });

  describe("error handling — 404 Not Found", () => {
    it("throws ApiError with NOT_FOUND code", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404)
      );

      await expect(apiFetch("/api/v1/projects/999")).rejects.toThrow(ApiError);

      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("error handling — 429 Rate Limited", () => {
    it("throws ApiError with retryAfter from header", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "RATE_LIMITED", message: "Too many requests" } },
          429,
          { "retry-after": "45" }
        )
      );

      await expect(apiFetch("/api/v1/projects")).rejects.toThrow(ApiError);

      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.isRateLimited).toBe(true);
      expect(error.retryAfter).toBe(45);
    });
  });

  describe("error handling — 5xx Server Error with retry", () => {
    it("retries on 500 and succeeds", async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Server error" } }, 500)
        )
        .mockResolvedValueOnce(jsonResponse({ id: "1" }));

      const result = await apiFetch("/api/v1/projects/1", { retries: 1 });

      expect(result.data).toEqual({ id: "1" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries on 500", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValue(
        jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Server error" } }, 500)
      );

      await expect(apiFetch("/api/v1/projects", { retries: 1 })).rejects.toThrow(
        ApiError
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.isServerError).toBe(true);
    });
  });

  describe("error handling — Network errors with retry", () => {
    it("retries on network failure and succeeds", async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(jsonResponse({ id: "1" }));

      const result = await apiFetch("/api/v1/projects/1", { retries: 1 });

      expect(result.data).toEqual({ id: "1" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws NETWORK_ERROR after exhausting retries", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(apiFetch("/api/v1/projects", { retries: 1 })).rejects.toThrow(
        ApiError
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const error = errorHandler.mock.calls[0][0] as ApiError;
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.isNetworkError).toBe(true);
    });
  });

  describe("raw mode", () => {
    it("does not call error handler when raw is true", async () => {
      const errorHandler = vi.fn();
      setErrorHandler(errorHandler);
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: { code: "FORBIDDEN", message: "No access" } }, 403)
      );

      await expect(
        apiFetch("/api/v1/projects", { raw: true })
      ).rejects.toThrow(ApiError);

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe("convenience methods", () => {
    it("api.get sends GET request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "1" }]));

      const result = await api.get<{ id: string }[]>("/api/v1/projects");

      expect(result.data).toEqual([{ id: "1" }]);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("GET");
    });

    it("api.post sends POST request with body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new" }, 201));

      await api.post("/api/v1/projects", { title: "New Project" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ title: "New Project" });
    });

    it("api.patch sends PATCH request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

      await api.patch("/api/v1/projects/1", { title: "Updated" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("PATCH");
    });

    it("api.delete sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 204, statusText: "No Content" })
      );

      const result = await api.delete("/api/v1/projects/1");

      expect(result.status).toBe(204);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("DELETE");
    });
  });
});
