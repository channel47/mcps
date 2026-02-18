# gemini-image-mcp

[![PyPI version](https://badge.fury.io/py/gemini-image-mcp.svg)](https://pypi.org/project/gemini-image-mcp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for AI image generation using Google Gemini models. Free API key, dual-model support, aspect ratio control.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

> Also known as "Nano Banana" — the friendly name for this image generation server.

## What It Does

- **Dual model support** — Flash (2-3s, 1024px) and Pro (4K quality)
- **Smart model selection** — auto-selects based on prompt keywords
- **Aspect ratio control** — 1:1, 16:9, 9:16, 21:9, 4:3, 3:4, 2:1
- **Google Search grounding** — factually accurate images (Pro only)
- **File management** — upload, list, and delete files via Gemini Files API
- **Reproducible generation** — seed support for consistent results

## Installation

### Via uvx (recommended)

```bash
uvx gemini-image-mcp
```

### Via pip

```bash
pip install gemini-image-mcp
```

### Via pipx

```bash
pipx install gemini-image-mcp
```

## Configuration

Get your free API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
export GEMINI_API_KEY="your-api-key-here"
```

### Claude Code Integration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "uvx",
      "args": ["gemini-image-mcp"]
    }
  }
}
```

## Tools

### generate_image

Generate images with automatic model selection.

**Parameters:**
- `prompt` (required): Image description
- `model_tier`: `flash`, `pro`, or `auto` (default: auto)
- `aspect_ratio`: `1:1`, `16:9`, `9:16`, etc. (default: 1:1)
- `thinking_level`: `LOW` or `HIGH` (Pro only)
- `use_grounding`: Enable Google Search grounding (Pro only)
- `safety_level`: `STRICT`, `MODERATE`, `PERMISSIVE`, `OFF`
- `seed`: Integer for reproducible results
- `output_path`: File path to save image

### list_files

List uploaded files.

### upload_file

Upload a file for use as reference.

### delete_file

Delete an uploaded file.

## Model Selection

**Pro** auto-selects for: professional, 4k, high quality, detailed, photorealistic, ultra, premium, studio, commercial, product photo

**Flash** auto-selects for: quick, fast, sketch, draft, concept, rough, preview, test, iterate, simple, basic

## Development

```bash
git clone https://github.com/channel47/mcps.git
cd mcps/nano-banana
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"

pytest tests/ -v
ruff format src/ tests/
ruff check src/ tests/
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [PyPI Package](https://pypi.org/project/gemini-image-mcp/)
- [GitHub Repository](https://github.com/channel47/mcps/tree/main/nano-banana)
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
