import { pinterestRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAdAccountId } from '../utils/validation.js';
import {
  buildApiRequest,
  buildRequestPreview,
  validateOperations
} from '../utils/mutate-operations.js';

function extractExceptionMessage(exceptions) {
  if (!Array.isArray(exceptions) || exceptions.length === 0) {
    return null;
  }

  return exceptions
    .map((exception) => {
      const code = exception?.code ? `[code ${exception.code}] ` : '';
      return `${code}${exception?.message || 'Unknown exception'}`;
    })
    .join('; ');
}

/**
 * Validate and execute Pinterest Ads mutation operations with dry-run safety defaults.
 * Pinterest v5 has no server-side validate-only mode, so dry runs perform local
 * validation and return a preview of the exact requests without calling the API.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function mutate(params = {}, dependencies = {}) {
  const request = dependencies.request || pinterestRequest;

  try {
    const operations = params.operations;
    const adAccountId = getAdAccountId(params);
    const partialFailure = params.partial_failure === undefined ? true : Boolean(params.partial_failure);
    const dryRun = params.dry_run === undefined ? true : Boolean(params.dry_run);

    const validationErrors = validateOperations(operations);
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.map((issue) => `[${issue.index}] ${issue.message}`).join('; ');
      throw invalidParamsError(`Invalid operations: ${errorMessage}`);
    }

    if (dryRun) {
      const preview = buildRequestPreview(operations, adAccountId);

      return formatSuccess({
        summary: `Dry run: ${operations.length} operation(s) validated locally. ${preview.requests.length} request(s) would be sent — Pinterest has no server-side validate-only mode, so no API calls were made. Re-run with dry_run=false to execute.`,
        data: preview.requests,
        metadata: {
          dryRun: true,
          serverValidated: false,
          operationCount: operations.length,
          apiCallCount: preview.requests.length,
          adAccountId
        }
      });
    }

    if (process.env.PINTEREST_ADS_READ_ONLY === 'true') {
      throw new Error('mutate is disabled in read-only mode (PINTEREST_ADS_READ_ONLY=true)');
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      const apiRequest = buildApiRequest(operation, adAccountId);

      try {
        const response = await request(apiRequest.path, {}, {
          method: apiRequest.method,
          body: apiRequest.body
        });

        const item = Array.isArray(response?.items) ? response.items[0] : null;
        const exceptionMessage = extractExceptionMessage(item?.exceptions);
        if (exceptionMessage) {
          throw new Error(exceptionMessage);
        }

        const resolvedId = item?.data?.id || operation.id || null;
        results.push({
          index,
          entity: operation.entity,
          action: operation.action,
          success: true,
          id: resolvedId,
          data: item?.data ?? response
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
        adAccountId
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
