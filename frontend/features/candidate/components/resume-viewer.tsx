"use client";

import { FileText, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SectionCard } from "./section-card";

interface ResumeViewerProps {
  fileName: string | null;
  fileUrl: string | null;
}

/**
 * Original Resume viewer — view and download the uploaded resume via signed URL.
 * Opens PDF in a new browser tab for viewing, or downloads it.
 *
 * Requirement 11.6
 */
export function ResumeViewer({ fileName, fileUrl }: ResumeViewerProps) {
  return (
    <SectionCard
      title="Original Resume"
      icon={<FileText className="h-5 w-5" aria-hidden="true" />}
    >
      {fileName && fileUrl ? (
        <div className="flex items-center justify-between rounded-[12px] border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-red-50">
              <FileText className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy">{fileName}</p>
              <p className="text-xs text-muted-foreground">PDF Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              aria-label={`View ${fileName} (opens in new tab)`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View
            </a>
            <a
              href={fileUrl}
              download={fileName}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              aria-label={`Download ${fileName}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No resume file available.
        </p>
      )}
    </SectionCard>
  );
}
