"""Unit tests for score color coding utility.

Tests all boundary values, mid-range values, and invalid inputs.
Requirements: 10.3
"""

import pytest

from app.features.scoring.colors import score_color


class TestScoreColorBoundaries:
    """Test all boundary values where color changes occur."""

    def test_score_0_is_gray(self) -> None:
        assert score_color(0) == "gray"

    def test_score_64_is_gray(self) -> None:
        assert score_color(64) == "gray"

    def test_score_65_is_amber(self) -> None:
        assert score_color(65) == "amber"

    def test_score_79_is_amber(self) -> None:
        assert score_color(79) == "amber"

    def test_score_80_is_blue(self) -> None:
        assert score_color(80) == "blue"

    def test_score_94_is_blue(self) -> None:
        assert score_color(94) == "blue"

    def test_score_95_is_green(self) -> None:
        assert score_color(95) == "green"

    def test_score_100_is_green(self) -> None:
        assert score_color(100) == "green"


class TestScoreColorMidRange:
    """Test representative mid-range values within each color band."""

    def test_score_30_is_gray(self) -> None:
        assert score_color(30) == "gray"

    def test_score_50_is_gray(self) -> None:
        assert score_color(50) == "gray"

    def test_score_70_is_amber(self) -> None:
        assert score_color(70) == "amber"

    def test_score_85_is_blue(self) -> None:
        assert score_color(85) == "blue"

    def test_score_98_is_green(self) -> None:
        assert score_color(98) == "green"


class TestScoreColorInvalidInputs:
    """Test that invalid inputs raise ValueError."""

    def test_negative_score_raises(self) -> None:
        with pytest.raises(ValueError, match="must be between 0 and 100"):
            score_color(-1)

    def test_score_above_100_raises(self) -> None:
        with pytest.raises(ValueError, match="must be between 0 and 100"):
            score_color(101)

    def test_large_negative_raises(self) -> None:
        with pytest.raises(ValueError, match="must be between 0 and 100"):
            score_color(-100)

    def test_large_positive_raises(self) -> None:
        with pytest.raises(ValueError, match="must be between 0 and 100"):
            score_color(200)

    def test_float_raises(self) -> None:
        with pytest.raises(ValueError, match="must be an integer"):
            score_color(85.5)  # type: ignore[arg-type]

    def test_string_raises(self) -> None:
        with pytest.raises(ValueError, match="must be an integer"):
            score_color("90")  # type: ignore[arg-type]

    def test_none_raises(self) -> None:
        with pytest.raises(ValueError, match="must be an integer"):
            score_color(None)  # type: ignore[arg-type]
