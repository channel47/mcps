import { getCustomerClient } from '../auth.js';
import { formatSuccess, formatError } from '../utils/response-format.js';
import { blockMutations } from '../utils/validation.js';

/**
 * Execute raw GAQL queries for advanced users
 * Provides escape hatch for custom queries with safety guards
 *
 * @param {Object} params
 * @param {string} [params.customer_id] - Google Ads account ID
 * @param {string} params.query - GAQL query string (SELECT only)
 * @param {number} [params.limit=100] - Maximum rows to return (max: 10000)
 * @returns {Object} MCP response with query results
 */
export async function runGaqlQuery(params = {}) {
  try {
    // Validate required parameters
    if (!params.query || typeof params.query !== 'string') {
      throw new Error('query parameter is required and must be a string');
    }

    const query = params.query.trim();

    // Validate query is not empty
    if (!query) {
      throw new Error('query cannot be empty');
    }

    // Block mutation operations for safety
    blockMutations(query);

    // Validate query starts with SELECT
    if (!query.toUpperCase().startsWith('SELECT')) {
      throw new Error(
        'Query must start with SELECT. This tool only supports read operations. ' +
        'Use the mutate tool for write operations.'
      );
    }

    // Get customer ID
    const customerId = params.customer_id || process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
    if (!customerId) {
      throw new Error('customer_id parameter or GOOGLE_ADS_DEFAULT_CUSTOMER_ID environment variable required');
    }

    // Validate and enforce limit
    const requestedLimit = params.limit || 100;
    const maxLimit = 10000;
    const limit = Math.min(Math.max(1, requestedLimit), maxLimit);

    // Check if query already has LIMIT clause
    const hasLimit = /\bLIMIT\s+\d+/i.test(query);

    // Build final query with enforced limit
    let finalQuery = query;
    if (!hasLimit) {
      finalQuery = `${query} LIMIT ${limit}`;
    } else {
      // Extract existing limit and enforce max
      const existingLimit = parseInt(query.match(/\bLIMIT\s+(\d+)/i)[1], 10);
      if (existingLimit > maxLimit) {
        finalQuery = query.replace(/\bLIMIT\s+\d+/i, `LIMIT ${maxLimit}`);
      }
    }

    const customer = getCustomerClient(customerId);

    // Execute query
    const startTime = Date.now();
    const results = await customer.query(finalQuery);
    const executionTime = Date.now() - startTime;

    // Process results
    const rowCount = results.length;

    // Flatten results for readability
    const data = results.map(row => flattenRow(row));

    // Extract field names from first row
    const fields = data.length > 0 ? Object.keys(data[0]) : [];

    return formatSuccess({
      summary: `Query returned ${rowCount} row${rowCount !== 1 ? 's' : ''} in ${executionTime}ms`,
      data: {
        rows: data,
        fields: fields
      },
      metadata: {
        customer_id: customerId,
        row_count: rowCount,
        field_count: fields.length,
        execution_time_ms: executionTime,
        limit_applied: limit,
        query_truncated: rowCount >= limit,
        query_preview: finalQuery.length > 200
          ? finalQuery.substring(0, 200) + '...'
          : finalQuery
      }
    });

  } catch (error) {
    return formatError(error);
  }
}

/**
 * Flatten a nested result row into a flat object
 * Converts nested structures like { campaign: { id: '123' } } to { 'campaign.id': '123' }
 *
 * @param {Object} row - Query result row
 * @param {string} [prefix=''] - Key prefix for nested objects
 * @returns {Object} Flattened row
 */
function flattenRow(row, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(row)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = null;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      Object.assign(result, flattenRow(value, newKey));
    } else if (Array.isArray(value)) {
      // Keep arrays as-is but stringify for readability
      result[newKey] = value;
    } else {
      // Handle micros conversion for common fields
      if (key.endsWith('_micros') && typeof value === 'number') {
        const baseKey = newKey.replace('_micros', '');
        result[baseKey] = value / 1000000;
        result[newKey] = value; // Keep original for precision
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}
