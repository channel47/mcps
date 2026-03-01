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
 * Normalize ad account IDs by removing optional act_ prefix.
 */
export function normalizeAccountId(accountId) {
  const raw = String(accountId || '').trim();
  if (!raw) {
    return '';
  }

  return raw.startsWith('act_') ? raw.slice(4) : raw;
}

/**
 * Ensure ad account ID includes act_ prefix.
 */
export function withActPrefix(accountId) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) {
    return '';
  }

  return `act_${normalized}`;
}

/**
 * Resolve account ID from params or environment with optional act_ formatting.
 */
export function getAccountId(params = {}, { prefixed = false } = {}) {
  const accountId = params.account_id || process.env.META_ADS_ACCOUNT_ID;
  if (!accountId) {
    throw invalidParamsError('account_id parameter or META_ADS_ACCOUNT_ID environment variable required');
  }

  const normalized = normalizeAccountId(accountId);
  return prefixed ? withActPrefix(normalized) : normalized;
}
