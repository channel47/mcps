import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listAccounts } from '../server/tools/list-accounts.js';
import { isRawParam } from '../server/utils/restli.js';
import { MOCK_LIST_ACCOUNTS_RESPONSE } from './fixtures.js';

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

describe('listAccounts', () => {
  test('lists and normalizes account data', async () => {
    let capturedPath = null;

    const result = await listAccounts(
      {},
      {
        request: async (path) => {
          capturedPath = path;
          return MOCK_LIST_ACCOUNTS_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/adAccounts');
    assert.equal(body.data.length, 2);

    const first = body.data[0];
    assert.equal(first.id, 512345678);
    assert.equal(first.name, 'Primary LinkedIn Account');
    assert.equal(first.status, 'ACTIVE');
    assert.equal(first.currency, 'USD');
    assert.equal(first.type, 'BUSINESS');
    assert.equal(first.reference, 'urn:li:organization:2414183');
    assert.deepEqual(first.serving_statuses, ['RUNNABLE']);
  });

  test('uses the search finder with pageSize', async () => {
    let capturedParams = null;

    await listAccounts(
      {},
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedParams.q, 'search');
    assert.equal(capturedParams.pageSize, 1000);
    assert.equal(capturedParams.search, undefined);
  });

  test('builds server-side status/type search filter', async () => {
    let capturedParams = null;

    const result = await listAccounts(
      { status: 'active', type: ['BUSINESS'] },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.ok(isRawParam(capturedParams.search));
    assert.equal(
      capturedParams.search.value,
      '(status:(values:List(ACTIVE)),type:(values:List(BUSINESS)))'
    );

    const body = parseResult(result);
    assert.deepEqual(body.metadata.appliedStatusFilter, ['ACTIVE']);
    assert.deepEqual(body.metadata.appliedTypeFilter, ['BUSINESS']);
  });

  test('rejects unknown status values', async () => {
    await assert.rejects(
      () => listAccounts(
        { status: 'DISABLED' },
        { request: async () => ({ elements: [] }) }
      ),
      /Invalid status: DISABLED/
    );
  });

  test('follows pageToken cursor pagination and aggregates pages', async () => {
    const seenParams = [];

    const result = await listAccounts(
      {},
      {
        request: async (_path, params) => {
          seenParams.push(params);

          if (params.pageToken === 'token_page_2') {
            return {
              elements: [{ id: 2, name: 'Account 2', status: 'ACTIVE' }],
              metadata: {}
            };
          }

          return {
            elements: [{ id: 1, name: 'Account 1', status: 'ACTIVE' }],
            metadata: { nextPageToken: 'token_page_2' }
          };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(seenParams.length, 2);
    assert.equal(seenParams[0].pageToken, undefined);
    assert.equal(seenParams[1].pageToken, 'token_page_2');
  });

  test('respects the limit parameter across pages', async () => {
    let calls = 0;

    const result = await listAccounts(
      { limit: 1 },
      {
        request: async (_path, params) => {
          calls += 1;
          assert.equal(params.pageSize, 1);
          return {
            elements: [{ id: calls, name: `Account ${calls}`, status: 'ACTIVE' }],
            metadata: { nextPageToken: 'more' }
          };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.data.length, 1);
    assert.equal(calls, 1);
  });

  test('throws when API request fails', async () => {
    await assert.rejects(
      () => listAccounts(
        {},
        {
          request: async () => {
            throw new Error('LinkedIn API unavailable');
          }
        }
      ),
      /LinkedIn API unavailable/
    );
  });
});
