import { invalidParamsError } from './errors.js';

/**
 * Validate that required fields are present on the params object.
 */
export function validateRequired(params, fields) {
  const missing = fields.filter((field) => {
    const value = params[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw invalidParamsError(`Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }
}

/**
 * Validate an enum value against an allowed set.
 */
export function validateEnum(value, allowed, paramName = 'value') {
  if (!allowed.includes(value)) {
    throw invalidParamsError(`Invalid ${paramName}: ${value}. Allowed values: ${allowed.join(', ')}`);
  }
}

/**
 * Validate that a value is a non-empty array.
 */
export function validateArray(value, paramName = 'value') {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidParamsError(`${paramName} must be a non-empty array`);
  }
}

/**
 * Validate a YYYY-MM-DD date string.
 */
export function validateDate(value, label = 'date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw invalidParamsError(`Invalid ${label} format: ${value}. Expected YYYY-MM-DD`);
  }
}

/**
 * Resolve a positive row limit with default and cap.
 */
export function getRequestedLimit(limitValue, { defaultLimit = 100, maxLimit = 1000 } = {}) {
  if (limitValue === undefined || limitValue === null || limitValue === '') {
    return defaultLimit;
  }

  const parsed = Number(limitValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(parsed), maxLimit);
}

/**
 * Resolve advertiser ID from params or environment.
 */
export function getAdvertiserId(params = {}) {
  const advertiserId = params.advertiser_id || process.env.TIKTOK_ADS_ADVERTISER_ID;
  if (!advertiserId) {
    throw invalidParamsError('advertiser_id parameter or TIKTOK_ADS_ADVERTISER_ID environment variable required');
  }

  return String(advertiserId).trim();
}
