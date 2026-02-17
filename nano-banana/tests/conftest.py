"""Pytest configuration and fixtures for nano-banana-mcp tests."""

import pytest


@pytest.fixture
def mock_api_key(monkeypatch):
    """Mock GEMINI_API_KEY environment variable."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key-abc123")
    return "test-api-key-abc123"


@pytest.fixture
def mock_no_api_key(monkeypatch):
    """Remove GEMINI_API_KEY from environment."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


@pytest.fixture
def sample_image_bytes():
    """Sample PNG image bytes for testing."""
    # Minimal valid PNG header
    return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
