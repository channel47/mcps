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
 * Coerce a comma-separated string or array into a trimmed string array.
 */
export function toIdList(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolve the ad account ID from params or environment.
 */
export function getAdAccountId(params = {}) {
  const adAccountId = params.ad_account_id || process.env.PINTEREST_ADS_AD_ACCOUNT_ID;
  if (!adAccountId) {
    throw invalidParamsError('ad_account_id parameter or PINTEREST_ADS_AD_ACCOUNT_ID environment variable required');
  }

  return String(adAccountId).trim();
}
