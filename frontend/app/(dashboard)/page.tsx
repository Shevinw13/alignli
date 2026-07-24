import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/features/home/components/project-card";
import { ClosedProjectCard } from "@/features/home/components/closed-project-card";
import { EmptyState } from "@/features/home/components/empty-state";

// ─── Mock data (will be replaced by API integration in task 20) ──────────────

interface OpenProject {
  id: string;
  title: string;
  status: "In Progress" | "Active" | "Reviewing" | "Interviewing" | "Offer Extended";
  candidateCount: number;
  topMatchesCount: number;
  updatedAt: string;
}

interface ClosedProject {
  id: string;
  title: string;
  filledDate: string;
}

const mockOpenProjects: OpenProject[] = [
  {
    id: "1",
    title: "Senior Frontend Engineer",
    status: "Active",
    candidateCount: 24,
    topMatchesCount: 5,
    updatedAt: "2024-12-10T10:00:00Z",
  },
  {
    id: "2",
    title: "Product Designer",
    status: "In Progress",
    candidateCount: 12,
    topMatchesCount: 3,
    updatedAt: "2024-12-09T14:00:00Z",
  },
  {
    id: "3",
    title: "Engineering Manager",
    status: "Reviewing",
    candidateCount: 18,
    topMatchesCount: 4,
    updatedAt: "2024-12-08T09:00:00Z",
  },
];

const mockClosedProjects: ClosedProject[] = [
  {
    id: "4",
    title: "Backend Engineer",
    filledDate: "2024-11-20T00:00:00Z",
  },
  {
    id: "5",
    title: "Data Analyst",
    filledDate: "2024-10-15T00:00:00Z",
  },
];

// ─── Page component ──────────────────────────────────────────────────────────

export default function HomePage() {
  // Sort open projects by most recently updated
  const openProjects = [...mockOpenProjects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Sort closed projects by filled date descending
  const closedProjects = [...mockClosedProjects].sort(
    (a, b) =>
      new Date(b.filledDate).getTime() - new Date(a.filledDate).getTime()
  );

  const hasProjects = openProjects.length > 0 || closedProjects.length > 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Hiring Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your open and closed hiring projects.
          </p>
        </div>

        {hasProjects && (
          <Button
            className={cn(
              "inline-flex items-center gap-1.5",
              "bg-indigo-600 text-white hover:bg-indigo-700",
              "rounded-[12px] px-4 py-2 text-sm font-medium"
            )}
            render={<Link href="/projects/new" />}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Hiring Project
          </Button>
        )}
      </div>

      {/* Empty state */}
      {!hasProjects && <EmptyState />}

      {/* Open projects section */}
      {openProjects.length > 0 && (
        <section aria-labelledby="open-projects-heading">
          <div className="flex items-center gap-2">
            <h2
              id="open-projects-heading"
              className="text-lg font-semibold text-navy"
            >
              Open Hiring Projects
            </h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700">
              {openProjects.length}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                title={project.title}
                status={project.status}
                candidateCount={project.candidateCount}
                topMatchesCount={project.topMatchesCount}
              />
            ))}
          </div>
        </section>
      )}

      {/* Closed projects section */}
      {closedProjects.length > 0 && (
        <section aria-labelledby="closed-projects-heading">
          <h2
            id="closed-projects-heading"
            className="text-lg font-semibold text-navy"
          >
            Closed Projects
          </h2>

          <div className="mt-4 space-y-3">
            {closedProjects.map((project) => (
              <ClosedProjectCard
                key={project.id}
                id={project.id}
                title={project.title}
                filledDate={project.filledDate}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
