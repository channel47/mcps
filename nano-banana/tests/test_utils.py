"""Tests for utility functions in nano_banana_mcp."""

import pytest

from nano_banana_mcp.server import (
    get_api_key,
    select_model,
    sanitize_error_response,
    validate_file_size,
    ModelTier,
    FLASH_MODEL,
    PRO_MODEL,
    MAX_FILE_SIZE
)


class TestGetApiKey:
    """Tests for get_api_key function."""

    def test_get_api_key_success(self, mock_api_key):
        """Test successful API key retrieval."""
        key = get_api_key()
        assert key == "test-api-key-abc123"

    def test_get_api_key_missing(self, mock_no_api_key):
        """Test error when API key is missing."""
        with pytest.raises(ValueError, match="Missing GEMINI_API_KEY"):
            get_api_key()


class TestSelectModel:
    """Tests for select_model function."""

    def test_select_pro_when_requested(self):
        """Test Pro model is selected when explicitly requested."""
        model, reason = select_model("any prompt", ModelTier.PRO)
        assert model == PRO_MODEL
        assert "user requested" in reason.lower()

    def test_select_flash_when_requested(self):
        """Test Flash model is selected when explicitly requested."""
        model, reason = select_model("any prompt", ModelTier.FLASH)
        assert model == FLASH_MODEL
        assert "user requested" in reason.lower()

    def test_auto_select_pro_for_quality_keywords(self):
        """Test Pro model auto-selected for quality keywords."""
        quality_prompts = [
            "create a professional 4k image",
            "photorealistic detailed portrait",
            "premium commercial product photo"
        ]
        for prompt in quality_prompts:
            model, reason = select_model(prompt, ModelTier.AUTO)
            assert model == PRO_MODEL
            assert "auto-selected" in reason.lower()

    def test_auto_select_flash_for_speed_keywords(self):
        """Test Flash model auto-selected for speed keywords."""
        speed_prompts = [
            "quick sketch of a cat",
            "fast draft illustration",
            "simple concept art"
        ]
        for prompt in speed_prompts:
            model, reason = select_model(prompt, ModelTier.AUTO)
            assert model == FLASH_MODEL
            assert "auto-selected" in reason.lower()

    def test_auto_select_flash_default(self):
        """Test Flash model is default for general prompts."""
        model, reason = select_model("a cat sitting", ModelTier.AUTO)
        assert model == FLASH_MODEL
        assert "default" in reason.lower()


class TestSanitizeErrorResponse:
    """Tests for sanitize_error_response function."""

    def test_removes_api_keys_from_urls(self):
        """Test API keys are redacted from URLs."""
        error = "Error at https://api.example.com?key=AIzaSyABC123&param=value"
        result = sanitize_error_response(error)
        assert "AIzaSyABC123" not in result
        assert "key=REDACTED" in result
        assert "param=value" in result

    def test_truncates_long_errors(self):
        """Test long errors are truncated."""
        error = "x" * 1000
        result = sanitize_error_response(error, max_length=100)
        assert len(result) <= 110  # 100 + [TRUNCATED]
        assert "[TRUNCATED]" in result

    def test_handles_empty_string(self):
        """Test empty strings are handled."""
        result = sanitize_error_response("")
        assert result == ""


class TestValidateFileSize:
    """Tests for validate_file_size function."""

    def test_accepts_small_files(self):
        """Test small files are accepted."""
        # Should not raise
        validate_file_size(1024)  # 1KB
        validate_file_size(1024 * 1024)  # 1MB
        validate_file_size(10 * 1024 * 1024)  # 10MB

    def test_rejects_large_files(self):
        """Test files exceeding limit are rejected."""
        with pytest.raises(ValueError, match="File too large"):
            validate_file_size(MAX_FILE_SIZE + 1)

        with pytest.raises(ValueError, match="File too large"):
            validate_file_size(100 * 1024 * 1024)  # 100MB

    def test_accepts_at_limit(self):
        """Test file exactly at limit is accepted."""
        validate_file_size(MAX_FILE_SIZE)  # Should not raise
