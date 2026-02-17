#!/usr/bin/env node
import { getCustomerClient } from '../auth.js';
import { formatSuccess, formatError } from '../utils/response-format.js';
import { normalizeOperations } from '../utils/operation-transform.js';

/**
 * Execute mutation operations using GoogleAdsService.Mutate
 * Supports any write operation with dry_run validation
 *
 * @param {Object} params - Mutation parameters
 * @param {string} params.customer_id - Google Ads customer ID (optional, uses env default)
 * @param {Array} params.operations - Array of mutation operation objects
 * @param {boolean} params.partial_failure - Enable partial failure mode (default: true)
 * @param {boolean} params.dry_run - Validate only, don't execute (default: true)
 * @returns {Promise<Object>} Mutation results
 */
export async function mutate(params) {
  const {
    customer_id = process.env.GOOGLE_ADS_CUSTOMER_ID,
    operations,
    partial_failure = true,
    dry_run = true
  } = params;

  // Validate required parameters
  if (!customer_id) {
    return formatError(new Error('customer_id is required (either as parameter or GOOGLE_ADS_CUSTOMER_ID env var)'));
  }

  if (!operations || !Array.isArray(operations) || operations.length === 0) {
    return formatError(new Error('operations array is required and must contain at least one operation'));
  }

  const customer = getCustomerClient(customer_id);
  let response;
  let partialFailureErrors = [];

  // Transform operations to Opteo library format if needed
  let normalizedOps;
  try {
    const result = normalizeOperations(operations);
    normalizedOps = result.operations;
    // Log transformation warnings for debugging
    if (result.warnings.length > 0) {
      console.error('Operation format transformations:', result.warnings);
    }
  } catch (transformError) {
    return formatError(transformError);
  }

  try {
    // Execute mutation with validation options
    response = await customer.mutateResources(normalizedOps, {
      partial_failure: partial_failure,
      validate_only: dry_run
    });
  } catch (error) {
    // The Opteo library throws exceptions with error.errors array for partial failures
    // Extract failure details if available
    if (partial_failure && error.errors && Array.isArray(error.errors)) {
      for (const err of error.errors) {
        const opIndex = err.location?.field_path_elements?.[0]?.index ?? -1;
        // Extract full field path for debugging (e.g., "operations.create.campaign_bidding_strategy")
        const fieldPath = err.location?.field_path_elements?.map(e => e.field_name).join('.') || null;
        partialFailureErrors.push({
          message: err.message || JSON.stringify(err.error_code),
          error_code: err.error_code,
          operation_index: opIndex,
          field_path: fieldPath,
          trigger: err.trigger?.string_value || null
        });
      }

      // If not all operations failed, treat as partial success
      if (partialFailureErrors.length < operations.length) {
        response = { mutate_operation_responses: [], partial_failure_error: null };
      } else {
        // All operations failed
        const errorMessages = partialFailureErrors.map(e => e.message).join('; ');
        return formatError(new Error(`All operations failed: ${errorMessages}`));
      }
    } else {
      // Not a partial failure - re-throw as regular error
      return formatError(error);
    }
  }

  // Extract results from response
  const results = response.mutate_operation_responses || [];

  // Check for partial failure errors in response body (alternative structure)
  if (response.partial_failure_error) {
    const errorDetails = response.partial_failure_error.errors
      || response.partial_failure_error.details
      || [];

    for (const error of errorDetails) {
      const fieldPath = error.location?.field_path_elements?.map(e => e.field_name).join('.') || null;
      partialFailureErrors.push({
        message: error.message || error.error_message || JSON.stringify(error),
        error_code: error.error_code || error.code,
        operation_index: error.location?.field_path_elements?.[0]?.index ?? -1,
        field_path: fieldPath,
        trigger: error.trigger?.string_value || null
      });
    }
  }

  // Calculate success/failure counts
  const failCount = partialFailureErrors.length;
  const successCount = operations.length - failCount;

  // Extract resource names from nested result structure
  // Results come as: { campaign_result: { resource_name: "..." }, response: "campaign_result" }
  const extractedResults = results.map(r => {
    // Find the result field (campaign_result, ad_group_result, etc.)
    const resultKey = r?.response;
    const resultData = resultKey ? r[resultKey] : r;
    return {
      resource_name: resultData?.resource_name || null
    };
  });

  // Build appropriate message
  let message;
  if (dry_run) {
    message = failCount > 0
      ? `Validation completed with ${failCount} error(s) - no changes made`
      : 'Validation successful - no changes made';
  } else {
    message = failCount > 0
      ? `Mutations completed: ${successCount} succeeded, ${failCount} failed`
      : 'Mutations applied successfully';
  }

  return formatSuccess({
    summary: `${message} (${operations.length} operation${operations.length !== 1 ? 's' : ''})`,
    data: extractedResults,
    metadata: {
      dry_run,
      operations_count: operations.length,
      success_count: successCount,
      failure_count: failCount,
      customer_id,
      ...(partialFailureErrors.length > 0 && { errors: partialFailureErrors })
    }
  });
}
