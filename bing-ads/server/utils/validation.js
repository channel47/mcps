const PREDEFINED_DATE_RANGES = new Set([
  'Today',
  'Yesterday',
  'LastSevenDays',
  'ThisWeek',
  'LastWeek',
  'Last14Days',
  'Last30Days',
  'LastFourWeeks',
  'ThisMonth',
  'LastMonth',
  'LastThreeMonths',
  'LastSixMonths',
  'ThisYear',
  'LastYear'
]);

/**
 * Validate that required parameters are present.
 */
export function validateRequired(params, fields) {
  const missing = fields.filter((field) => {
    const value = params[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }
}

/**
 * Validate that a value belongs to an allowed enum list.
 */
export function validateEnum(value, allowed, paramName = 'value') {
  if (!allowed.includes(value)) {
    throw new Error(`Invalid ${paramName}: ${value}. Allowed values: ${allowed.join(', ')}`);
  }
}

/**
 * Resolve account id from params or environment.
 */
export function getAccountId(params = {}) {
  const accountId = params.account_id || process.env.BING_ADS_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('account_id parameter or BING_ADS_ACCOUNT_ID environment variable required');
  }
  return String(accountId);
}

/**
 * Resolve customer id from params or environment.
 */
export function getCustomerId(params = {}) {
  const customerId = params.customer_id || process.env.BING_ADS_CUSTOMER_ID;
  if (!customerId) {
    throw new Error('customer_id parameter or BING_ADS_CUSTOMER_ID environment variable required');
  }
  return String(customerId);
}

/**
 * Validate that a value is a non-empty array.
 */
export function validateArray(value, paramName = 'value') {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${paramName} must be a non-empty array`);
  }
}

/**
 * Validate that exactly one of the given keys is present in an object.
 */
export function validateOneOf(obj, keys, context = 'operation') {
  const present = keys.filter((key) => obj[key] !== undefined);
  if (present.length === 0) {
    throw new Error(`${context} must include one of: ${keys.join(', ')}`);
  }
  if (present.length > 1) {
    throw new Error(`${context} must include only one of: ${keys.join(', ')} (found: ${present.join(', ')})`);
  }
  return present[0];
}

/**
 * Validate supported Bing reporting date range.
 */
export function validateDateRange(dateRange = 'LastSevenDays') {
  if (!PREDEFINED_DATE_RANGES.has(dateRange)) {
    throw new Error(`Invalid date_range: ${dateRange}. Allowed values: ${Array.from(PREDEFINED_DATE_RANGES).join(', ')}`);
  }
  return dateRange;
}

