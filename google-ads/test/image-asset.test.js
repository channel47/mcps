/**
 * Unit tests for image asset processing
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validateFilePath,
  validateFileAccess,
  detectAndValidateFormat,
  processImageFile,
  transformImageAssetResource,
  MAX_FILE_SIZE_BYTES
} from '../server/utils/image-asset.js';

// Test fixtures directory
const TEST_DIR = join(tmpdir(), 'google-ads-mcp-test-images-' + Date.now());

// Minimal valid JPEG (1x1 red pixel) - smallest valid JPEG file
const VALID_JPEG_BYTES = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
  0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
  0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
  0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
  0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
  0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
  0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
  0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
  0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
  0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xA3,
  0xFF, 0xD9
]);

// Minimal valid PNG (1x1 red pixel)
const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

// Invalid file (text content with wrong extension)
const INVALID_IMAGE_BYTES = Buffer.from('This is not an image file');

// ============================================
// Setup and teardown
// ============================================

function setupTestDir() {
  try {
    mkdirSync(TEST_DIR, { recursive: true });
  } catch (err) {
    // Directory may already exist
  }
}

function cleanupTestDir() {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup errors
  }
}

// ============================================
// validateFilePath tests
// ============================================

describe('validateFilePath', () => {

  test('rejects empty path', () => {
    const result = validateFilePath('');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('non-empty string'));
  });

  test('rejects null path', () => {
    const result = validateFilePath(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('non-empty string'));
  });

  test('rejects undefined path', () => {
    const result = validateFilePath(undefined);
    assert.strictEqual(result.valid, false);
  });

  test('rejects relative paths', () => {
    const result = validateFilePath('images/photo.jpg');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('absolute'));
  });

  test('rejects dot-relative paths', () => {
    const result = validateFilePath('./images/photo.jpg');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('absolute'));
  });

  test('accepts valid absolute path (Unix)', () => {
    const result = validateFilePath('/Users/test/image.png');
    assert.strictEqual(result.valid, true);
    assert.ok(result.resolvedPath);
  });

  test('detects path traversal with ..', () => {
    const result = validateFilePath('/Users/test/../../../etc/passwd');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('traversal'));
  });

  test('accepts path without traversal', () => {
    const result = validateFilePath('/Users/test/images/photo.png');
    assert.strictEqual(result.valid, true);
  });
});

// ============================================
// validateFileAccess tests
// ============================================

describe('validateFileAccess', () => {

  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  test('rejects non-existent file', () => {
    const result = validateFileAccess('/nonexistent/path/to/file.jpg');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not found'));
  });

  test('rejects empty file', () => {
    const testFile = join(TEST_DIR, 'empty.jpg');
    writeFileSync(testFile, Buffer.alloc(0));

    const result = validateFileAccess(testFile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('empty'));
  });

  test('accepts valid file with correct size', () => {
    const testFile = join(TEST_DIR, 'valid.jpg');
    writeFileSync(testFile, VALID_JPEG_BYTES);

    const result = validateFileAccess(testFile);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.size, VALID_JPEG_BYTES.length);
  });

  test('rejects file exceeding 5MB', () => {
    const testFile = join(TEST_DIR, 'large.jpg');
    // Create 6MB file
    writeFileSync(testFile, Buffer.alloc(6 * 1024 * 1024));

    const result = validateFileAccess(testFile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('5MB'));
  });

  test('rejects directory', () => {
    const result = validateFileAccess(TEST_DIR);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Not a file'));
  });
});

// ============================================
// detectAndValidateFormat tests
// ============================================

describe('detectAndValidateFormat', () => {

  test('detects JPEG from magic bytes with .jpg extension', () => {
    const result = detectAndValidateFormat('/test.jpg', VALID_JPEG_BYTES);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.mimeType, 'IMAGE_JPEG');
  });

  test('detects JPEG from magic bytes with .jpeg extension', () => {
    const result = detectAndValidateFormat('/test.jpeg', VALID_JPEG_BYTES);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.mimeType, 'IMAGE_JPEG');
  });

  test('detects PNG from magic bytes', () => {
    const result = detectAndValidateFormat('/test.png', VALID_PNG_BYTES);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.mimeType, 'IMAGE_PNG');
  });

  test('rejects unsupported extension .gif', () => {
    const result = detectAndValidateFormat('/test.gif', Buffer.alloc(10));
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Unsupported'));
    assert.ok(result.error.includes('.gif'));
  });

  test('rejects unsupported extension .webp', () => {
    const result = detectAndValidateFormat('/test.webp', Buffer.alloc(10));
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Unsupported'));
  });

  test('rejects mismatched .jpg extension with PNG magic bytes', () => {
    const result = detectAndValidateFormat('/test.jpg', VALID_PNG_BYTES);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not a valid JPEG'));
  });

  test('rejects mismatched .png extension with JPEG magic bytes', () => {
    const result = detectAndValidateFormat('/test.png', VALID_JPEG_BYTES);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not a valid PNG'));
  });

  test('rejects .jpg with invalid content', () => {
    const result = detectAndValidateFormat('/test.jpg', INVALID_IMAGE_BYTES);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('not a valid JPEG'));
  });

  test('handles uppercase extensions', () => {
    const result = detectAndValidateFormat('/test.JPG', VALID_JPEG_BYTES);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.mimeType, 'IMAGE_JPEG');
  });

  test('handles mixed case extensions', () => {
    const result = detectAndValidateFormat('/test.Png', VALID_PNG_BYTES);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.mimeType, 'IMAGE_PNG');
  });
});

// ============================================
// processImageFile tests
// ============================================

describe('processImageFile', () => {

  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  test('processes valid JPEG file', () => {
    const testFile = join(TEST_DIR, 'test.jpg');
    writeFileSync(testFile, VALID_JPEG_BYTES);

    const result = processImageFile(testFile);

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.mime_type, 'IMAGE_JPEG');
    assert.strictEqual(result.data.file_size, VALID_JPEG_BYTES.length);
    // Verify base64 encoding is correct
    assert.strictEqual(
      Buffer.from(result.data.data, 'base64').toString('base64'),
      result.data.data
    );
  });

  test('processes valid PNG file', () => {
    const testFile = join(TEST_DIR, 'test.png');
    writeFileSync(testFile, VALID_PNG_BYTES);

    const result = processImageFile(testFile);

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.mime_type, 'IMAGE_PNG');
    assert.strictEqual(result.data.file_size, VALID_PNG_BYTES.length);
  });

  test('returns base64 string (not Buffer)', () => {
    const testFile = join(TEST_DIR, 'test.png');
    writeFileSync(testFile, VALID_PNG_BYTES);

    const result = processImageFile(testFile);

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.data.data, 'string');
    // Verify it decodes correctly
    const decoded = Buffer.from(result.data.data, 'base64');
    assert.deepStrictEqual(decoded, VALID_PNG_BYTES);
  });

  test('fails for relative path', () => {
    const result = processImageFile('relative/path.jpg');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('absolute'));
  });

  test('fails for non-existent file', () => {
    const result = processImageFile('/nonexistent/image.png');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found'));
  });

  test('fails for invalid image format', () => {
    const testFile = join(TEST_DIR, 'fake.jpg');
    writeFileSync(testFile, INVALID_IMAGE_BYTES);

    const result = processImageFile(testFile);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not a valid JPEG'));
  });

  test('fails for oversized file', () => {
    const testFile = join(TEST_DIR, 'large.png');
    // Create file just over 5MB
    const largeData = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
    // Add PNG magic bytes so it passes format check
    VALID_PNG_BYTES.copy(largeData, 0);
    writeFileSync(testFile, largeData);

    const result = processImageFile(testFile);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('5MB'));
  });
});

// ============================================
// transformImageAssetResource tests
// ============================================

describe('transformImageAssetResource', () => {

  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  test('passes through resource without image_file_path', () => {
    const resource = { name: 'Test', type: 'TEXT' };
    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, false);
    assert.deepStrictEqual(result.resource, resource);
    assert.strictEqual(result.error, undefined);
  });

  test('passes through null resource', () => {
    const result = transformImageAssetResource(null);
    assert.strictEqual(result.processed, false);
    assert.strictEqual(result.resource, null);
  });

  test('passes through non-object resource', () => {
    const result = transformImageAssetResource('string');
    assert.strictEqual(result.processed, false);
  });

  test('transforms resource with valid image_file_path', () => {
    const testFile = join(TEST_DIR, 'test.png');
    writeFileSync(testFile, VALID_PNG_BYTES);

    const resource = {
      name: 'Test Image',
      image_file_path: testFile
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, true);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.resource.name, 'Test Image');
    assert.strictEqual(result.resource.type, 'IMAGE');
    assert.ok(result.resource.image_asset);
    assert.ok(result.resource.image_asset.data);
    assert.strictEqual(result.resource.image_asset.mime_type, 'IMAGE_PNG');
    assert.strictEqual(result.resource.image_asset.file_size, VALID_PNG_BYTES.length);
    // Verify image_file_path is removed
    assert.strictEqual(result.resource.image_file_path, undefined);
  });

  test('preserves other resource fields', () => {
    const testFile = join(TEST_DIR, 'test.jpg');
    writeFileSync(testFile, VALID_JPEG_BYTES);

    const resource = {
      name: 'My Asset',
      custom_field: 'value',
      image_file_path: testFile
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, true);
    assert.strictEqual(result.resource.name, 'My Asset');
    assert.strictEqual(result.resource.custom_field, 'value');
    assert.strictEqual(result.resource.type, 'IMAGE');
  });

  test('returns error for non-existent file', () => {
    const resource = {
      name: 'Test',
      image_file_path: '/nonexistent/image.jpg'
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('not found'));
  });

  test('returns error for non-IMAGE type with image_file_path', () => {
    const resource = {
      name: 'Test',
      type: 'TEXT',
      image_file_path: '/some/path.jpg'
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('only valid for IMAGE'));
  });

  test('allows IMAGE type with image_file_path', () => {
    const testFile = join(TEST_DIR, 'test.png');
    writeFileSync(testFile, VALID_PNG_BYTES);

    const resource = {
      name: 'Test',
      type: 'IMAGE',
      image_file_path: testFile
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, true);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.resource.type, 'IMAGE');
  });

  test('returns error for invalid image format', () => {
    const testFile = join(TEST_DIR, 'fake.png');
    writeFileSync(testFile, INVALID_IMAGE_BYTES);

    const resource = {
      name: 'Test',
      image_file_path: testFile
    };

    const result = transformImageAssetResource(resource);

    assert.strictEqual(result.processed, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('not a valid PNG'));
  });
});
