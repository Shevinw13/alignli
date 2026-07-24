"""Pydantic schemas for Resume Ingestion API.

Defines request/response models for the file upload validation,
signed URL generation endpoint, and retry endpoint.

Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 6.8, 7.9
"""

from __future__ import annotations

import uuid
from typing import List, Union

from pydantic import BaseModel, Field


class FileMetadata(BaseModel):
    """Metadata for a single file in the upload request."""

    filename: str = Field(..., description="Original filename including extension")
    size_bytes: int = Field(..., ge=0, description="File size in bytes")
    mime_type: str = Field(..., description="MIME type of the file")


class ResumeUploadRequest(BaseModel):
    """Request body for bulk resume upload validation.

    Contains metadata for each file to validate before generating
    signed upload URLs.
    """

    files: List[FileMetadata] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of file metadata (max 50 files per batch)",
    )


class FileAcceptedResult(BaseModel):
    """Result for a file that passed validation."""

    filename: str
    status: str = "accepted"
    upload_url: str = Field(..., description="Signed upload URL for Supabase Storage")
    candidate_id: uuid.UUID = Field(..., description="UUID of the created candidate record")


class FileRejectedResult(BaseModel):
    """Result for a file that failed validation."""

    filename: str
    status: str = "rejected"
    reason: str = Field(..., description="Reason the file was rejected")


class ResumeUploadResponse(BaseModel):
    """Response for the bulk resume upload endpoint.

    Contains per-file results (accepted with upload URLs or rejected with reasons)
    plus summary counts.
    """

    results: List[Union[FileAcceptedResult, FileRejectedResult]]
    accepted_count: int = Field(..., ge=0, description="Number of accepted files")
    rejected_count: int = Field(..., ge=0, description="Number of rejected files")


class RetryResponse(BaseModel):
    """Response for the candidate retry endpoint."""

    candidate_id: uuid.UUID = Field(..., description="UUID of the candidate being retried")
    status: str = Field(
        default="retry_triggered",
        description="Status indicating retry was initiated",
    )
    message: str = Field(
        default="Candidate processing retry has been triggered",
        description="Human-readable status message",
    )
