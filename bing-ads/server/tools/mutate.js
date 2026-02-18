import { bingRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { getAccountId, getCustomerId } from '../utils/validation.js';
import {
  validateOperations,
  groupOperations,
  buildApiRequest,
  normalizeResponse,
  buildRequestPreview
} from '../utils/mutate-operations.js';

export async function mutate(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;

  try {
    const operations = params.operations;
    const accountId = getAccountId(params);
    const customerId = getCustomerId(params);
    const partialFailure = params.partial_failure === undefined ? true : Boolean(params.partial_failure);
    const dryRun = params.dry_run === undefined ? true : Boolean(params.dry_run);

    // Validate all operations
    const validationErrors = validateOperations(operations, accountId);
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors
        .map((e) => `[${e.index}] ${e.message}`)
        .join('; ');
      throw new Error(`Invalid operations: ${errorMsg}`);
    }

    // Dry-run: preview what would be sent
    if (dryRun) {
      const preview = buildRequestPreview(operations, accountId);
      return formatSuccess({
        summary: `Dry run: ${operations.length} operation(s) validated. ${preview.requests.length} API call(s) would be made. Client-side validation only — no changes applied.`,
        data: preview.requests,
        metadata: {
          dryRun: true,
          operationCount: operations.length,
          apiCallCount: preview.requests.length,
          accountId,
          customerId
        }
      });
    }

    // Live execution
    const groups = groupOperations(operations, accountId);
    const allResults = [];
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (const group of groups) {
      const apiRequest = buildApiRequest(group, accountId);
      const indices = group.items.map((item) => item.index);

      try {
        const response = await request(
          apiRequest.url,
          apiRequest.body,
          {
            method: apiRequest.method,
            accountId,
            customerId
          }
        );

        const results = normalizeResponse(response, group.entity, group.action, indices);
        for (const result of results) {
          allResults.push(result);
          if (result.success) {
            totalSucceeded++;
          } else {
            totalFailed++;
          }
        }

        if (!partialFailure && totalFailed > 0) {
          break;
        }
      } catch (error) {
        // Whole-group failure — mark all operations in this group as failed
        for (const idx of indices) {
          allResults.push({
            index: idx,
            success: false,
            error: { code: 0, message: error.message, error_code: 'RequestFailed' }
          });
          totalFailed++;
        }

        if (!partialFailure) {
          break;
        }
      }
    }

    // Sort results by original index
    allResults.sort((a, b) => a.index - b.index);

    if (totalSucceeded === 0 && totalFailed > 0) {
      throw new Error(`All ${totalFailed} operation(s) failed. First error: ${allResults[0]?.error?.message || 'Unknown'}`);
    }

    return formatSuccess({
      summary: `Executed ${allResults.length} operation(s): ${totalSucceeded} succeeded, ${totalFailed} failed`,
      data: allResults,
      metadata: {
        dryRun: false,
        operationCount: allResults.length,
        succeeded: totalSucceeded,
        failed: totalFailed,
        accountId,
        customerId
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
