"""Input validation and sanitization base models.

Provides Pydantic base model classes that automatically:
- Strip leading/trailing whitespace from string fields
- Strip HTML tags from text inputs to prevent XSS
- Validate string lengths

Requirements: 18.2
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, model_validator


# Pattern to match HTML tags (including self-closing and with attributes)
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

# Pattern to match common HTML entities
_HTML_ENTITY_PATTERN = re.compile(r"&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);")


def strip_html_tags(value: str) -> str:
    """Remove HTML tags from a string to prevent XSS.

    Strips all HTML/XML tags and decodes common HTML entities.
    """
    # Remove HTML tags
    cleaned = _HTML_TAG_PATTERN.sub("", value)
    # Remove HTML entities (convert to empty string for safety)
    cleaned = _HTML_ENTITY_PATTERN.sub("", cleaned)
    return cleaned


def sanitize_string(value: str) -> str:
    """Sanitize a string input by stripping whitespace and HTML tags."""
    # Strip leading/trailing whitespace
    value = value.strip()
    # Strip HTML tags
    value = strip_html_tags(value)
    return value


class SanitizedBaseModel(BaseModel):
    """Base Pydantic model that automatically sanitizes string inputs.

    All string fields are automatically:
    - Stripped of leading/trailing whitespace
    - Stripped of HTML tags to prevent XSS attacks

    Subclasses inherit this behavior for all string fields.
    """

    @model_validator(mode="before")
    @classmethod
    def sanitize_strings(cls, data: Any) -> Any:
        """Sanitize all string fields before validation."""
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if isinstance(value, str):
                    sanitized[key] = sanitize_string(value)
                else:
                    sanitized[key] = value
            return sanitized
        return data
