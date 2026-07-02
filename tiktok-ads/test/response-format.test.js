import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { formatError, formatSuccess } from '../server/utils/response-format.js';
import { invalidParamsError } from '../server/utils/errors.js';

describe('formatSuccess', () => {
  test('wraps payload in MCP text content with metadata', () => {
    const result = formatSuccess({
      summary: 'Returned 2 rows',
      data: [{ campaign_id: '1' }, { campaign_id: '2' }],
      metadata: { entity: 'campaigns' }
    });

    const body = JSON.parse(result.content[0].text);
    assert.equal(body.success, true);
    assert.equal(body.summary, 'Returned 2 rows');
    assert.equal(body.metadata.rowCount, 2);
    assert.equal(body.metadata.entity, 'campaigns');
    assert.deepEqual(body.metadata.warnings, []);
  });
});

describe('formatError', () => {
  test('maps explicit invalid-params errors to InvalidParams', () => {
    assert.throws(
      () => formatError(invalidParamsError('Missing required parameter: advertiser_id')),
      (error) => {
        assert.equal(error.code, ErrorCode.InvalidParams);
        assert.match(error.message, /Missing required parameter/);
        return true;
      }
    );
  });

  test('treats untyped API errors as InternalError', () => {
    assert.throws(
      () => formatError(new Error('TikTok Ads API request failed (500): upstream error')),
      (error) => {
        assert.equal(error.code, ErrorCode.InternalError);
        assert.match(error.message, /upstream error/);
        return true;
      }
    );
  });
});
