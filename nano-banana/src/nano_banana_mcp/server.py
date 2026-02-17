# File: server.py
# What: Nano Banana Pro MCP server for AI-powered image generation.
# Why: Provides Claude Code with access to Google's Gemini 3 Pro Image and
#      Gemini 2.5 Flash Image models for professional-grade image generation.

"""
Nano Banana Pro MCP Server

A comprehensive MCP server for AI-powered image generation using Google's
Nano Banana Pro (Gemini 3 Pro Image) and Nano Banana (Gemini 2.5 Flash Image) models.

This server provides tools for:
- Multi-model image generation (Flash for speed, Pro for 4K quality)
- Smart model selection based on prompt analysis
- Aspect ratio control for various use cases
- Google Search grounding for factual accuracy
- Advanced reasoning with configurable thinking levels
- File upload and management via Gemini Files API

Authentication: GEMINI_API_KEY environment variable
Access Level: Read-write for image generation and file management
"""

import base64
import io
import json
import os
import re
from enum import Enum
from pathlib import Path
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

# Module-level constants
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# File upload limits
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# Thinking budget levels for Pro model
THINKING_BUDGET_LOW = 1024
THINKING_BUDGET_HIGH = 8192

# Model configurations
FLASH_MODEL = "gemini-2.5-flash-image"
PRO_MODEL = "gemini-3-pro-image-preview"  # Supports 4K and advanced reasoning

# Keywords for smart model selection
QUALITY_KEYWORDS = [
    "professional", "4k", "high quality", "detailed", "photorealistic",
    "ultra", "premium", "studio", "commercial", "product photo",
    "portfolio", "print", "publication", "magazine", "advertisement"
]
SPEED_KEYWORDS = [
    "quick", "fast", "sketch", "draft", "concept", "rough",
    "preview", "test", "iterate", "simple", "basic"
]

# Initialize FastMCP server
mcp = FastMCP("nano_banana_mcp")


# ============================================================================
# ENUMS AND MODELS
# ============================================================================

class ModelTier(str, Enum):
    """Model tier selection."""
    FLASH = "flash"
    PRO = "pro"
    AUTO = "auto"


class AspectRatio(str, Enum):
    """Supported aspect ratios for image generation."""
    SQUARE = "1:1"
    LANDSCAPE = "16:9"
    PORTRAIT = "9:16"
    CINEMATIC = "21:9"
    CLASSIC = "4:3"
    VERTICAL = "3:4"
    PORTRAIT_PHOTO = "2:3"
    LANDSCAPE_PHOTO = "3:2"
    PORTRAIT_SOCIAL = "4:5"
    LANDSCAPE_SOCIAL = "5:4"


class ThinkingLevel(str, Enum):
    """Reasoning depth for image generation."""
    LOW = "LOW"
    HIGH = "HIGH"


class SafetyLevel(str, Enum):
    """Content safety filtering levels."""
    STRICT = "STRICT"  # BLOCK_LOW_AND_ABOVE - Strictest filtering
    MODERATE = "MODERATE"  # BLOCK_MEDIUM_AND_ABOVE - Balanced filtering
    PERMISSIVE = "PERMISSIVE"  # BLOCK_ONLY_HIGH - Minimal filtering
    OFF = "OFF"  # BLOCK_NONE - No filtering (may be overridden by API)


class TargetDimensions(BaseModel):
    """Target dimensions for image resizing."""
    width: int = Field(..., ge=1, le=8192, description="Target width in pixels")
    height: int = Field(..., ge=1, le=8192, description="Target height in pixels")


