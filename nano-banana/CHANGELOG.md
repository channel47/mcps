# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-10

### Added
- Initial standalone release as `gemini-image-mcp`
- Dual model support: Flash (fast, 1024px) and Pro (4K quality)
- Smart model selection based on prompt keywords
- Aspect ratio control (1:1, 16:9, 9:16, 21:9, 4:3, 3:4, 2:1)
- Google Search grounding for factually accurate images (Pro only)
- File management via Gemini Files API (upload, list, delete)
- Reproducible generation with seed support
- Safety level configuration

### Notes
- Published to PyPI as `gemini-image-mcp` (internal codename: Nano Banana)
- Migrated from channel47 monorepo to standalone repository
- Previously developed as part of the creative-designer plugin
