import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MOCK_ACCOUNTS_RESPONSE } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_CUSTOMER_ID = '123456789';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('listAccounts', () => {
  test('formats account list response', async () => {
    const { listAccounts } = await import('../server/tools/list-accounts.js');

    const result = await listAccounts(
      {},
      {
        request: async () => MOCK_ACCOUNTS_RESPONSE
      }
    );

    const body = JSON.parse(result.content[0].text);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].id, '111111111');
    assert.equal(body.data[0].name, 'Primary Search Account');
    assert.equal(body.data[0].status, 'Active');
  });

  test('uses customer_id from params over env default', async () => {
    const { listAccounts } = await import('../server/tools/list-accounts.js');
    let capturedContext = null;

    await listAccounts(
      { customer_id: '777' },
      {
        request: async (_url, _body, context) => {
          capturedContext = context;
          return { AccountsInfo: [] };
        }
      }
    );

    assert.equal(capturedContext.customerId, '777');
  });

  test('throws when no customer id is provided', async () => {
    delete process.env.BING_ADS_CUSTOMER_ID;
    const { listAccounts } = await import('../server/tools/list-accounts.js');

    await assert.rejects(
      () => listAccounts({}, { request: async () => ({ AccountsInfo: [] }) }),
      /BING_ADS_CUSTOMER_ID/
    );
  });
});

