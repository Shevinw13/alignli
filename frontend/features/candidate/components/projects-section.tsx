"use client";

import { FolderOpen } from "lucide-react";
import { SectionCard } from "./section-card";

interface Project {
  name: string;
  description: string;
  url?: string;
  technologies: string[];
}

interface ProjectsSectionProps {
  projects: Project[];
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Projects section — notable projects from the candidate's resume.
 *
 * Requirement 11.1
 */
export function ProjectsSection({
  projects,
  error = false,
  onRetry,
}: ProjectsSectionProps) {
  return (
    <SectionCard
      title="Projects"
      icon={<FolderOpen className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-navy">
                  {project.name}
                </h3>
                {project.url && (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                    aria-label={`View ${project.name} (opens in new tab)`}
                  >
                    View →
                  </a>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
              {project.technologies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {project.technologies.map((tech, tIdx) => (
                    <span
                      key={tIdx}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No projects listed.
        </p>
      )}
    </SectionCard>
  );
}
