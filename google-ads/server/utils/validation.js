// Mutation keywords to block for read-only safety
const MUTATION_KEYWORDS = ['create', 'update', 'remove', 'mutate', 'delete'];

/**
 * Validate that required parameters are present
 * @param {Object} params - Parameters object
 * @param {string[]} fields - Required field names
 * @throws {Error} If any required field is missing
 */
export function validateRequired(params, fields) {
  const missing = fields.filter(field => {
    const value = params[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }
}

/**
 * Validate that a value is one of the allowed enum values
 * @param {string} value - Value to check
 * @param {string[]} allowed - Allowed values
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If value is not in allowed list
 */
export function validateEnum(value, allowed, paramName = 'value') {
  if (!allowed.includes(value)) {
    throw new Error(
      `Invalid ${paramName}: ${value}. Allowed values: ${allowed.join(', ')}`
    );
  }
}

/**
 * Parse and validate date range
 * @param {string} range - Predefined range or 'CUSTOM'
 * @param {string} [startDate] - Start date for CUSTOM range (YYYY-MM-DD)
 * @param {string} [endDate] - End date for CUSTOM range (YYYY-MM-DD)
 * @returns {{ start: string, end: string }} Formatted dates (YYYY-MM-DD)
 * @throws {Error} If range is invalid or CUSTOM dates are missing
 */
export function validateDateRange(range, startDate, endDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /**
   * Format date as YYYY-MM-DD
   */
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const ranges = {
    'TODAY': () => ({ start: today, end: today }),
    'YESTERDAY': () => {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
    },
    'LAST_7_DAYS': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: today };
    },
    'LAST_14_DAYS': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 14);
      return { start, end: today };
    },
    'LAST_30_DAYS': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: today };
    },
    'LAST_90_DAYS': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: today };
    },
    'THIS_MONTH': () => {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: today };
    },
    'LAST_MONTH': () => {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start, end };
    },
    'CUSTOM': () => {
      if (!startDate || !endDate) {
        throw new Error('start_date and end_date required for CUSTOM range');
      }
      // Parse dates as local time to avoid timezone conversion issues
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      return {
        start: new Date(startYear, startMonth - 1, startDay),
        end: new Date(endYear, endMonth - 1, endDay)
      };
    }
  };

  if (!ranges[range]) {
    throw new Error(
      `Invalid date_range: ${range}. Allowed values: ${Object.keys(ranges).join(', ')}`
    );
  }

  const { start, end } = ranges[range]();

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

/**
 * Get customer ID from params or environment, with validation
 * Consolidates the common pattern used across all tools
 * @param {Object} params - Parameters object with optional customer_id
 * @returns {string} Valid customer ID
 * @throws {Error} If no customer ID is available
 */
export function getCustomerId(params = {}) {
  const customerId = params.customer_id || process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  if (!customerId) {
    throw new Error('customer_id parameter or GOOGLE_ADS_DEFAULT_CUSTOMER_ID environment variable required');
  }
  return customerId;
}

/**
 * Build common campaign ID filter clause
 * @param {string[]} campaignIds - Array of campaign IDs to filter
 * @returns {string} GAQL filter clause or empty string
 */
export function buildCampaignFilter(campaignIds) {
  if (!campaignIds || campaignIds.length === 0) {
    return '';
  }
  const ids = campaignIds.join(', ');
  return `AND campaign.id IN (${ids})`;
}

/**
 * Check query for mutation keywords and block if found
 * @param {string} query - GAQL query string
 * @throws {Error} If query contains mutation keywords
 */
export function blockMutations(query) {
  const lowerQuery = query.toLowerCase();

  for (const keyword of MUTATION_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      throw new Error(
        `Mutation operations not allowed in query tool. Query contains: "${keyword}". ` +
        `Use the mutate tool for write operations.`
      );
    }
  }
}
