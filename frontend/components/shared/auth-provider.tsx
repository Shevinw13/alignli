"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { setTokenProvider, setErrorHandler } from "@/lib/services/api-client";
import { ApiError } from "@/lib/types/api";
import { Toast } from "@/components/shared/toast";

const TOKEN_KEY = "narrowli_token";

interface AuthContextValue {
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    variant: "success" | "error";
    duration?: number;
  }>({ open: false, message: "", variant: "error" });

  const showToast = useCallback((message: string, duration?: number) => {
    setToast({ open: true, message, variant: "error", duration });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    router.push("/login");
  }, [router]);

  // Check for token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, [router]);

  // Wire up the token provider for the API client
  useEffect(() => {
    setTokenProvider(async () => {
      return localStorage.getItem(TOKEN_KEY);
    });
  }, []);

  // Set up global error handler
  useEffect(() => {
    setErrorHandler((error: ApiError) => {
      switch (error.code) {
        case "UNAUTHORIZED":
          logout();
          break;

        case "FORBIDDEN":
          showToast("You don't have permission to perform this action.");
          break;

        case "NOT_FOUND":
          router.push("/not-found");
          break;

        case "RATE_LIMITED":
          showToast(
            `Too many requests. Please wait before trying again.`,
            10000
          );
          break;

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
  }, [router, logout, showToast]);

  // Show nothing while checking auth state to prevent flash
  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
      <Toast
        open={toast.open}
        onClose={closeToast}
        message={toast.message}
        variant={toast.variant}
        duration={toast.duration}
      />
    </AuthContext.Provider>
  );
}
