"""Unit tests for confidence level classification.

Tests the classify_confidence function covering all classification rules
and edge cases.

Validates: Requirements 7.7
"""

import pytest

from app.features.ingestion.confidence import (
    HIGH,
    LOW,
    MEDIUM,
    classify_confidence,
    _is_populated,
)


class TestIsPopulated:
    """Tests for the _is_populated helper function."""

    def test_none_is_not_populated(self):
        assert _is_populated(None) is False

    def test_empty_list_is_not_populated(self):
        assert _is_populated([]) is False

    def test_empty_dict_is_not_populated(self):
        assert _is_populated({}) is False

    def test_empty_string_is_not_populated(self):
        assert _is_populated("") is False

    def test_whitespace_string_is_not_populated(self):
        assert _is_populated("   ") is False

    def test_non_empty_list_is_populated(self):
        assert _is_populated(["item"]) is True

    def test_non_empty_dict_is_populated(self):
        assert _is_populated({"key": "value"}) is True

    def test_non_empty_string_is_populated(self):
        assert _is_populated("hello") is True

    def test_number_is_populated(self):
        assert _is_populated(42) is True

    def test_zero_is_populated(self):
        # Zero is a valid value, not "missing"
        assert _is_populated(0) is True


class TestClassifyConfidence:
    """Tests for the classify_confidence function."""

    def _full_data(self):
        """Helper to create fully populated parsed data."""
        return {
            "contact_info": {"email": "john@example.com", "phone": "555-1234", "name": "John"},
            "work_experience": [
                {"company": "Acme", "title": "Engineer", "years": 3}
            ],
            "education": [
                {"institution": "MIT", "degree": "BS Computer Science"}
            ],
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "certifications": ["AWS Solutions Architect"],
        }

    def test_all_fields_populated_returns_high(self):
        """All structured fields populated -> High confidence."""
        data = self._full_data()
        assert classify_confidence(data) == HIGH

    def test_contact_and_experience_only_returns_medium(self):
        """Only contact_info and work_experience populated -> Medium."""
        data = {
            "contact_info": {"email": "john@example.com", "name": "John"},
            "work_experience": [{"company": "Acme", "title": "Engineer"}],
            "education": [],
            "skills": [],
            "certifications": [],
        }
        assert classify_confidence(data) == MEDIUM

    def test_contact_and_experience_with_missing_others_returns_medium(self):
        """Contact + experience present, other fields missing entirely -> Medium."""
        data = {
            "contact_info": {"email": "test@test.com"},
            "work_experience": [{"company": "Corp"}],
        }
        assert classify_confidence(data) == MEDIUM

    def test_contact_missing_returns_low(self):
        """Contact info missing -> Low."""
        data = {
            "contact_info": {},
            "work_experience": [{"company": "Acme"}],
            "education": [{"institution": "MIT"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
        }
        assert classify_confidence(data) == LOW

    def test_experience_missing_returns_low(self):
        """Work experience missing -> Low."""
        data = {
            "contact_info": {"email": "john@example.com"},
            "work_experience": [],
            "education": [{"institution": "MIT"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
        }
        assert classify_confidence(data) == LOW

    def test_both_contact_and_experience_missing_returns_low(self):
        """Both contact and experience missing -> Low."""
        data = {
            "contact_info": None,
            "work_experience": None,
            "education": [{"institution": "MIT"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
        }
        assert classify_confidence(data) == LOW

    def test_none_input_returns_low(self):
        """None input -> Low."""
        assert classify_confidence(None) == LOW

    def test_empty_dict_input_returns_low(self):
        """Empty dict input -> Low."""
        assert classify_confidence({}) == LOW

    def test_all_fields_empty_returns_low(self):
        """All fields present but empty -> Low."""
        data = {
            "contact_info": {},
            "work_experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
        }
        assert classify_confidence(data) == LOW

    def test_contact_none_experience_populated_returns_low(self):
        """Contact is None, experience is populated -> Low."""
        data = {
            "contact_info": None,
            "work_experience": [{"company": "Acme"}],
            "education": [{"institution": "MIT"}],
            "skills": ["Python"],
            "certifications": ["AWS"],
        }
        assert classify_confidence(data) == LOW

    def test_medium_with_some_optional_fields_populated(self):
        """Contact + experience + some optional fields -> still Medium (not all populated)."""
        data = {
            "contact_info": {"email": "test@test.com"},
            "work_experience": [{"company": "Corp"}],
            "education": [{"institution": "State U"}],
            "skills": ["Java"],
            "certifications": [],  # empty -> not populated
        }
        assert classify_confidence(data) == MEDIUM

    def test_high_with_minimal_entries(self):
        """All fields with minimal entries -> High."""
        data = {
            "contact_info": {"name": "X"},
            "work_experience": [{"title": "Dev"}],
            "education": [{"degree": "BS"}],
            "skills": ["Go"],
            "certifications": ["Cert1"],
        }
        assert classify_confidence(data) == HIGH
