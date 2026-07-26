"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, CheckCircle2, XCircle, FileText, Link2 } from "lucide-react";
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

/**
 * Parse a candidate's name from pasted text.
 * Looks at the first non-empty line — typically the name in LinkedIn pastes.
 */
function parseCandidateName(text: string): string {
  const lines = text.trim().split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines
    if (!trimmed) continue;
    // A name is typically short (< 40 chars), doesn't start with common non-name patterns
    if (
      trimmed.length <= 40 &&
      !trimmed.startsWith("http") &&
      !trimmed.startsWith("About") &&
      !trimmed.startsWith("Experience") &&
      !trimmed.includes("@")
    ) {
      return trimmed;
    }
    break;
  }
  return "Unknown";
}

// --- Component ---

export function ResumeUploadStep({ onContinue, projectId }: ResumeUploadStepProps) {
  const [inputMode, setInputMode] = useState<"upload" | "paste" | "linkedin">("upload");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [pastedResumes, setPastedResumes] = useState<string[]>([]);
  const [currentPaste, setCurrentPaste] = useState("");
  const [linkedinUrls, setLinkedinUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchLimitError, setBatchLimitError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedFiles = fileEntries.filter((f) => f.status === "accepted");
  const rejectedFiles = fileEntries.filter((f) => f.status === "rejected");
  const uploadingFiles = fileEntries.filter((f) => f.status === "uploading");
  const isUploading = uploadingFiles.length > 0;
  
  const totalCandidates = acceptedFiles.length + pastedResumes.length + linkedinUrls.length;
  const canContinue = totalCandidates > 0 && !isUploading;

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

  // --- Paste handlers ---
  const handleAddPaste = () => {
    const trimmed = currentPaste.trim();
    if (trimmed.length < 50) return;
    setPastedResumes((prev) => [...prev, trimmed]);
    setCurrentPaste("");
  };

  const handleRemovePaste = (index: number) => {
    setPastedResumes((prev) => prev.filter((_, i) => i !== index));
  };

  // --- LinkedIn handlers ---
  const handleAddLinkedin = () => {
    const trimmed = currentUrl.trim();
    if (trimmed.length < 50) {
      setUrlError("Profile content is too short. Please paste the full LinkedIn profile.");
      return;
    }
    setUrlError("");
    setLinkedinUrls((prev) => [...prev, trimmed]);
    setCurrentUrl("");
  };

  const handleRemoveLinkedin = (index: number) => {
    setLinkedinUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input mode tabs */}
      <div className="flex gap-2" role="tablist" aria-label="Candidate input method">
        {([
          { id: "upload", label: "Upload Resumes" },
          { id: "paste", label: "Paste Text" },
          { id: "linkedin", label: "LinkedIn Profile" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={inputMode === tab.id}
            onClick={() => setInputMode(tab.id)}
            className={cn(
              "rounded-[8px] px-4 py-2 text-sm font-medium transition-colors",
              inputMode === tab.id
                ? "bg-violet-50 text-violet-700"
                : "text-muted-foreground hover:bg-gray-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upload mode */}
      {inputMode === "upload" && (
        <>
          {/* Drop zone */}
          <div
        role="button"
        tabIndex={0}
        aria-label="Drag and drop PDF resumes here, or click to browse files"
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-violet-400 bg-violet-50 scale-[1.01]"
            : "border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"
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
            "h-12 w-12",
            isDragOver ? "text-violet-500 scale-110 transition-transform" : "text-gray-300"
          )}
          aria-hidden="true"
        />
        <p className="text-center text-base font-medium text-gray-700">
          Drag &amp; drop resumes here
        </p>
        <p className="text-center text-sm text-gray-400">
          or{" "}
          <span className="font-medium text-violet-600 underline underline-offset-2">browse files</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          PDF files · Up to {MAX_FILES_PER_BATCH} at a time
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
                        className="h-full rounded-full bg-violet-500 transition-[width] duration-200"
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
        </>
      )}

      {/* Paste text mode */}
      {inputMode === "paste" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste resume text directly. Each paste is treated as one candidate.
          </p>
          <textarea
            value={currentPaste}
            onChange={(e) => setCurrentPaste(e.target.value)}
            placeholder="Paste a candidate's resume text here (minimum 50 characters)..."
            rows={8}
            className={cn(
              "w-full resize-y rounded-[12px] border px-4 py-3 text-sm text-navy",
              "placeholder:text-muted-foreground outline-none transition-colors",
              "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
              "border-border"
            )}
          />
          <Button
            type="button"
            onClick={handleAddPaste}
            disabled={currentPaste.trim().length < 50}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Add Candidate
          </Button>

          {/* Pasted resumes list */}
          {pastedResumes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-navy">
                Pasted resumes ({pastedResumes.length})
              </h3>
              <ul className="space-y-1">
                {pastedResumes.map((text, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {parseCandidateName(text)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePaste(i)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700"
                      aria-label={`Remove pasted candidate ${i + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* LinkedIn mode — paste profile content */}
      {inputMode === "linkedin" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy a candidate's LinkedIn profile page content and paste it here. Go to their profile, select all (Cmd+A), copy (Cmd+C), and paste below.
          </p>
          <textarea
            value={currentUrl}
            onChange={(e) => {
              setCurrentUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            placeholder="Paste LinkedIn profile content here (name, headline, experience, education, skills...)&#10;&#10;Tip: Open their LinkedIn profile → Cmd+A → Cmd+C → Paste here"
            rows={8}
            className={cn(
              "w-full resize-y rounded-[12px] border px-4 py-3 text-sm text-navy",
              "placeholder:text-muted-foreground outline-none transition-colors",
              "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
              urlError ? "border-red-500" : "border-border"
            )}
          />
          {urlError && (
            <p className="text-xs text-red-500" role="alert">{urlError}</p>
          )}
          <Button
            type="button"
            onClick={handleAddLinkedin}
            disabled={currentUrl.trim().length < 50}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Add Candidate
          </Button>

          {/* LinkedIn profiles list */}
          {linkedinUrls.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-navy">
                LinkedIn profiles ({linkedinUrls.length})
              </h3>
              <ul className="space-y-1">
                {linkedinUrls.map((text, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <Link2 className="h-4 w-4 shrink-0 text-[#0A66C2]" aria-hidden="true" />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {parseCandidateName(text)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLinkedin(i)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700"
                      aria-label={`Remove LinkedIn profile ${i + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Total candidates summary */}
      {totalCandidates > 0 && (
        <div className="rounded-lg border border-border bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-navy">
            {totalCandidates} candidate{totalCandidates !== 1 ? "s" : ""} ready to process
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {acceptedFiles.length > 0 && `${acceptedFiles.length} resume${acceptedFiles.length !== 1 ? "s" : ""}`}
            {acceptedFiles.length > 0 && (pastedResumes.length > 0 || linkedinUrls.length > 0) && " · "}
            {pastedResumes.length > 0 && `${pastedResumes.length} pasted`}
            {pastedResumes.length > 0 && linkedinUrls.length > 0 && " · "}
            {linkedinUrls.length > 0 && `${linkedinUrls.length} LinkedIn`}
          </p>
        </div>
      )}
    </div>
  );
}
