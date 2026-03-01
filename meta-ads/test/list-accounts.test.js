import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listAccounts } from '../server/tools/list-accounts.js';
import { MOCK_LIST_ACCOUNTS_RESPONSE } from './fixtures.js';

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

describe('listAccounts', () => {
  test('lists and normalizes account data', async () => {
    const result = await listAccounts(
      {},
      {
        request: async () => MOCK_LIST_ACCOUNTS_RESPONSE
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);

    const first = body.data[0];
    assert.equal(first.id, '1234567890');
    assert.equal(first.status, 'ACTIVE');
    assert.equal(first.currency, 'USD');
    assert.equal(first.business_name, 'Channel47 LLC');
  });

  test('applies status filter', async () => {
    const result = await listAccounts(
      { status: 'DISABLED' },
      {
        request: async () => MOCK_LIST_ACCOUNTS_RESPONSE
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].status, 'DISABLED');
  });

  test('passes expected fields to API', async () => {
    let capturedParams = null;

    await listAccounts(
      {},
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { data: [] };
        }
      }
    );

    assert.equal(capturedParams.fields, 'id,name,account_status,currency,timezone_name,business{name}');
  });

  test('follows cursor pagination and aggregates all account pages', async () => {
    const seenParams = [];

    const result = await listAccounts(
      {},
      {
        request: async (_path, params) => {
          seenParams.push(params);

          if (params.after === 'cursor_page_2') {
            return {
              data: [
                {
                  id: 'act_2000000002',
                  name: 'Account 2',
                  account_status: 2,
                  currency: 'USD',
                  timezone_name: 'America/New_York'
                }
              ]
            };
          }

          return {
            data: [
              {
                id: 'act_1000000001',
                name: 'Account 1',
                account_status: 1,
                currency: 'USD',
                timezone_name: 'America/New_York'
              }
            ],
            paging: {
              cursors: {
                after: 'cursor_page_2'
              }
            }
          };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(seenParams.length, 2);
    assert.equal(seenParams[0].after, undefined);
    assert.equal(seenParams[1].after, 'cursor_page_2');
  });

  test('throws when API request fails', async () => {
    await assert.rejects(
      () => listAccounts(
        {},
        {
          request: async () => {
            throw new Error('Meta API unavailable');
          }
        }
      ),
      /Meta API unavailable/
    );
  });
});
