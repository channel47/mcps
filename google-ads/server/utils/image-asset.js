/**
 * Image asset processing utility
 * Handles file path resolution, validation, and base64 encoding for ImageAsset uploads
 */

import { readFileSync, statSync, accessSync, constants } from 'fs';
import { resolve, extname, isAbsolute } from 'path';

// Google Ads API limits
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Supported image formats with their Google Ads MIME type enum values
const SUPPORTED_FORMATS = {
  '.jpg': 'IMAGE_JPEG',
  '.jpeg': 'IMAGE_JPEG',
  '.png': 'IMAGE_PNG'
};

// Magic bytes for image format validation
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47]
};

/**
 * Validate file path for security concerns
 * @param {string} filePath - Path to validate
 * @returns {{ valid: boolean, error?: string, resolvedPath?: string }}
 */
export function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'File path must be a non-empty string' };
  }

  // Require absolute paths to prevent ambiguity
  if (!isAbsolute(filePath)) {
    return {
      valid: false,
      error: `File path must be absolute. Received: "${filePath}"`
    };
  }

  // Resolve to canonical path (handles .. and symlinks)
  const resolvedPath = resolve(filePath);

  // Check for path traversal attempts (.. in original that resolves differently)
  if (resolvedPath !== filePath && filePath.includes('..')) {
    return {
      valid: false,
      error: 'Path traversal detected. Use canonical absolute paths.'
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * Validate image file exists, is readable, and meets size requirements
 * @param {string} filePath - Absolute path to image file
 * @returns {{ valid: boolean, error?: string, size?: number }}
 */
export function validateFileAccess(filePath) {
  try {
    // Check file exists and is readable
    accessSync(filePath, constants.R_OK);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { valid: false, error: `File not found: "${filePath}"` };
    }
    if (err.code === 'EACCES') {
      return { valid: false, error: `Permission denied: "${filePath}"` };
    }
    return { valid: false, error: `Cannot access file: ${err.message}` };
  }

  // Check file size
  try {
    const stats = statSync(filePath);

    if (!stats.isFile()) {
      return { valid: false, error: `Not a file: "${filePath}"` };
    }

    if (stats.size === 0) {
      return { valid: false, error: `File is empty: "${filePath}"` };
    }

    if (stats.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File size ${sizeMB}MB exceeds Google Ads limit of 5MB`
      };
    }

    return { valid: true, size: stats.size };
  } catch (err) {
    return { valid: false, error: `Cannot read file stats: ${err.message}` };
  }
}

/**
 * Detect MIME type from file extension and validate with magic bytes
 * @param {string} filePath - Path to image file
 * @param {Buffer} fileBuffer - File contents (first few bytes needed)
 * @returns {{ valid: boolean, mimeType?: string, error?: string }}
 */
export function detectAndValidateFormat(filePath, fileBuffer) {
  const ext = extname(filePath).toLowerCase();

  // Check extension is supported
  if (!SUPPORTED_FORMATS[ext]) {
    return {
      valid: false,
      error: `Unsupported image format: "${ext}". Supported: JPEG, PNG`
    };
  }

  // Validate magic bytes match extension
  const isJpeg = MAGIC_BYTES.jpeg.every((b, i) => fileBuffer[i] === b);
  const isPng = MAGIC_BYTES.png.every((b, i) => fileBuffer[i] === b);

  if ((ext === '.jpg' || ext === '.jpeg') && !isJpeg) {
    return {
      valid: false,
      error: `File "${filePath}" has .jpg extension but is not a valid JPEG`
    };
  }

  if (ext === '.png' && !isPng) {
    return {
      valid: false,
      error: `File "${filePath}" has .png extension but is not a valid PNG`
    };
  }

  // Determine actual format from magic bytes
  let mimeType;
  if (isJpeg) {
    mimeType = 'IMAGE_JPEG';
  } else if (isPng) {
    mimeType = 'IMAGE_PNG';
  } else {
    return {
      valid: false,
      error: `Could not detect image format for "${filePath}"`
    };
  }

  return { valid: true, mimeType };
}

/**
 * Process an image file path into base64-encoded image_asset data
 * @param {string} filePath - Absolute path to image file
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function processImageFile(filePath) {
  // Step 1: Validate path security
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid) {
    return { success: false, error: pathValidation.error };
  }

  // Step 2: Validate file access and size
  const accessValidation = validateFileAccess(pathValidation.resolvedPath);
  if (!accessValidation.valid) {
    return { success: false, error: accessValidation.error };
  }

  // Step 3: Read file
  let fileBuffer;
  try {
    fileBuffer = readFileSync(pathValidation.resolvedPath);
  } catch (err) {
    return { success: false, error: `Failed to read file: ${err.message}` };
  }

  // Step 4: Validate format
  const formatValidation = detectAndValidateFormat(
    pathValidation.resolvedPath,
    fileBuffer
  );
  if (!formatValidation.valid) {
    return { success: false, error: formatValidation.error };
  }

  // Step 5: Encode to base64
  // CRITICAL: Opteo library requires base64 string, NOT Buffer
  const base64Data = fileBuffer.toString('base64');

  return {
    success: true,
    data: {
      data: base64Data,
      file_size: accessValidation.size,
      mime_type: formatValidation.mimeType
    }
  };
}

/**
 * Transform a resource object by processing image_file_path if present
 * @param {Object} resource - Resource object that may contain image_file_path
 * @returns {{ resource: Object, processed: boolean, error?: string }}
 */
export function transformImageAssetResource(resource) {
  if (!resource || typeof resource !== 'object') {
    return { resource, processed: false };
  }

  // Check if this is an asset with image_file_path
  if (!resource.image_file_path) {
    return { resource, processed: false };
  }

  // Validate this is an IMAGE type asset (or infer it)
  if (resource.type && resource.type !== 'IMAGE') {
    return {
      resource,
      processed: false,
      error: `image_file_path is only valid for IMAGE assets, got type: ${resource.type}`
    };
  }

  // Process the image file
  const result = processImageFile(resource.image_file_path);
  if (!result.success) {
    return { resource, processed: false, error: result.error };
  }

  // Build the transformed resource (remove image_file_path, add image_asset)
  const { image_file_path, ...restResource } = resource;

  return {
    resource: {
      ...restResource,
      type: 'IMAGE',  // Ensure type is set
      image_asset: result.data
    },
    processed: true
  };
}

// Export constants for testing
export { MAX_FILE_SIZE_BYTES, SUPPORTED_FORMATS, MAGIC_BYTES };