class GenerateImageInput(BaseModel):
    """Input for image generation."""
    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    prompt: str = Field(
        ...,
        description="Detailed description of the image to generate. Be specific about style, composition, lighting, and subject matter.",
        min_length=1,
        max_length=5000
    )
    model_tier: ModelTier = Field(
        default=ModelTier.AUTO,
        description="Model selection: 'flash' for speed (2-3s, 1024px), 'pro' for quality (4K), 'auto' for smart selection"
    )
    aspect_ratio: AspectRatio = Field(
        default=AspectRatio.SQUARE,
        description="Image aspect ratio: '1:1' (square), '16:9' (landscape), '9:16' (portrait), '21:9' (cinematic), '4:3' (classic), '3:4' (vertical), '2:3' (portrait photo), '3:2' (landscape photo), '4:5' (portrait social), '5:4' (landscape social)"
    )
    thinking_level: Optional[ThinkingLevel] = Field(
        default=None,
        description="Reasoning depth for Pro model: 'LOW' for faster, 'HIGH' for more thoughtful generation"
    )
    use_grounding: bool = Field(
        default=False,
        description="Enable Google Search grounding for factually accurate images (Pro model only)"
    )
    reference_file_uri: Optional[str] = Field(
        default=None,
        description="URI of an uploaded file (from upload_file) to use as reference/context"
    )
    reference_file_mime_type: Optional[str] = Field(
        default=None,
        description="MIME type of the reference file (e.g., 'image/png'). Defaults to 'image/png' if not specified."
    )
    reference_image_base64: Optional[str] = Field(
        default=None,
        description="Base64 encoded image data to use as reference. Provide this OR reference_file_uri, not both."
    )
    number_of_images: int = Field(
        default=1,
        description="Number of images to generate. Note: Currently limited to 1 by Gemini API. Multiple image generation is not yet supported by gemini-2.5-flash-image or gemini-3-pro-image-preview models.",
        ge=1,
        le=1  # API limitation - only 1 supported currently
    )
    safety_level: SafetyLevel = Field(
        default=SafetyLevel.STRICT,
        description="Content safety filtering level: 'STRICT' (default, blocks most), 'MODERATE' (balanced), 'PERMISSIVE' (minimal), 'OFF' (none)"
    )
    seed: Optional[int] = Field(
        default=None,
        description="Seed for reproducible generation. Use the same seed with the same prompt for consistent results."
    )
    output_path: Optional[str] = Field(
        default=None,
        description="Optional file path to save the generated image. If not provided, returns base64 data."
    )
    target_dimensions: Optional[TargetDimensions] = Field(
        default=None,
        description="Optional target dimensions (width, height) to resize the output image."
    )


class ListFilesInput(BaseModel):
    """Input for listing uploaded files."""
    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    limit: int = Field(
        default=20,
        description="Maximum number of files to return",
        ge=1,
        le=100
    )


class UploadFileInput(BaseModel):
    """Input for uploading a file."""
    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    file_path: str = Field(
        ...,
        description="Path to the file to upload"
    )
    display_name: Optional[str] = Field(
        default=None,
        description="Optional display name for the file"
    )


class DeleteFileInput(BaseModel):
    """Input for deleting a file."""
    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    file_name: str = Field(
        ...,
        description="Name of the file to delete (from list_files output)"
    )


# ============================================================================
# SHARED UTILITIES
# ============================================================================

