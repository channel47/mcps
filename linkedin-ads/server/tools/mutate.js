import { linkedinRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAccountId } from '../utils/validation.js';
import {
  buildApiRequest,
  buildRequestPreview,
  validateOperations
} from '../utils/mutate-operations.js';

/**
 * Validate and execute LinkedIn Ads mutation operations with dry-run safety
 * defaults. LinkedIn has no server-side validate-only mode, so dry_run
 * (default true) performs local validation and returns a preview of the exact
 * requests (method, path, headers, body) without calling the API.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function mutate(params = {}, dependencies = {}) {
  const request = dependencies.request || linkedinRequest;

  try {
    const operations = params.operations;
    const accountId = getAccountId(params);
    const partialFailure = params.partial_failure === undefined ? true : Boolean(params.partial_failure);
    const dryRun = params.dry_run === undefined ? true : Boolean(params.dry_run);

    const validationErrors = validateOperations(operations);
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.map((issue) => `[${issue.index}] ${issue.message}`).join('; ');
      throw invalidParamsError(`Invalid operations: ${errorMessage}`);
    }

    if (dryRun) {
      const preview = buildRequestPreview(operations, accountId);

      return formatSuccess({
        summary: `Dry run: ${operations.length} operation(s) validated locally. ${preview.requests.length} request(s) would be sent — no API calls were made (LinkedIn has no server-side validate-only mode). Re-run with dry_run=false to execute.`,
        data: preview.requests,
        metadata: {
          dryRun: true,
          serverValidated: false,
          operationCount: operations.length,
          apiCallCount: preview.requests.length,
          accountId
        }
      });
    }

    if (process.env.LINKEDIN_ADS_READ_ONLY === 'true') {
      throw new Error('mutate is disabled in read-only mode (LINKEDIN_ADS_READ_ONLY=true)');
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      const apiRequest = buildApiRequest(operation, accountId);

      try {
        const response = await request(apiRequest.path, {}, {
          method: apiRequest.method,
          headers: apiRequest.headers,
          body: apiRequest.body
        });

        const resolvedId = response?.restliId || operation.id || null;
        results.push({
          index,
          entity: operation.entity,
          action: operation.action,
          success: true,
          id: resolvedId,
          response
        });
        succeeded += 1;
      } catch (error) {
        results.push({
          index,
          entity: operation.entity,
          action: operation.action,
          success: false,
          error: {
            message: error.message
          }
        });
        failed += 1;

        if (!partialFailure) {
          break;
        }
      }
    }

    if (succeeded === 0 && failed > 0) {
      const firstError = results.find((entry) => !entry.success)?.error?.message || 'Unknown';
      throw new Error(`All ${failed} operation(s) failed. First error: ${firstError}`);
    }

    return formatSuccess({
      summary: `Executed ${results.length} operation(s): ${succeeded} succeeded, ${failed} failed`,
      data: results,
      metadata: {
        dryRun: false,
        operationCount: results.length,
        succeeded,
        failed,
        accountId
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
