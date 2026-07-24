"use client";

import { useCallback } from "react";
import { useApi, useMutation } from "./use-api";
import {
  listProjects,
  getProject,
  createProject,
  transitionProjectState,
} from "@/lib/services/projects";
import type {
  ProjectListResponse,
  Project,
  CreateProjectRequest,
} from "@/lib/services/projects";

/**
 * Hook to fetch the list of hiring projects for the home page.
 * Fetches on mount and provides a refetch function.
 */
export function useProjects(page = 1, pageSize = 25) {
  return useApi<ProjectListResponse>(
    () => listProjects(page, pageSize),
    [page, pageSize]
  );
}

/**
 * Hook to fetch a single project by ID.
 */
export function useProject(projectId: string) {
  return useApi<Project>(() => getProject(projectId), [projectId]);
}

/**
 * Hook to create a new hiring project.
 */
export function useCreateProject() {
  const mutationFn = useCallback(
    (data: CreateProjectRequest) => createProject(data),
    []
  );
  return useMutation(mutationFn);
}

/**
 * Hook to transition a project's lifecycle state.
 */
export function useTransitionProjectState() {
  const mutationFn = useCallback(
    (projectId: string, state: string) =>
      transitionProjectState(projectId, state),
    []
  );
  return useMutation(mutationFn);
}
