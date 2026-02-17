/**
 * GAQL query validation utilities
 *
 * Helps identify common issues before sending queries to Google Ads API
 */

/**
 * Validate a GAQL query for common issues
 * @param {string} query - The GAQL query string
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export function validateQuery(query) {
  const warnings = [];
  const errors = [];

  // Check for unreplaced template variables
  const templateVars = query.match(/\{\{[A-Z_]+\}\}/g);
  if (templateVars) {
    errors.push(`Unreplaced template variables: ${templateVars.join(', ')}`);
  }

  // Check for basic syntax
  if (!query.trim().toUpperCase().startsWith('SELECT')) {
    errors.push('Query must start with SELECT');
  }

  if (!query.toUpperCase().includes('FROM')) {
    errors.push('Query must include FROM clause');
  }

  // Check for common field name issues
  const commonIssues = [
    { pattern: /conversions_value/i, correct: 'conversions_value', note: 'Should be conversions_value (with underscore)' },
    { pattern: /conversion_value(?!s)/i, correct: 'conversions_value', note: 'Should be conversions_value (plural)' },
    { pattern: /segments\.product_item_id.*FROM shopping_performance_view/i, correct: 'shopping_performance_view fields', note: 'segments.product_item_id may not be available in shopping_performance_view' }
  ];

  commonIssues.forEach(issue => {
    if (issue.pattern.test(query)) {
      warnings.push(issue.note);
    }
  });

  // Check for potentially incompatible field combinations
  if (query.includes('keyword_view') && query.includes('segments.product_')) {
    warnings.push('keyword_view and product segments may be incompatible');
  }

  if (query.includes('shopping_performance_view') && query.includes('ad_group_criterion.keyword')) {
    warnings.push('shopping_performance_view and keyword fields may be incompatible');
  }

  // Check for missing required segments with certain metrics
  if (query.includes('segments.date') && !query.includes('WHERE')) {
    warnings.push('Query uses segments.date but has no WHERE clause - may return too much data');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Log validation results
 * @param {string} query - The query being validated
 * @param {{ valid: boolean, warnings: string[], errors: string[] }} validation - Validation results
 */
export function logValidation(query, validation) {
  if (validation.errors.length > 0) {
    console.error('GAQL validation errors:', validation.errors.join('; '));
  }
}
