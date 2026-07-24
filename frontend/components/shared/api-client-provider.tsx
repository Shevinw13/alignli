"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { setTokenProvider, setErrorHandler } from "@/lib/services/api-client";
import { ApiError } from "@/lib/types/api";
import { Toast } from "@/components/shared/toast";

/**
 * Provider that initializes the API client with Clerk JWT injection
 * and global error handling (toasts, redirects, etc).
 *
 * Place this inside ClerkProvider and your layout:
 * ```tsx
 * <ClerkProvider>
 *   <ApiClientProvider>
 *     {children}
 *   </ApiClientProvider>
 * </ClerkProvider>
 * ```
 */
export function ApiClientProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    variant: "success" | "error";
    duration?: number;
  }>({ open: false, message: "", variant: "error" });

  // Track retry-after countdowns
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback(
    (message: string, duration?: number) => {
      setToast({ open: true, message, variant: "error", duration });
    },
    []
  );

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // Inject Clerk token provider
  useEffect(() => {
    setTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  // Set up global error handler
  useEffect(() => {
    setErrorHandler((error: ApiError) => {
      switch (error.code) {
        case "UNAUTHORIZED":
          // Redirect to sign-in
          router.push("/sign-in");
          break;

        case "FORBIDDEN":
          showToast("You don't have permission to perform this action.");
          break;

        case "NOT_FOUND":
          router.push("/not-found");
          break;

        case "RATE_LIMITED": {
          const retryAfter = error.retryAfter ?? 60;
          let remaining = retryAfter;

          // Clear any existing countdown
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }

          showToast(
            `Too many requests. Please wait ${remaining}s before trying again.`,
            (retryAfter + 1) * 1000
          );

          countdownRef.current = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              closeToast();
            } else {
              showToast(
                `Too many requests. Please wait ${remaining}s before trying again.`,
                (remaining + 1) * 1000
              );
            }
          }, 1000);
          break;
        }

        case "NETWORK_ERROR":
          showToast("Connection error. Retrying...");
          break;

        case "INTERNAL_ERROR":
          showToast("Something went wrong. Please try again.");
          break;

        default:
          if (error.message) {
            showToast(error.message);
          }
          break;
      }
    });

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [router, showToast, closeToast]);

  return (
    <>
      {children}
      <Toast
        open={toast.open}
        onClose={closeToast}
        message={toast.message}
        variant={toast.variant}
        duration={toast.duration}
      />
    </>
  );
}
