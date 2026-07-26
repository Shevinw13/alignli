"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "narrowli_token";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail ?? "Invalid username or password");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      router.push("/");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/narrowli.png"
            alt="Narrowli"
            width={48}
            height={48}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold text-navy">Welcome back</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to Narrowli
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border-default bg-white p-8 shadow-md space-y-5"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-navy"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              disabled={isLoading}
              className="mt-1.5 w-full rounded-md border border-border-default px-3 py-2 text-sm text-navy placeholder:text-text-secondary focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-navy"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLoading}
              className="mt-1.5 w-full rounded-md border border-border-default px-3 py-2 text-sm text-navy placeholder:text-text-secondary focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
