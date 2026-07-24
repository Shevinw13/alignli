import { cn } from "@/lib/utils";

export type ProjectState =
  | "Draft"
  | "Active"
  | "Reviewing"
  | "Interviewing"
  | "Offer Extended"
  | "Filled"
  | "Archived";

interface LifecycleBadgeProps {
  state: ProjectState;
}

const stateStyles: Record<ProjectState, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-emerald-50 text-emerald-700",
  Reviewing: "bg-amber-50 text-amber-700",
  Interviewing: "bg-blue-50 text-blue-700",
  "Offer Extended": "bg-purple-50 text-purple-700",
  Filled: "bg-indigo-50 text-indigo-700",
  Archived: "bg-gray-100 text-gray-500",
};

export function LifecycleBadge({ state }: LifecycleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        stateStyles[state]
      )}
      aria-label={`Project state: ${state}`}
    >
      {state}
    </span>
  );
}
