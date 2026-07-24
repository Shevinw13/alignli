"""Tests for input validation and sanitization base models."""

from __future__ import annotations

from pydantic import Field

from app.core.security.validation import SanitizedBaseModel, sanitize_string, strip_html_tags


# --- Unit Tests for strip_html_tags ---


class TestStripHtmlTags:
    def test_removes_simple_tags(self):
        assert strip_html_tags("<b>hello</b>") == "hello"

    def test_removes_tags_with_attributes(self):
        assert strip_html_tags('<a href="http://evil.com">click</a>') == "click"

    def test_removes_self_closing_tags(self):
        assert strip_html_tags("hello<br/>world") == "helloworld"

    def test_removes_script_tags(self):
        assert strip_html_tags("<script>alert('xss')</script>") == "alert('xss')"

    def test_removes_nested_tags(self):
        assert strip_html_tags("<div><p>text</p></div>") == "text"

    def test_no_tags_unchanged(self):
        assert strip_html_tags("plain text") == "plain text"

    def test_empty_string(self):
        assert strip_html_tags("") == ""

    def test_removes_html_entities(self):
        assert strip_html_tags("hello&amp;world") == "helloworld"

    def test_removes_numeric_entities(self):
        assert strip_html_tags("hello&#60;world") == "helloworld"

    def test_removes_hex_entities(self):
        assert strip_html_tags("hello&#x3C;world") == "helloworld"


# --- Unit Tests for sanitize_string ---


class TestSanitizeString:
    def test_strips_whitespace(self):
        assert sanitize_string("  hello  ") == "hello"

    def test_strips_html_and_whitespace(self):
        assert sanitize_string("  <b>hello</b>  ") == "hello"

    def test_strips_tabs_and_newlines(self):
        assert sanitize_string("\t\nhello\t\n") == "hello"

    def test_preserves_internal_whitespace(self):
        assert sanitize_string("  hello world  ") == "hello world"


# --- Unit Tests for SanitizedBaseModel ---


class SampleModel(SanitizedBaseModel):
    name: str
    description: str = ""
    count: int = 0


class ConstrainedModel(SanitizedBaseModel):
    title: str = Field(max_length=100)
    body: str = Field(max_length=500)


class TestSanitizedBaseModel:
    def test_strips_whitespace_from_string_fields(self):
        model = SampleModel(name="  John Doe  ", description="  desc  ")
        assert model.name == "John Doe"
        assert model.description == "desc"

    def test_strips_html_from_string_fields(self):
        model = SampleModel(name="<script>alert('xss')</script>John")
        assert model.name == "alert('xss')John"

    def test_strips_complex_html(self):
        model = SampleModel(
            name='<img src="x" onerror="alert(1)">Safe Name'
        )
        assert model.name == "Safe Name"

    def test_non_string_fields_unaffected(self):
        model = SampleModel(name="test", count=42)
        assert model.count == 42

    def test_combined_whitespace_and_html(self):
        model = SampleModel(name="  <b>bold text</b>  ")
        assert model.name == "bold text"

    def test_empty_string_stays_empty(self):
        model = SampleModel(name="", description="")
        assert model.name == ""
        assert model.description == ""

    def test_field_length_validation_works_with_sanitization(self):
        """Length validation should apply after sanitization."""
        # A title with exactly 100 chars should pass
        title = "a" * 100
        model = ConstrainedModel(title=title, body="short")
        assert model.title == title

    def test_field_length_validation_rejects_too_long(self):
        """Fields exceeding max_length should be rejected."""
        import pytest

        with pytest.raises(Exception):
            ConstrainedModel(title="a" * 101, body="short")

    def test_sanitization_can_reduce_length_below_limit(self):
        """HTML tags are stripped before length check, so tagged content may pass."""
        # "<b>" + 98 chars + "</b>" = input is longer, but after strip it's 98 chars
        title = "<b>" + "a" * 98 + "</b>"
        model = ConstrainedModel(title=title, body="short")
        assert model.title == "a" * 98
        assert len(model.title) == 98
