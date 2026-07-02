import { tiktokRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAdvertiserId } from '../utils/validation.js';
import {
  buildApiRequest,
  buildRequestPreview,
  validateOperations
} from '../utils/mutate-operations.js';

function extractResultId(response, operation) {
  const data = response?.data;
  return (
    data?.campaign_id
    ?? data?.adgroup_id
    ?? data?.ad_ids
    ?? operation.id
    ?? null
  );
}

/**
 * Validate and execute TikTok Ads mutation operations with dry-run safety defaults.
 *
 * TikTok has no server-side validate-only mode, so dry_run (default true)
 * performs local validation and returns a preview of the exact requests
 * (method, path, body) without calling the API.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function mutate(params = {}, dependencies = {}) {
  const request = dependencies.request || tiktokRequest;

  try {
    const operations = params.operations;
    const advertiserId = getAdvertiserId(params);
    const partialFailure = params.partial_failure === undefined ? true : Boolean(params.partial_failure);
    const dryRun = params.dry_run === undefined ? true : Boolean(params.dry_run);

    const validationErrors = validateOperations(operations);
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.map((issue) => `[${issue.index}] ${issue.message}`).join('; ');
      throw invalidParamsError(`Invalid operations: ${errorMessage}`);
    }

    if (dryRun) {
      const preview = buildRequestPreview(operations, advertiserId);

      return formatSuccess({
        summary: `Dry run: ${operations.length} operation(s) validated locally. `
          + `${preview.requests.length} request(s) would be sent to the TikTok Ads API. No changes applied. `
          + 'TikTok has no server-side validate-only mode — pass dry_run: false to execute.',
        data: preview.requests,
        metadata: {
          dryRun: true,
          serverValidated: false,
          operationCount: operations.length,
          apiCallCount: preview.requests.length,
          advertiserId
        }
      });
    }

    if (process.env.TIKTOK_ADS_READ_ONLY === 'true') {
      throw new Error('mutate is disabled in read-only mode (TIKTOK_ADS_READ_ONLY=true)');
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      const apiRequest = buildApiRequest(operation, advertiserId);

      try {
        const response = await request(apiRequest.path, {}, {
          method: apiRequest.method,
          body: apiRequest.body
        });

        results.push({
          index,
          entity: operation.entity,
          action: operation.action,
          success: true,
          id: extractResultId(response, operation),
          response: response?.data ?? response
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
        advertiserId
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
