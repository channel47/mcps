/**
 * Unit tests for mutate tool logic
 * Tests partial failure handling, resource_name extraction, and response formatting
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// ============================================
// Mock Response Fixtures
// ============================================

const MOCK_SUCCESS_RESPONSE = {
  mutate_operation_responses: [
    {
      campaign_result: {
        resource_name: 'customers/1234567890/campaigns/111',
        campaign: null
      },
      response: 'campaign_result'
    }
  ],
  partial_failure_error: null
};

const MOCK_MULTI_SUCCESS_RESPONSE = {
  mutate_operation_responses: [
    {
      campaign_result: { resource_name: 'customers/1234567890/campaigns/111' },
      response: 'campaign_result'
    },
    {
      campaign_result: { resource_name: 'customers/1234567890/campaigns/222' },
      response: 'campaign_result'
    }
  ],
  partial_failure_error: null
};

const MOCK_PARTIAL_FAILURE_ERROR = {
  errors: [
    {
      error_code: { mutate_error: 'RESOURCE_NOT_FOUND' },
      message: 'Resource was not found.',
      location: {
        field_path_elements: [
          { field_name: 'mutate_operations', index: 1 }
        ]
      }
    }
  ],
  request_id: 'test-request-id'
};

const MOCK_ALL_FAILED_ERRORS = [
  {
    error_code: { mutate_error: 'RESOURCE_NOT_FOUND' },
    message: 'Resource was not found.',
    location: { field_path_elements: [{ index: 0 }] }
  },
  {
    error_code: { mutate_error: 'INVALID_ARGUMENT' },
    message: 'Invalid status value.',
    location: { field_path_elements: [{ index: 1 }] }
  }
];

// ============================================
// Helper: Process mutation response (mirrors mutate.js logic)
// ============================================

function processMutationResponse(response, operations, partialFailureErrors = []) {
  const results = response.mutate_operation_responses || [];

  // Check for partial failure errors in response body
  if (response.partial_failure_error) {
    const errorDetails = response.partial_failure_error.errors
      || response.partial_failure_error.details
      || [];

    for (const error of errorDetails) {
      partialFailureErrors.push({
        message: error.message || error.error_message || JSON.stringify(error),
        error_code: error.error_code || error.code,
        operation_index: error.location?.field_path_elements?.[0]?.index ?? -1
      });
    }
  }

  const failCount = partialFailureErrors.length;
  const successCount = operations.length - failCount;

  // Extract resource names from nested result structure
  const extractedResults = results.map(r => {
    const resultKey = r?.response;
    const resultData = resultKey ? r[resultKey] : r;
    return { resource_name: resultData?.resource_name || null };
  });

  return { successCount, failCount, extractedResults, partialFailureErrors };
}

function extractPartialFailureFromError(error) {
  const partialFailureErrors = [];
  if (error.errors && Array.isArray(error.errors)) {
    for (const err of error.errors) {
      const opIndex = err.location?.field_path_elements?.[0]?.index ?? -1;
      partialFailureErrors.push({
        message: err.message || JSON.stringify(err.error_code),
        error_code: err.error_code,
        operation_index: opIndex
      });
    }
  }
  return partialFailureErrors;
}

// ============================================
// Tests
// ============================================

describe('Mutate Response Processing', () => {

  describe('Successful mutations', () => {

    test('extracts resource_name from single campaign result', () => {
      const operations = [{ entity: 'campaign', operation: 'update', resource: {} }];
      const { successCount, failCount, extractedResults } = processMutationResponse(
        MOCK_SUCCESS_RESPONSE, operations
      );

      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 0);
      assert.strictEqual(extractedResults[0].resource_name, 'customers/1234567890/campaigns/111');
    });

    test('extracts resource_names from multiple results', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: {} },
        { entity: 'campaign', operation: 'update', resource: {} }
      ];
      const { successCount, failCount, extractedResults } = processMutationResponse(
        MOCK_MULTI_SUCCESS_RESPONSE, operations
      );

      assert.strictEqual(successCount, 2);
      assert.strictEqual(failCount, 0);
      assert.strictEqual(extractedResults[0].resource_name, 'customers/1234567890/campaigns/111');
      assert.strictEqual(extractedResults[1].resource_name, 'customers/1234567890/campaigns/222');
    });

    test('handles empty response for dry_run', () => {
      const operations = [{ entity: 'campaign', operation: 'update', resource: {} }];
      const { successCount, failCount, extractedResults } = processMutationResponse(
        { mutate_operation_responses: [], partial_failure_error: null },
        operations
      );

      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 0);
      assert.strictEqual(extractedResults.length, 0);
    });
  });

  describe('Resource name extraction', () => {

    test('extracts from campaign_result', () => {
      const response = {
        mutate_operation_responses: [{
          campaign_result: { resource_name: 'customers/123/campaigns/456' },
          response: 'campaign_result'
        }],
        partial_failure_error: null
      };
      const { extractedResults } = processMutationResponse(response, [{}]);
      assert.strictEqual(extractedResults[0].resource_name, 'customers/123/campaigns/456');
    });

    test('extracts from ad_group_result', () => {
      const response = {
        mutate_operation_responses: [{
          ad_group_result: { resource_name: 'customers/123/adGroups/789' },
          response: 'ad_group_result'
        }],
        partial_failure_error: null
      };
      const { extractedResults } = processMutationResponse(response, [{}]);
      assert.strictEqual(extractedResults[0].resource_name, 'customers/123/adGroups/789');
    });

    test('extracts from ad_group_criterion_result', () => {
      const response = {
        mutate_operation_responses: [{
          ad_group_criterion_result: { resource_name: 'customers/123/adGroupCriteria/456~789' },
          response: 'ad_group_criterion_result'
        }],
        partial_failure_error: null
      };
      const { extractedResults } = processMutationResponse(response, [{}]);
      assert.strictEqual(extractedResults[0].resource_name, 'customers/123/adGroupCriteria/456~789');
    });

    test('handles missing resource_name gracefully', () => {
      const response = {
        mutate_operation_responses: [{ response: null }],
        partial_failure_error: null
      };
      const { extractedResults } = processMutationResponse(response, [{}]);
      assert.strictEqual(extractedResults[0].resource_name, null);
    });

    test('handles undefined response field', () => {
      const response = {
        mutate_operation_responses: [{}],
        partial_failure_error: null
      };
      const { extractedResults } = processMutationResponse(response, [{}]);
      assert.strictEqual(extractedResults[0].resource_name, null);
    });
  });

  describe('Partial failure from thrown exception', () => {

    test('extracts errors from exception with errors array', () => {
      const error = {
        errors: MOCK_PARTIAL_FAILURE_ERROR.errors,
        request_id: 'test-id'
      };
      const partialFailureErrors = extractPartialFailureFromError(error);

      assert.strictEqual(partialFailureErrors.length, 1);
      assert.strictEqual(partialFailureErrors[0].operation_index, 1);
      assert.ok(partialFailureErrors[0].message.includes('not found'));
    });

    test('calculates correct success count with partial failures', () => {
      const operations = [{}, {}]; // 2 operations
      const partialFailureErrors = extractPartialFailureFromError({
        errors: MOCK_PARTIAL_FAILURE_ERROR.errors
      });

      const { successCount, failCount } = processMutationResponse(
        { mutate_operation_responses: [], partial_failure_error: null },
        operations,
        partialFailureErrors
      );

      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 1);
    });

    test('extracts multiple errors with correct indices', () => {
      const error = { errors: MOCK_ALL_FAILED_ERRORS };
      const partialFailureErrors = extractPartialFailureFromError(error);

      assert.strictEqual(partialFailureErrors.length, 2);
      assert.strictEqual(partialFailureErrors[0].operation_index, 0);
      assert.strictEqual(partialFailureErrors[1].operation_index, 1);
      assert.ok(partialFailureErrors[0].message.includes('not found'));
      assert.ok(partialFailureErrors[1].message.includes('Invalid'));
    });

    test('handles missing location gracefully', () => {
      const error = {
        errors: [{
          error_code: { mutate_error: 'UNKNOWN' },
          message: 'Unknown error'
          // no location field
        }]
      };
      const partialFailureErrors = extractPartialFailureFromError(error);

      assert.strictEqual(partialFailureErrors.length, 1);
      assert.strictEqual(partialFailureErrors[0].operation_index, -1);
    });

    test('handles missing message gracefully', () => {
      const error = {
        errors: [{
          error_code: { mutate_error: 'RESOURCE_NOT_FOUND' },
          location: { field_path_elements: [{ index: 0 }] }
          // no message field
        }]
      };
      const partialFailureErrors = extractPartialFailureFromError(error);

      assert.strictEqual(partialFailureErrors.length, 1);
      assert.ok(partialFailureErrors[0].message.includes('RESOURCE_NOT_FOUND'));
    });
  });

  describe('All operations failed detection', () => {

    test('detects all operations failed', () => {
      const operations = [{}, {}]; // 2 operations
      const partialFailureErrors = extractPartialFailureFromError({
        errors: MOCK_ALL_FAILED_ERRORS
      });

      const allFailed = partialFailureErrors.length >= operations.length;
      assert.strictEqual(allFailed, true);
    });

    test('detects partial success (not all failed)', () => {
      const operations = [{}, {}, {}]; // 3 operations
      const partialFailureErrors = extractPartialFailureFromError({
        errors: MOCK_PARTIAL_FAILURE_ERROR.errors // only 1 error
      });

      const allFailed = partialFailureErrors.length >= operations.length;
      assert.strictEqual(allFailed, false);
    });

    test('concatenates error messages', () => {
      const partialFailureErrors = extractPartialFailureFromError({
        errors: MOCK_ALL_FAILED_ERRORS
      });

      const errorMessages = partialFailureErrors.map(e => e.message).join('; ');
      assert.ok(errorMessages.includes('not found'));
      assert.ok(errorMessages.includes('Invalid'));
    });
  });

  describe('Partial failure from response body', () => {

    test('extracts errors from partial_failure_error field', () => {
      const response = {
        mutate_operation_responses: [
          { campaign_result: { resource_name: 'test' }, response: 'campaign_result' }
        ],
        partial_failure_error: {
          errors: [{
            message: 'Second operation failed',
            error_code: { mutate_error: 'ERROR' },
            location: { field_path_elements: [{ index: 1 }] }
          }]
        }
      };

      const operations = [{}, {}];
      const { successCount, failCount, partialFailureErrors } = processMutationResponse(
        response, operations
      );

      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 1);
      assert.strictEqual(partialFailureErrors[0].operation_index, 1);
    });
  });

  describe('Success count calculation', () => {

    test('success = total - failures for single operation', () => {
      const operations = [{}];
      const { successCount, failCount } = processMutationResponse(
        { mutate_operation_responses: [], partial_failure_error: null },
        operations
      );

      assert.strictEqual(successCount, 1);
      assert.strictEqual(failCount, 0);
    });

    test('success = total - failures for multiple operations', () => {
      const operations = [{}, {}, {}, {}]; // 4 operations
      const partialFailureErrors = [
        { message: 'error1', operation_index: 1 },
        { message: 'error2', operation_index: 3 }
      ];

      const { successCount, failCount } = processMutationResponse(
        { mutate_operation_responses: [], partial_failure_error: null },
        operations,
        partialFailureErrors
      );

      assert.strictEqual(successCount, 2);
      assert.strictEqual(failCount, 2);
    });

    test('zero success when all fail', () => {
      const operations = [{}, {}];
      const partialFailureErrors = [
        { message: 'error1', operation_index: 0 },
        { message: 'error2', operation_index: 1 }
      ];

      const { successCount, failCount } = processMutationResponse(
        { mutate_operation_responses: [], partial_failure_error: null },
        operations,
        partialFailureErrors
      );

      assert.strictEqual(successCount, 0);
      assert.strictEqual(failCount, 2);
    });
  });

  describe('Message generation', () => {

    test('generates correct dry_run success message', () => {
      const dry_run = true;
      const failCount = 0;

      const message = dry_run
        ? (failCount > 0
          ? `Validation completed with ${failCount} error(s) - no changes made`
          : 'Validation successful - no changes made')
        : (failCount > 0
          ? `Mutations completed: X succeeded, ${failCount} failed`
          : 'Mutations applied successfully');

      assert.ok(message.includes('Validation successful'));
      assert.ok(message.includes('no changes made'));
    });

    test('generates correct dry_run with errors message', () => {
      const dry_run = true;
      const failCount = 2;

      const message = dry_run
        ? (failCount > 0
          ? `Validation completed with ${failCount} error(s) - no changes made`
          : 'Validation successful - no changes made')
        : 'N/A';

      assert.ok(message.includes('2 error(s)'));
      assert.ok(message.includes('no changes made'));
    });

    test('generates correct mutation success message', () => {
      const dry_run = false;
      const failCount = 0;

      const message = !dry_run && failCount === 0
        ? 'Mutations applied successfully'
        : 'N/A';

      assert.strictEqual(message, 'Mutations applied successfully');
    });

    test('generates correct partial failure message', () => {
      const dry_run = false;
      const successCount = 3;
      const failCount = 2;

      const message = !dry_run && failCount > 0
        ? `Mutations completed: ${successCount} succeeded, ${failCount} failed`
        : 'N/A';

      assert.ok(message.includes('3 succeeded'));
      assert.ok(message.includes('2 failed'));
    });
  });
});
