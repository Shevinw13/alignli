"use client";

import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="rounded-[16px] border border-border bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <FolderKanban className="h-6 w-6 text-indigo-600" aria-hidden="true" />
      </div>

      <h2 className="mt-4 text-base font-semibold text-navy">
        No Hiring Projects Yet
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Create your first Hiring Project to begin reviewing candidates.
      </p>

      <div className="mt-6">
        <Button
          className={cn(
            "inline-flex items-center gap-1.5",
            "bg-indigo-600 text-white hover:bg-indigo-700",
            "rounded-[12px] px-4 py-2 text-sm font-medium"
          )}
          render={<Link href="/projects/new" />}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Project
        </Button>
      </div>
    </div>
  );
}
