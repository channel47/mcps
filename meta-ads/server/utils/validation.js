export function validateRequired(params, fields) {
  const missing = fields.filter((field) => {
    const value = params[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }
}

export function validateEnum(value, allowed, paramName = 'value') {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${paramName}: ${value}. Allowed values: ${allowed.join(', ')}`);
  }
}

export function validateArray(value, paramName = 'value') {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${paramName} must be a non-empty array`);
  }
}

export function normalizeAccountId(accountId) {
  const raw = String(accountId || '').trim();
  if (!raw) {
    return '';
  }

  return raw.startsWith('act_') ? raw.slice(4) : raw;
}

export function withActPrefix(accountId) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) {
    return '';
  }

  return `act_${normalized}`;
}

export function getAccountId(params = {}, { prefixed = false } = {}) {
  const accountId = params.account_id || process.env.META_ADS_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('account_id parameter or META_ADS_ACCOUNT_ID environment variable required');
  }

  const normalized = normalizeAccountId(accountId);
  return prefixed ? withActPrefix(normalized) : normalized;
}
