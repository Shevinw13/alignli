"use client";

import { useCallback } from "react";
import { useMutation } from "./use-api";
import { uploadResumes } from "@/lib/services/ingestion";
import type {
  FileMetadata,
  ResumeUploadResponse,
} from "@/lib/services/ingestion";

/**
 * Hook to validate resume files and get signed upload URLs.
 * Triggered when user confirms file selection in the upload step.
 */
export function useUploadResumes() {
  const mutationFn = useCallback(
    (projectId: string, files: FileMetadata[]) =>
      uploadResumes(projectId, files),
    []
  );
  return useMutation(mutationFn);
}
