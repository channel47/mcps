// Mutation keywords to block for read-only safety
const MUTATION_KEYWORDS = ['create', 'update', 'remove', 'mutate', 'delete'];

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
