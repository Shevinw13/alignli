"use client";

import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { EmptyState as EmptyStateUI } from "@/components/ui/empty-state";

/**
 * Empty state for the projects list (home page).
 * Uses the shared EmptyState component with project-specific messaging.
 */
export function EmptyState() {
  const router = useRouter();

  return (
    <div className="rounded-[16px] border border-border bg-white">
      <EmptyStateUI
        icon={FolderKanban}
        title="No hiring projects yet"
        description="Create your first Hiring Project to begin reviewing candidates."
        actionLabel="Create your first project"
        onAction={() => router.push("/projects/new")}
      />
    </div>
  );
}
