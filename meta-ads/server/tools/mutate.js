import { metaRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAccountId } from '../utils/validation.js';
import {
  buildApiRequest,
  buildRequestPreview,
  validateOperations
} from '../utils/mutate-operations.js';

/**
 * Validate and execute Meta Ads mutation operations with dry-run safety defaults.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function mutate(params = {}, dependencies = {}) {
  const request = dependencies.request || metaRequest;

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
      const validationResults = [];
      let serverValidated = true;

      try {
        for (let index = 0; index < operations.length; index += 1) {
          const operation = operations[index];
          const apiRequest = buildApiRequest(operation, accountId);

          if (operation.action === 'create' || operation.action === 'update') {
            const validateParams = {
              ...apiRequest.params,
              execution_options: ['validate_only', 'include_recommendations']
            };

            try {
              const response = await request(apiRequest.path, validateParams, {
                method: apiRequest.method
              });
              validationResults.push({
                index,
                entity: operation.entity,
                action: operation.action,
                valid: true,
                recommendations: response?.recommendations || null
              });
            } catch (opError) {
              validationResults.push({
                index,
                entity: operation.entity,
                action: operation.action,
                valid: false,
                error: opError.message
              });

              if (!partialFailure) {
                break;
              }
            }
          } else {
            validationResults.push({
              index,
              entity: operation.entity,
              action: operation.action,
              valid: true,
              note: `${operation.action} validated client-side only`
            });
          }
        }
      } catch (outerError) {
        serverValidated = false;
        const preview = buildRequestPreview(operations, accountId);
        return formatSuccess({
          summary: `Dry run: ${operations.length} operation(s) validated client-side only (server validation failed: ${outerError.message}). ${preview.requests.length} request(s) would be sent.`,
          data: preview.requests,
          metadata: {
            dryRun: true,
            serverValidated: false,
            warning: `Server-side validation unavailable: ${outerError.message}`,
            operationCount: operations.length,
            apiCallCount: preview.requests.length,
            accountId
          }
        });
      }

      const validCount = validationResults.filter((r) => r.valid).length;
      const invalidCount = validationResults.filter((r) => !r.valid).length;

      return formatSuccess({
        summary: `Dry run: ${operations.length} operation(s) validated server-side via Meta API. ${validCount} valid, ${invalidCount} invalid. No changes applied.`,
        data: validationResults,
        metadata: {
          dryRun: true,
          serverValidated: true,
          operationCount: operations.length,
          validCount,
          invalidCount,
          accountId
        }
      });
    }

    if (process.env.META_ADS_READ_ONLY === 'true') {
      throw new Error('mutate is disabled in read-only mode (META_ADS_READ_ONLY=true)');
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      const apiRequest = buildApiRequest(operation, accountId);

      try {
        const response = await request(apiRequest.path, apiRequest.params, {
          method: apiRequest.method
        });

        const resolvedId = response?.id || operation.id || null;
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
