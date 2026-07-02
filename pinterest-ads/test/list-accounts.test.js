import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listAccounts } from '../server/tools/list-accounts.js';
import { MOCK_LIST_ACCOUNTS_PAGE_1, MOCK_LIST_ACCOUNTS_PAGE_2 } from './fixtures.js';

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

describe('listAccounts', () => {
  test('lists and normalizes account data', async () => {
    const result = await listAccounts(
      {},
      {
        request: async (_path, params) => (
          params.bookmark === 'account_cursor_2' ? MOCK_LIST_ACCOUNTS_PAGE_2 : MOCK_LIST_ACCOUNTS_PAGE_1
        )
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);

    const first = body.data[0];
    assert.equal(first.id, '549755885175');
    assert.equal(first.name, 'Primary Pinterest Account');
    assert.equal(first.currency, 'USD');
    assert.equal(first.country, 'US');
    assert.equal(first.owner_username, 'channel47');
  });

  test('follows bookmark pagination and aggregates all account pages', async () => {
    const seenParams = [];

    const result = await listAccounts(
      {},
      {
        request: async (path, params) => {
          assert.equal(path, '/ad_accounts');
          seenParams.push(params);
          return params.bookmark === 'account_cursor_2' ? MOCK_LIST_ACCOUNTS_PAGE_2 : MOCK_LIST_ACCOUNTS_PAGE_1;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.totalAccounts, 2);
    assert.equal(seenParams.length, 2);
    assert.equal(seenParams[0].bookmark, undefined);
    assert.equal(seenParams[0].page_size, '250');
    assert.equal(seenParams[1].bookmark, 'account_cursor_2');
  });

  test('passes include_shared_accounts through when provided', async () => {
    let capturedParams = null;

    await listAccounts(
      { include_shared_accounts: false },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { items: [], bookmark: null };
        }
      }
    );

    assert.equal(capturedParams.include_shared_accounts, 'false');
  });

  test('omits include_shared_accounts by default', async () => {
    let capturedParams = null;

    await listAccounts(
      {},
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { items: [], bookmark: null };
        }
      }
    );

    assert.equal(capturedParams.include_shared_accounts, undefined);
  });

  test('throws when API request fails', async () => {
    await assert.rejects(
      () => listAccounts(
        {},
        {
          request: async () => {
            throw new Error('Pinterest API unavailable');
          }
        }
      ),
      /Pinterest API unavailable/
    );
  });
});