def get_api_key() -> str:
    """Get Gemini API key from environment."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "Missing GEMINI_API_KEY environment variable.\n"
            "Get your free API key from: https://aistudio.google.com/apikey\n"
            "Then add to ~/.claude/settings.json:\n"
            '  "env": { "GEMINI_API_KEY": "your-key-here" }'
        )
    return api_key


def sanitize_error_response(error_text: str, max_length: int = 500) -> str:
    """
    Sanitize error responses to prevent API key leakage.

    Args:
        error_text: Raw error text from API
        max_length: Maximum length to return (default 500)

    Returns:
        Sanitized and truncated error text
    """
    if not error_text:
        return ""

    # Remove API keys from URLs (matches key=... patterns, case-insensitive)
    sanitized = re.sub(r'key=[^&\s]+', 'key=REDACTED', error_text, flags=re.IGNORECASE)

    # Truncate to max length
    if len(sanitized) > max_length:
        truncation_marker = "\n[TRUNCATED]"
        sanitized = sanitized[:max_length - len(truncation_marker)] + truncation_marker

    return sanitized


def validate_file_size(file_size: int, max_size: int = MAX_FILE_SIZE) -> None:
    """
    Validate file size is within limits.

    Args:
        file_size: Size in bytes
        max_size: Maximum allowed size (default: MAX_FILE_SIZE)

    Raises:
        ValueError: If file exceeds size limit or is negative
    """
    if file_size < 0:
        raise ValueError("Invalid file size: cannot be negative")

    if file_size > max_size:
        raise ValueError(
            f"File too large: {file_size:,} bytes "
            f"(maximum: {max_size:,} bytes / {max_size // (1024*1024)}MB)"
        )


def select_model(prompt: str, requested_tier: ModelTier) -> tuple[str, str]:
    """
    Select appropriate model based on prompt analysis and user preference.

    Returns:
        Tuple of (model_name, selection_reason)
    """
    if requested_tier == ModelTier.PRO:
        return PRO_MODEL, "Pro model selected (user requested)"

    if requested_tier == ModelTier.FLASH:
        return FLASH_MODEL, "Flash model selected (user requested)"

    # Auto-select based on prompt analysis
    prompt_lower = prompt.lower()

    # Check for quality indicators
    for keyword in QUALITY_KEYWORDS:
        if keyword in prompt_lower:
            return PRO_MODEL, f"Pro model auto-selected (detected quality keyword: '{keyword}')"

    # Check for speed indicators
    for keyword in SPEED_KEYWORDS:
        if keyword in prompt_lower:
            return FLASH_MODEL, f"Flash model auto-selected (detected speed keyword: '{keyword}')"

    # Default to Flash for general use (faster)
    return FLASH_MODEL, "Flash model auto-selected (default for general prompts)"


def get_safety_settings(safety_level: SafetyLevel) -> list[dict]:
    """
    Map SafetyLevel enum to Gemini API safety settings format.

    Args:
        safety_level: Desired safety filtering level

    Returns:
        List of safety setting dictionaries for API request
    """
    # Map SafetyLevel to API threshold values
    threshold_map = {
        SafetyLevel.STRICT: "BLOCK_LOW_AND_ABOVE",
        SafetyLevel.MODERATE: "BLOCK_MEDIUM_AND_ABOVE",
        SafetyLevel.PERMISSIVE: "BLOCK_ONLY_HIGH",
        SafetyLevel.OFF: "BLOCK_NONE"
    }

    threshold = threshold_map[safety_level]

    # Apply threshold to all harm categories
    harm_categories = [
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT"
    ]

    return [
        {"category": category, "threshold": threshold}
        for category in harm_categories
    ]


def get_extension_from_mime_type(mime_type: str) -> str:
    """
    Get file extension from MIME type.

    Args:
        mime_type: MIME type string (e.g., "image/jpeg")

    Returns:
        File extension with leading dot (e.g., ".jpg")
    """
    mime_to_ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }
    return mime_to_ext.get(mime_type, ".png")


def save_image(image_data: bytes, output_path: str, mime_type: str = "image/png") -> str:
    """
    Save image data to file with path validation.

    Args:
        image_data: Image bytes to save
        output_path: Destination path (must be within home or cwd)
        mime_type: MIME type of the image data (used for extension if not provided)

    Returns:
        Absolute path to saved file

    Raises:
        ValueError: If path is invalid or attempts traversal
    """
    # First expand user paths
    path = Path(output_path).expanduser()

    # Add extension if missing BEFORE security validation
    if not path.suffix:
        path = path.with_suffix(get_extension_from_mime_type(mime_type))

    # NOW resolve to absolute path for security check
    path = path.resolve()

    # Validate path is within safe directories
    safe_dirs = [Path.home(), Path.cwd()]
    is_safe = False

    for safe_dir in safe_dirs:
        try:
            # Check if path is relative to safe directory
            path.relative_to(safe_dir)
            is_safe = True
            break
        except ValueError:
            # Not relative to this safe directory, try next
            continue

    if not is_safe:
        raise ValueError(
            "Invalid output path: must be within home directory or current working directory"
        )

    # Create parent directories if needed
    path.parent.mkdir(parents=True, exist_ok=True)

    # Write image data (extension already added above)
    path.write_bytes(image_data)
    return str(path)


def resize_image(
    image_data: bytes,
    target_width: int,
    target_height: int,
    mime_type: str = "image/png"
) -> bytes:
    """
    Resize image data to target dimensions.

    Args:
        image_data: Original image bytes
        target_width: Target width in pixels
        target_height: Target height in pixels
        mime_type: MIME type of the image (for format preservation)

    Returns:
        Resized image as bytes
    """
    img = Image.open(io.BytesIO(image_data))
    resized_img = img.resize((target_width, target_height), resample=Image.Resampling.LANCZOS)

    # Determine output format from MIME type
    format_map = {
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/gif": "GIF",
        "image/webp": "WEBP",
    }
    output_format = format_map.get(mime_type, "PNG")

    # Save to bytes buffer
    output_buffer = io.BytesIO()
    # Handle RGBA to RGB conversion for JPEG
    if output_format == "JPEG" and resized_img.mode in ("RGBA", "LA", "P"):
        resized_img = resized_img.convert("RGB")
    resized_img.save(output_buffer, format=output_format)
    return output_buffer.getvalue()


# ============================================================================
# TOOL IMPLEMENTATIONS
# ============================================================================

@mcp.tool(
    name="generate_image",
    annotations={
        "title": "Generate Image with Nano Banana Pro",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True
    }
)
async def generate_image(params: GenerateImageInput) -> str:
    """
    Generate an image using Nano Banana Pro (Gemini 3 Pro Image).

    Supports multiple models:
    - Flash: Fast generation (2-3 seconds), up to 1024px resolution
    - Pro: High quality generation, up to 4K resolution with advanced features

    Features:
    - Smart model selection based on prompt analysis
    - Multiple aspect ratios for different use cases
    - Google Search grounding for factual accuracy (Pro only)
    - Configurable thinking levels for generation quality
    """
    try:
        api_key = get_api_key()

        # Select model
        model, selection_reason = select_model(params.prompt, params.model_tier)

        # Build generation config
        generation_config = {
            "responseModalities": ["TEXT", "IMAGE"],
            "candidateCount": params.number_of_images,
            "imageConfig": {
                "aspectRatio": params.aspect_ratio.value
            }
        }

        # Add seed if specified for reproducible generation
        if params.seed is not None:
            generation_config["seed"] = params.seed

        # Add thinking config if specified
        if params.thinking_level:
            thinking_budget = THINKING_BUDGET_HIGH if params.thinking_level == ThinkingLevel.HIGH else THINKING_BUDGET_LOW
            generation_config["thinkingConfig"] = {
                "thinkingBudget": thinking_budget
            }

        # Build request body
        parts = []

        # Add reference image if provided
        if params.reference_file_uri:
            parts.append({
                "fileData": {
                    "fileUri": params.reference_file_uri,
                    "mimeType": params.reference_file_mime_type or "image/png"
                }
            })
        elif params.reference_image_base64:
             parts.append({
                "inlineData": {
                    "mimeType": params.reference_file_mime_type or "image/png",
                    "data": params.reference_image_base64
                }
            })

        # Add text prompt
        parts.append({"text": params.prompt})

        request_body = {
            "contents": [{
                "parts": parts
            }],
            "generationConfig": generation_config,
            "safetySettings": get_safety_settings(params.safety_level)
        }

        # Add grounding if requested
        if params.use_grounding:
            request_body["tools"] = [{
                "googleSearch": {}
            }]

        # Make API request
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{GEMINI_API_BASE}/models/{model}:generateContent",
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
                json=request_body
            )

            if response.status_code != 200:
                error_detail = sanitize_error_response(response.text)
                return json.dumps({
                    "success": False,
                    "error": f"API request failed with status {response.status_code}",
                    "details": error_detail,
                    "model_used": model,
                    "selection_reason": selection_reason
                }, indent=2)

            result = response.json()

        # Extract images from response (handle multiple candidates)
        candidates = result.get("candidates", [])
        if not candidates:
            return json.dumps({
                "success": False,
                "error": "No candidates returned from API",
                "model_used": model,
                "selection_reason": selection_reason
            }, indent=2)

        # Process all candidates to collect images
        outputs = []
        text_responses = []

        for candidate_idx, candidate in enumerate(candidates):
            content = candidate.get("content", {})
            parts = content.get("parts", [])

            image_data = None
            text_response = None

            for part in parts:
                if "inlineData" in part:
                    image_data = part["inlineData"]
                elif "text" in part:
                    text_response = part["text"]

            # Collect text responses
            if text_response:
                text_responses.append(text_response)

            # Skip if no image data in this candidate
            if not image_data:
                continue

            # Handle output for this image
            mime_type = image_data.get("mimeType", "image/png")
            base64_data = image_data.get("data", "")

            if params.output_path:
                # Save to file with index if multiple images
                image_bytes = base64.b64decode(base64_data)

                # Apply resize if target dimensions specified
                if params.target_dimensions:
                    image_bytes = resize_image(
                        image_bytes,
                        params.target_dimensions.width,
                        params.target_dimensions.height,
                        mime_type
                    )

                # Generate indexed filename for multiple images
                if len(candidates) > 1:
                    # Insert index before extension
                    output_path = Path(params.output_path)
                    stem = output_path.stem
                    suffix = output_path.suffix or get_extension_from_mime_type(mime_type)
                    parent = output_path.parent
                    indexed_filename = f"{stem}_{candidate_idx + 1}{suffix}"
                    indexed_path = str(parent / indexed_filename) if str(parent) != '.' else indexed_filename
                else:
                    indexed_path = params.output_path

                saved_path = save_image(image_bytes, indexed_path, mime_type)
                outputs.append({
                    "index": candidate_idx + 1,
                    "saved_to": saved_path,
                    "file_size_bytes": len(image_bytes)
                })
            else:
                # Return base64 data (truncated for display)
                outputs.append({
                    "index": candidate_idx + 1,
                    "mime_type": mime_type,
                    "base64_preview": base64_data[:100] + "..." if len(base64_data) > 100 else base64_data,
                    "data_length": len(base64_data),
                    "note": "Full base64 data available. Specify output_path to save to file."
                })

        # Check if we got any images
        if not outputs:
            return json.dumps({
                "success": False,
                "error": "No image data found in any candidates",
                "text_responses": text_responses,
                "model_used": model,
                "selection_reason": selection_reason
            }, indent=2)

        return json.dumps({
            "success": True,
            "model_used": model,
            "selection_reason": selection_reason,
            "prompt": params.prompt,
            "aspect_ratio": params.aspect_ratio.value,
            "number_of_images": params.number_of_images,
            "images_generated": len(outputs),
            "safety_level": params.safety_level.value,
            "seed": params.seed,
            "thinking_level": params.thinking_level.value if params.thinking_level else None,
            "grounding_enabled": params.use_grounding,
            "text_responses": text_responses if text_responses else None,
            "outputs": outputs
        }, indent=2)

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": sanitize_error_response(str(e)),
            "error_type": type(e).__name__
        }, indent=2)


@mcp.tool(
    name="list_files",
    annotations={
        "title": "List Uploaded Files",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def list_files(params: ListFilesInput) -> str:
    """
    List files uploaded to the Gemini Files API.

    Returns file metadata including name, display name, size, and upload time.
    """
    try:
        api_key = get_api_key()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{GEMINI_API_BASE}/files",
                params={
                    "key": api_key,
                    "pageSize": params.limit
                }
            )

            if response.status_code != 200:
                return json.dumps({
                    "success": False,
                    "error": f"API request failed with status {response.status_code}",
                    "details": sanitize_error_response(response.text)
                }, indent=2)

            result = response.json()

        files = result.get("files", [])

        if not files:
            return json.dumps({
                "success": True,
                "message": "No files found",
                "files": []
            }, indent=2)

        # Format file list
        formatted_files = []
        for f in files:
            formatted_files.append({
                "name": f.get("name", ""),
                "display_name": f.get("displayName", ""),
                "mime_type": f.get("mimeType", ""),
                "size_bytes": f.get("sizeBytes", 0),
                "create_time": f.get("createTime", ""),
                "state": f.get("state", "")
            })

        return json.dumps({
            "success": True,
            "total_files": len(formatted_files),
            "files": formatted_files
        }, indent=2)

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": sanitize_error_response(str(e)),
            "error_type": type(e).__name__
        }, indent=2)


@mcp.tool(
    name="upload_file",
    annotations={
        "title": "Upload File to Gemini",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True
    }
)
async def upload_file(params: UploadFileInput) -> str:
    """
    Upload a file to the Gemini Files API for use in image generation.

    Supports images, videos, and other media files.
    Uploaded files can be referenced in subsequent generation requests.
    """
    try:
        api_key = get_api_key()

        # Read file
        file_path = Path(params.file_path).expanduser().resolve()
        if not file_path.exists():
            return json.dumps({
                "success": False,
                "error": f"File not found: {file_path}"
            }, indent=2)

        # Get file size WITHOUT reading entire file into memory
        file_size = file_path.stat().st_size

        # Validate file size BEFORE loading into memory
        try:
            validate_file_size(file_size)
        except ValueError as e:
            return json.dumps({
                "success": False,
                "error": str(e)
            }, indent=2)

        # NOW read file data (only after validation passes)
        file_data = file_path.read_bytes()

        # Determine MIME type
        mime_types = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".pdf": "application/pdf"
        }
        mime_type = mime_types.get(file_path.suffix.lower(), "application/octet-stream")

        display_name = params.display_name or file_path.name

        # Upload file using resumable upload
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Start resumable upload
            start_response = await client.post(
                f"https://generativelanguage.googleapis.com/upload/v1beta/files",
                params={"key": api_key},
                headers={
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": str(file_size),
                    "X-Goog-Upload-Header-Content-Type": mime_type,
                    "Content-Type": "application/json"
                },
                json={"file": {"displayName": display_name}}
            )

            if start_response.status_code != 200:
                return json.dumps({
                    "success": False,
                    "error": f"Failed to start upload: {start_response.status_code}",
                    "details": sanitize_error_response(start_response.text)
                }, indent=2)

            upload_url = start_response.headers.get("X-Goog-Upload-URL")
            if not upload_url:
                return json.dumps({
                    "success": False,
                    "error": "No upload URL returned"
                }, indent=2)

            # Upload file data
            upload_response = await client.post(
                upload_url,
                headers={
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize",
                    "Content-Type": mime_type
                },
                content=file_data
            )

            if upload_response.status_code != 200:
                return json.dumps({
                    "success": False,
                    "error": f"Failed to upload file: {upload_response.status_code}",
                    "details": sanitize_error_response(upload_response.text)
                }, indent=2)

            result = upload_response.json()

        file_info = result.get("file", {})

        return json.dumps({
            "success": True,
            "file": {
                "name": file_info.get("name", ""),
                "display_name": file_info.get("displayName", ""),
                "mime_type": file_info.get("mimeType", ""),
                "size_bytes": file_info.get("sizeBytes", file_size),
                "uri": file_info.get("uri", ""),
                "state": file_info.get("state", "")
            },
            "message": "File uploaded successfully. Use the 'name' or 'uri' in generation requests."
        }, indent=2)

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": sanitize_error_response(str(e)),
            "error_type": type(e).__name__
        }, indent=2)


@mcp.tool(
    name="delete_file",
    annotations={
        "title": "Delete Uploaded File",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def delete_file(params: DeleteFileInput) -> str:
    """
    Delete a file from the Gemini Files API.

    Use list_files to get the file name to delete.
    """
    try:
        api_key = get_api_key()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{GEMINI_API_BASE}/{params.file_name}",
                params={"key": api_key}
            )

            if response.status_code == 200:
                return json.dumps({
                    "success": True,
                    "message": f"File '{params.file_name}' deleted successfully"
                }, indent=2)
            elif response.status_code == 404:
                return json.dumps({
                    "success": False,
                    "error": f"File not found: {params.file_name}"
                }, indent=2)
            else:
                return json.dumps({
                    "success": False,
                    "error": f"Delete failed with status {response.status_code}",
                    "details": sanitize_error_response(response.text)
                }, indent=2)

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": sanitize_error_response(str(e)),
            "error_type": type(e).__name__
        }, indent=2)


# ============================================================================
# SERVER INITIALIZATION
# ============================================================================

def main():
    """Entry point for the MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()
