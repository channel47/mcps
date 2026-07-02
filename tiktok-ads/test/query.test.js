import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { query } from '../server/tools/query.js';
import {
  MOCK_QUERY_CAMPAIGNS_PAGE_1,
  MOCK_QUERY_CAMPAIGNS_PAGE_2
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.TIKTOK_ADS_ADVERTISER_ID = '7000000000000000001';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('query', () => {
  test('queries campaigns with default fields and env advertiser id', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await query(
      {
        entity: 'campaigns'
      },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return { code: 0, data: { list: [] } };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/campaign/get/');
    assert.equal(capturedParams.advertiser_id, '7000000000000000001');
    assert.ok(capturedParams.fields.includes('campaign_id'));
    assert.ok(capturedParams.fields.includes('objective_type'));
    assert.equal(capturedParams.page, 1);
  });

  test('routes adgroups and ads entities to their endpoints', async () => {
    const paths = [];
    const requestMock = {
      request: async (path) => {
        paths.push(path);
        return { code: 0, data: { list: [] } };
      }
    };

    await query({ entity: 'adgroups' }, requestMock);
    await query({ entity: 'ads' }, requestMock);

    assert.deepEqual(paths, ['/adgroup/get/', '/ad/get/']);
  });

  test('handles page-based pagination up to requested limit', async () => {
    const seenPages = [];

    const result = await query(
      {
        advertiser_id: '7000000000000000001',
        entity: 'campaigns',
        limit: 3
      },
      {
        request: async (_path, params) => {
          seenPages.push(params.page);
          if (params.page === 2) {
            return MOCK_QUERY_CAMPAIGNS_PAGE_2;
          }
          return MOCK_QUERY_CAMPAIGNS_PAGE_1;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 3);
    assert.deepEqual(seenPages, [1, 2]);
    assert.equal(body.data[2].campaign_id, '1003');
  });

  test('stops paginating once limit is satisfied', async () => {
    let calls = 0;

    const result = await query(
      {
        entity: 'campaigns',
        limit: 2
      },
      {
        request: async () => {
          calls += 1;
          return MOCK_QUERY_CAMPAIGNS_PAGE_1;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.data.length, 2);
    assert.equal(calls, 1);
  });

  test('caps page_size at 1000', async () => {
    let capturedParams = null;

    await query(
      {
        entity: 'campaigns',
        limit: 5000
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { code: 0, data: { list: [] } };
        }
      }
    );

    assert.equal(capturedParams.page_size, 1000);
  });

  test('passes filtering object through untouched', async () => {
    let capturedParams = null;
    const filtering = { campaign_ids: ['1001'], primary_status: 'STATUS_DELIVERY_OK' };

    await query(
      {
        entity: 'campaigns',
        filtering
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { code: 0, data: { list: [] } };
        }
      }
    );

    assert.deepEqual(capturedParams.filtering, filtering);
  });

  test('accepts custom fields as comma-separated string', async () => {
    let capturedParams = null;

    await query(
      {
        entity: 'ads',
        fields: 'ad_id, ad_name'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { code: 0, data: { list: [] } };
        }
      }
    );

    assert.deepEqual(capturedParams.fields, ['ad_id', 'ad_name']);
  });

  test('rejects non-object filtering', async () => {
    await assert.rejects(
      () => query(
        { entity: 'campaigns', filtering: ['not-an-object'] },
        { request: async () => ({ code: 0, data: { list: [] } }) }
      ),
      /filtering must be an object/
    );
  });

  test('throws on unsupported entity', async () => {
    await assert.rejects(
      () => query({ entity: 'keywords' }, { request: async () => ({ code: 0, data: { list: [] } }) }),
      /Invalid entity/
    );
  });

  test('throws when advertiser id is missing', async () => {
    delete process.env.TIKTOK_ADS_ADVERTISER_ID;

    await assert.rejects(
      () => query({ entity: 'campaigns' }, { request: async () => ({ code: 0, data: { list: [] } }) }),
      /TIKTOK_ADS_ADVERTISER_ID/
    );
  });
});
