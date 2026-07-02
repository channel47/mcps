/**
 * GAQL query templates with placeholder substitution
 */
export const TEMPLATES = {
  LIST_ACCOUNTS: `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.manager,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status
    FROM customer_client
    {{FILTERS}}
  `
};

/**
 * Build GAQL query from template with parameter substitution
 * @param {string} template - Template string with placeholders
 * @param {Object} params - Substitution parameters
 * @returns {string} Complete GAQL query
 * @throws {Error} If any template placeholder is left unreplaced
 */
export function buildQuery(template, params = {}) {
  const query = template.replace('{{FILTERS}}', params.filters || '');

  // Clean up whitespace
  const finalQuery = query.trim().replace(/\s+/g, ' ');

  const unreplaced = finalQuery.match(/\{\{[A-Z_]+\}\}/g);
  if (unreplaced) {
    throw new Error(`Unreplaced template variables: ${unreplaced.join(', ')}`);
  }

  return finalQuery;
}
