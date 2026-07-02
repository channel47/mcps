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
 * URN prefixes for the sponsored entity types this server works with.
 */
export const ENTITY_URN_PREFIXES = {
  account: 'urn:li:sponsoredAccount:',
  campaign: 'urn:li:sponsoredCampaign:',
  campaign_group: 'urn:li:sponsoredCampaignGroup:',
  creative: 'urn:li:sponsoredCreative:'
};

/**
 * Normalize ad account IDs by stripping an optional sponsoredAccount URN prefix.
 */
export function normalizeAccountId(accountId) {
  const raw = String(accountId || '').trim();
  if (!raw) {
    return '';
  }

  return raw.startsWith(ENTITY_URN_PREFIXES.account)
    ? raw.slice(ENTITY_URN_PREFIXES.account.length)
    : raw;
}

/**
 * Resolve account ID from params or environment, normalized to the plain numeric form.
 */
export function getAccountId(params = {}) {
  const accountId = params.account_id || process.env.LINKEDIN_ADS_ACCOUNT_ID;
  if (!accountId) {
    throw invalidParamsError('account_id parameter or LINKEDIN_ADS_ACCOUNT_ID environment variable required');
  }

  return normalizeAccountId(accountId);
}

/**
 * Convert a plain ID to a fully-qualified sponsored entity URN.
 * IDs that already look like URNs are passed through untouched.
 * @param {'account' | 'campaign' | 'campaign_group' | 'creative'} entityType
 * @param {string | number} id
 * @returns {string}
 */
export function toEntityUrn(entityType, id) {
  const prefix = ENTITY_URN_PREFIXES[entityType];
  if (!prefix) {
    throw invalidParamsError(`Unknown entity type for URN: ${entityType}. Allowed: ${Object.keys(ENTITY_URN_PREFIXES).join(', ')}`);
  }

  const raw = String(id ?? '').trim();
  if (!raw) {
    throw invalidParamsError(`Missing id for ${entityType} URN`);
  }

  return raw.startsWith('urn:li:') ? raw : `${prefix}${raw}`;
}

/**
 * Extract the trailing entity ID from a URN, or return the value unchanged
 * when it is already a plain ID.
 */
export function fromEntityUrn(value) {
  const raw = String(value ?? '').trim();
  if (!raw.startsWith('urn:li:')) {
    return raw;
  }

  const segments = raw.split(':');
  return segments[segments.length - 1];
}
