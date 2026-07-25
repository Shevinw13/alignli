"""Property-based tests for file upload validation.

These tests verify universal file upload properties under randomized inputs:
- Property 22: File Type Validation Rejects Non-PDF
- Property 23: Bulk Upload Partial Success

**Validates: Requirements 6.7, 6.8**
"""

from __future__ import annotations

import string

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.features.ingestion.schemas import FileMetadata
from app.features.ingestion.service import (
    ALLOWED_EXTENSION,
    ALLOWED_MIME_TYPE,
    MAX_BATCH_SIZE,
    MAX_FILE_SIZE_BYTES,
    _validate_file,
)


# --- Strategies ---

# Non-PDF MIME types (common file types that should all be rejected)
NON_PDF_MIME_TYPES = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/html",
    "image/png",
    "image/jpeg",
    "application/zip",
    "application/octet-stream",
    "application/json",
    "text/csv",
    "application/xml",
    "application/vnd.ms-excel",
]

# Non-PDF file extensions
NON_PDF_EXTENSIONS = [
    ".docx", ".doc", ".txt", ".html", ".png", ".jpg",
    ".zip", ".xlsx", ".csv", ".rtf", ".odt", ".pptx",
]

non_pdf_mime_strategy = st.sampled_from(NON_PDF_MIME_TYPES)
non_pdf_extension_strategy = st.sampled_from(NON_PDF_EXTENSIONS)

# Valid file size (1 byte to 10 MB)
valid_file_size_strategy = st.integers(min_value=1, max_value=MAX_FILE_SIZE_BYTES)

# Oversized file (larger than 10 MB)
oversized_file_strategy = st.integers(
    min_value=MAX_FILE_SIZE_BYTES + 1, max_value=MAX_FILE_SIZE_BYTES * 3
)

# Base filename without extension (alphanumeric, reasonable length)
base_filename_strategy = st.text(
    alphabet=string.ascii_lowercase + string.digits + "_-",
    min_size=1,
    max_size=50,
).filter(lambda s: len(s.strip()) > 0)


# --- Property 22: File Type Validation Rejects Non-PDF ---


