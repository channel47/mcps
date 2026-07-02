import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listAccounts } from '../server/tools/list-accounts.js';
import {
  MOCK_OAUTH_ADVERTISERS_RESPONSE,
  MOCK_ADVERTISER_INFO_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  delete process.env.TIKTOK_ADS_APP_ID;
  delete process.env.TIKTOK_ADS_APP_SECRET;
  delete process.env.TIKTOK_ADS_ADVERTISER_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('listAccounts', () => {
  test('discovers advertisers via oauth2 when app credentials are configured', async () => {
    process.env.TIKTOK_ADS_APP_ID = 'app-1';
    process.env.TIKTOK_ADS_APP_SECRET = 'secret-1';

    const calls = [];
    const result = await listAccounts(
      {},
      {
        request: async (path, params) => {
          calls.push({ path, params });
          if (path === '/oauth2/advertiser/get/') {
            return MOCK_OAUTH_ADVERTISERS_RESPONSE;
          }
          return MOCK_ADVERTISER_INFO_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
    assert.equal(body.metadata.discoveredViaOauth, true);

    assert.equal(calls[0].path, '/oauth2/advertiser/get/');
    assert.deepEqual(calls[0].params, { app_id: 'app-1', secret: 'secret-1' });
    assert.equal(calls[1].path, '/advertiser/info/');
    assert.deepEqual(calls[1].params.advertiser_ids, ['7000000000000000001', '7000000000000000002']);

    const first = body.data[0];
    assert.equal(first.advertiser_id, '7000000000000000001');
    assert.equal(first.name, 'Primary TikTok Account');
    assert.equal(first.status, 'STATUS_ENABLE');
    assert.equal(first.currency, 'USD');
    assert.equal(first.timezone, 'America/Los_Angeles');
    assert.equal(first.company, 'Channel47 LLC');
  });

  test('requests expected advertiser info fields', async () => {
    let capturedFields = null;

    await listAccounts(
      { advertiser_ids: ['7000000000000000001'] },
      {
        request: async (_path, params) => {
          capturedFields = params.fields;
          return MOCK_ADVERTISER_INFO_RESPONSE;
        }
      }
    );

    assert.deepEqual(capturedFields, [
      'advertiser_id',
      'name',
      'status',
      'currency',
      'timezone',
      'company',
      'country',
      'create_time'
    ]);
  });

  test('uses explicit advertiser_ids param and skips oauth2 discovery', async () => {
    process.env.TIKTOK_ADS_APP_ID = 'app-1';
    process.env.TIKTOK_ADS_APP_SECRET = 'secret-1';

    const paths = [];
    const result = await listAccounts(
      { advertiser_ids: ['7000000000000000001'] },
      {
        request: async (path) => {
          paths.push(path);
          return MOCK_ADVERTISER_INFO_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.deepEqual(paths, ['/advertiser/info/']);
    assert.equal(body.metadata.discoveredViaOauth, false);
  });

  test('falls back to TIKTOK_ADS_ADVERTISER_ID without app credentials', async () => {
    process.env.TIKTOK_ADS_ADVERTISER_ID = '7000000000000000009';

    let capturedIds = null;
    await listAccounts(
      {},
      {
        request: async (_path, params) => {
          capturedIds = params.advertiser_ids;
          return { code: 0, message: 'OK', data: { list: [] } };
        }
      }
    );

    assert.deepEqual(capturedIds, ['7000000000000000009']);
  });

  test('chunks advertiser info lookups into batches of 100', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `70000000000000${String(index).padStart(4, '0')}`);
    const batches = [];

    await listAccounts(
      { advertiser_ids: ids },
      {
        request: async (_path, params) => {
          batches.push(params.advertiser_ids.length);
          return { code: 0, message: 'OK', data: { list: [] } };
        }
      }
    );

    assert.deepEqual(batches, [100, 50]);
  });

  test('throws clear error when no advertiser id source is configured', async () => {
    await assert.rejects(
      () => listAccounts({}, { request: async () => ({ code: 0, data: { list: [] } }) }),
      /advertiser_ids.*TIKTOK_ADS_ADVERTISER_ID.*TIKTOK_ADS_APP_ID/s
    );
  });

  test('throws when API request fails', async () => {
    await assert.rejects(
      () => listAccounts(
        { advertiser_ids: ['7000000000000000001'] },
        {
          request: async () => {
            throw new Error('TikTok API unavailable');
          }
        }
      ),
      /TikTok API unavailable/
    );
  });
});
