"use client";

/**
 * @deprecated Use AuthProvider instead. This file is kept for backwards compatibility.
 * The AuthProvider in auth-provider.tsx now handles token injection and error handling.
 */

import { AuthProvider } from "@/components/shared/auth-provider";

export function ApiClientProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
