"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrgSetupPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { createOrganization, isLoaded: isOrgListLoaded } = useOrganizationList();
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isUserLoaded || !isOrgListLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-secondary-bg">
        <div className="text-text-secondary">Loading...</div>
      </main>
    );
  }

  // If user already has an organization, redirect to home
  if (user?.organizationMemberships && user.organizationMemberships.length > 0) {
    router.replace("/");
    return null;
  }

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createOrganization!({ name: orgName.trim() });
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create organization. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-h1 font-bold text-navy">
            Set up your organization
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            Create an organization to start managing your hiring projects
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-white p-8 shadow-md">
          <form onSubmit={handleCreateOrganization} className="space-y-6">
            <div>
              <label
                htmlFor="org-name"
                className="block text-sm font-medium text-navy"
              >
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g., Acme Corp"
                className="mt-2 w-full rounded-md border border-border-default px-4 py-2.5 text-body text-navy placeholder:text-text-secondary focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                autoFocus
                disabled={isCreating}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isCreating || !orgName.trim()}
              className="w-full rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Organization"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