class TestFileTypeValidationRejectsNonPDF:
    """Property 22: File Type Validation Rejects Non-PDF.

    *For any* file with a non-PDF MIME type or a non-PDF extension,
    the validation SHALL reject the file before upload with a reason string.

    **Validates: Requirements 6.7**
    """

    @given(
        base_name=base_filename_strategy,
        extension=non_pdf_extension_strategy,
        size=valid_file_size_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_non_pdf_extension_rejected_even_with_pdf_mime(
        self, base_name: str, extension: str, size: int
    ):
        """Files with non-PDF extensions are rejected even if MIME type is application/pdf."""
        file = FileMetadata(
            filename=f"{base_name}{extension}",
            size_bytes=size,
            mime_type=ALLOWED_MIME_TYPE,  # correct MIME type but wrong extension
        )
        reason = _validate_file(file)
        assert reason is not None, f"File with extension '{extension}' should be rejected"
        assert "PDF" in reason or "pdf" in reason.lower()

    @given(
        base_name=base_filename_strategy,
        mime_type=non_pdf_mime_strategy,
        size=valid_file_size_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_non_pdf_mime_type_rejected_even_with_pdf_extension(
        self, base_name: str, mime_type: str, size: int
    ):
        """Files with non-PDF MIME types are rejected even if extension is .pdf."""
        file = FileMetadata(
            filename=f"{base_name}.pdf",
            size_bytes=size,
            mime_type=mime_type,
        )
        reason = _validate_file(file)
        assert reason is not None, f"File with MIME type '{mime_type}' should be rejected"
        assert "PDF" in reason or "pdf" in reason.lower()

    @given(
        base_name=base_filename_strategy,
        extension=non_pdf_extension_strategy,
        mime_type=non_pdf_mime_strategy,
        size=valid_file_size_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_non_pdf_extension_and_mime_both_rejected(
        self, base_name: str, extension: str, mime_type: str, size: int
    ):
        """Files with both non-PDF extension and non-PDF MIME are rejected."""
        file = FileMetadata(
            filename=f"{base_name}{extension}",
            size_bytes=size,
            mime_type=mime_type,
        )
        reason = _validate_file(file)
        assert reason is not None

    @given(
        base_name=base_filename_strategy,
        size=valid_file_size_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_valid_pdf_accepted(self, base_name: str, size: int):
        """Files with correct PDF extension and MIME type and valid size are accepted."""
        file = FileMetadata(
            filename=f"{base_name}.pdf",
            size_bytes=size,
            mime_type=ALLOWED_MIME_TYPE,
        )
        reason = _validate_file(file)
        assert reason is None, f"Valid PDF should be accepted, got: {reason}"

    @given(
        base_name=base_filename_strategy,
        size=oversized_file_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_oversized_pdf_rejected(self, base_name: str, size: int):
        """PDF files exceeding 10 MB are rejected regardless of valid type."""
        file = FileMetadata(
            filename=f"{base_name}.pdf",
            size_bytes=size,
            mime_type=ALLOWED_MIME_TYPE,
        )
        reason = _validate_file(file)
        assert reason is not None
        assert "10 MB" in reason or "size" in reason.lower()


# --- Property 23: Bulk Upload Partial Success ---


class TestBulkUploadPartialSuccess:
    """Property 23: Bulk Upload Partial Success.

    *For any* batch of files where some are valid PDFs and some are invalid,
    the system SHALL process valid files, reject invalid files with reasons,
    and return an accurate summary (accepted_count + rejected_count == total).

    **Validates: Requirements 6.8**
    """

    @given(
        valid_names=st.lists(base_filename_strategy, min_size=1, max_size=10),
        invalid_extensions=st.lists(non_pdf_extension_strategy, min_size=1, max_size=10),
        invalid_names=st.lists(base_filename_strategy, min_size=1, max_size=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_mixed_batch_counts_are_accurate(
        self,
        valid_names: list[str],
        invalid_extensions: list[str],
        invalid_names: list[str],
    ):
        """accepted_count + rejected_count equals total files submitted."""
        # Build valid files
        valid_files = [
            FileMetadata(
                filename=f"{name}.pdf",
                size_bytes=500_000,
                mime_type=ALLOWED_MIME_TYPE,
            )
            for name in valid_names
        ]

        # Build invalid files (wrong extension)
        n_invalid = min(len(invalid_extensions), len(invalid_names))
        invalid_files = [
            FileMetadata(
                filename=f"{invalid_names[i]}{invalid_extensions[i]}",
                size_bytes=500_000,
                mime_type="application/octet-stream",
            )
            for i in range(n_invalid)
        ]

        all_files = valid_files + invalid_files
        total = len(all_files)

        # Validate each file individually (mimicking service behavior)
        accepted = 0
        rejected = 0
        for f in all_files:
            reason = _validate_file(f)
            if reason is None:
                accepted += 1
            else:
                rejected += 1
                # Each rejected file must have a non-empty reason
                assert len(reason) > 0

        # Summary counts are accurate
        assert accepted + rejected == total
        assert accepted == len(valid_files)
        assert rejected == n_invalid

    @given(
        valid_count=st.integers(min_value=0, max_value=10),
        invalid_count=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_all_valid_batch_has_zero_rejections(
        self, valid_count: int, invalid_count: int
    ):
        """A batch of only valid PDFs has rejected_count == 0."""
        if valid_count == 0:
            return  # Skip empty batches (min 1 file required by schema)

        files = [
            FileMetadata(
                filename=f"resume_{i}.pdf",
                size_bytes=500_000,
                mime_type=ALLOWED_MIME_TYPE,
            )
            for i in range(valid_count)
        ]

        rejected = sum(1 for f in files if _validate_file(f) is not None)
        assert rejected == 0

    @given(
        invalid_mimes=st.lists(non_pdf_mime_strategy, min_size=1, max_size=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_all_invalid_batch_has_zero_acceptances(
        self, invalid_mimes: list[str]
    ):
        """A batch of only invalid files has accepted_count == 0."""
        files = [
            FileMetadata(
                filename=f"file_{i}.docx",
                size_bytes=500_000,
                mime_type=mime,
            )
            for i, mime in enumerate(invalid_mimes)
        ]

        accepted = sum(1 for f in files if _validate_file(f) is None)
        assert accepted == 0

    @given(
        valid_count=st.integers(min_value=1, max_value=15),
        oversized_count=st.integers(min_value=1, max_value=5),
        wrong_type_count=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_each_rejection_has_specific_reason(
        self, valid_count: int, oversized_count: int, wrong_type_count: int
    ):
        """Every rejected file has a non-empty reason explaining why."""
        files = []
        # Valid PDFs
        for i in range(valid_count):
            files.append(FileMetadata(
                filename=f"valid_{i}.pdf",
                size_bytes=500_000,
                mime_type=ALLOWED_MIME_TYPE,
            ))
        # Oversized PDFs
        for i in range(oversized_count):
            files.append(FileMetadata(
                filename=f"large_{i}.pdf",
                size_bytes=MAX_FILE_SIZE_BYTES + 1_000_000,
                mime_type=ALLOWED_MIME_TYPE,
            ))
        # Wrong type
        for i in range(wrong_type_count):
            files.append(FileMetadata(
                filename=f"doc_{i}.docx",
                size_bytes=500_000,
                mime_type="application/msword",
            ))

        for f in files:
            reason = _validate_file(f)
            if reason is not None:
                # Reason is specific and non-empty
                assert len(reason) > 0
                assert isinstance(reason, str)
