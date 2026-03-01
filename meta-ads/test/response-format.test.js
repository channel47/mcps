import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { formatError } from '../server/utils/response-format.js';
import { invalidParamsError } from '../server/utils/errors.js';

describe('formatError', () => {
  test('maps explicit invalid-params errors to InvalidParams', () => {
    assert.throws(
      () => formatError(invalidParamsError('Missing required parameter: account_id')),
      (error) => {
        assert.equal(error.code, ErrorCode.InvalidParams);
        assert.match(error.message, /Missing required parameter/);
        return true;
      }
    );
  });

  test('treats untyped API errors with "Invalid" in message as InternalError', () => {
    assert.throws(
      () => formatError(new Error('Meta API transient Invalid state for this request')),
      (error) => {
        assert.equal(error.code, ErrorCode.InternalError);
        assert.match(error.message, /Meta API transient Invalid state/);
        return true;
      }
    );
  });
});
