"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, CheckCircle2, XCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  validateFile,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
} from "../lib/file-validation";

// --- Types ---

type FileStatus = "pending" | "uploading" | "accepted" | "rejected";

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  rejectionReason?: string;
}

export interface ResumeUploadStepProps {
  /** Called when the user clicks "Continue" with accepted file entries */
  onContinue: (files: File[]) => void;
  /** Optional project ID for upload path association */
  projectId?: string;
}

// --- Helpers ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Component ---

export function ResumeUploadStep({ onContinue, projectId }: ResumeUploadStepProps) {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchLimitError, setBatchLimitError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedFiles = fileEntries.filter((f) => f.status === "accepted");
  const rejectedFiles = fileEntries.filter((f) => f.status === "rejected");
  const uploadingFiles = fileEntries.filter((f) => f.status === "uploading");
  const isUploading = uploadingFiles.length > 0;
  const canContinue = acceptedFiles.length > 0 && !isUploading;

  const processFiles = useCallback(
    (incoming: File[]) => {
      const currentCount = fileEntries.length;
      const remainingSlots = MAX_FILES_PER_BATCH - currentCount;

      if (remainingSlots <= 0) {
        setBatchLimitError(true);
        return;
      }

      // Clear any previous batch limit error
      setBatchLimitError(false);

      const filesToProcess = incoming.slice(0, remainingSlots);

      const newEntries: FileEntry[] = filesToProcess.map((file) => {
        const rejection = validateFile(file);
        return {
          id: generateId(),
          file,
          status: rejection ? "rejected" : "pending",
          progress: rejection ? 0 : 0,
          rejectionReason: rejection ?? undefined,
        };
      });

      // If we had to drop some files due to limit, add overflow entries
      if (incoming.length > remainingSlots) {
        setBatchLimitError(true);
        const overflowCount = incoming.length - remainingSlots;
        for (let i = remainingSlots; i < incoming.length; i++) {
          newEntries.push({
            id: generateId(),
            file: incoming[i],
            status: "rejected",
            progress: 0,
            rejectionReason: `Exceeds batch limit of ${MAX_FILES_PER_BATCH} files (${overflowCount} file${overflowCount > 1 ? "s" : ""} over limit)`,
          });
        }
      }

      setFileEntries((prev) => [...prev, ...newEntries]);

      // Simulate upload for valid files
      const validEntries = newEntries.filter((e) => e.status === "pending");
      validEntries.forEach((entry) => {
        simulateUpload(entry.id);
      });
    },
    [fileEntries.length]
  );

  const simulateUpload = (entryId: string) => {
    // Mark as uploading
    setFileEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: "uploading" as FileStatus } : e))
    );

    // Simulate progress in increments
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFileEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, status: "accepted" as FileStatus, progress: 100 } : e
          )
        );
      } else {
        setFileEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, progress: Math.min(progress, 99) } : e))
        );
      }
    }, 200 + Math.random() * 300);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        processFiles(files);
      }
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [processFiles]
  );

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const handleContinue = () => {
    const accepted = fileEntries
      .filter((f) => f.status === "accepted")
      .map((f) => f.file);
    onContinue(accepted);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag and drop PDF resumes here, or click to browse files"
        className={cn(
          "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-indigo-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        <CloudUpload
          className={cn(
            "h-10 w-10",
            isDragOver ? "text-indigo-500" : "text-gray-400"
          )}
          aria-hidden="true"
        />
        <p className="text-center text-sm text-muted-foreground">
          Drag &amp; drop PDF resumes here
        </p>
        <p className="text-center text-sm text-muted-foreground">
          or{" "}
          <span className="font-medium text-indigo-600 underline">browse files</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_FILES_PER_BATCH} files, max {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB each
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Batch limit error */}
      {batchLimitError && (
        <div
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-700">
            Maximum of {MAX_FILES_PER_BATCH} files per batch reached. Remove some files to add more.
          </p>
        </div>
      )}

      {/* File list */}
      {fileEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-navy">
            Uploaded files ({fileEntries.length})
          </h3>
          <ul className="flex flex-col gap-1" role="list" aria-label="Uploaded files">
            {fileEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-foreground">
                      {entry.file.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(entry.file.size)}
                    </span>
                  </div>
                  {/* Progress bar for uploading files */}
                  {entry.status === "uploading" && (
                    <div
                      className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-valuenow={Math.round(entry.progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Uploading ${entry.file.name}`}
                    >
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                  )}
                  {/* Rejection reason */}
                  {entry.status === "rejected" && entry.rejectionReason && (
                    <p className="mt-0.5 text-xs text-red-600">
                      {entry.rejectionReason}
                    </p>
                  )}
                </div>
                {/* Status icon */}
                <div className="shrink-0">
                  {entry.status === "accepted" && (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-500"
                      aria-label="Accepted"
                    />
                  )}
                  {entry.status === "rejected" && (
                    <XCircle
                      className="h-4 w-4 text-red-500"
                      aria-label="Rejected"
                    />
                  )}
                  {entry.status === "uploading" && (
                    <span className="text-xs text-muted-foreground" aria-label="Uploading">
                      {Math.round(entry.progress)}%
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {fileEntries.length > 0 && (
        <div className="flex items-center gap-4 text-sm" role="status" aria-live="polite">
          {acceptedFiles.length > 0 && (
            <span className="text-emerald-600">
              {acceptedFiles.length} file{acceptedFiles.length !== 1 ? "s" : ""} accepted
            </span>
          )}
          {rejectedFiles.length > 0 && (
            <span className="text-red-600">
              {rejectedFiles.length} file{rejectedFiles.length !== 1 ? "s" : ""} rejected
            </span>
          )}
          {uploadingFiles.length > 0 && (
            <span className="text-muted-foreground">
              {uploadingFiles.length} file{uploadingFiles.length !== 1 ? "s" : ""} uploading
            </span>
          )}
        </div>
      )}

      {/* Continue button */}
      <div className="pt-2">
        <Button
          disabled={!canContinue}
          onClick={handleContinue}
          className="h-10 rounded-[12px] bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          aria-disabled={!canContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
