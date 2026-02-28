import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { query } from '../server/tools/query.js';
import {
  MOCK_QUERY_CAMPAIGNS_PAGE_1,
  MOCK_QUERY_CAMPAIGNS_PAGE_2,
  MOCK_INSIGHTS_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.META_ADS_ACCOUNT_ID = '1234567890';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('query', () => {
  test('queries campaigns with default fields and normalized account id', async () => {
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
          return { data: [] };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/act_1234567890/campaigns');
    assert.match(capturedParams.fields, /objective/);
  });

  test('handles cursor-based pagination up to requested limit', async () => {
    let calls = 0;

    const result = await query(
      {
        account_id: 'act_1234567890',
        entity: 'campaigns',
        limit: 3
      },
      {
        request: async (_path, params) => {
          calls += 1;
          if (params.after === 'cursor_page_2') {
            return MOCK_QUERY_CAMPAIGNS_PAGE_2;
          }
          return MOCK_QUERY_CAMPAIGNS_PAGE_1;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 3);
    assert.equal(calls, 2);
  });

  test('builds insights time_range from preset', async () => {
    let capturedParams = null;

    const result = await query(
      {
        account_id: '1234567890',
        entity: 'insights',
        date_range: 'yesterday',
        level: 'campaign',
        time_increment: 1
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return MOCK_INSIGHTS_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(capturedParams.level, 'campaign');
    assert.equal(capturedParams.time_increment, '1');

    const timeRange = JSON.parse(capturedParams.time_range);
    assert.ok(timeRange.since);
    assert.ok(timeRange.until);
  });

  test('serializes filters and sort params', async () => {
    let capturedParams = null;

    await query(
      {
        account_id: '1234567890',
        entity: 'adsets',
        filters: [{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }],
        sort: 'name_ascending'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { data: [] };
        }
      }
    );

    assert.equal(capturedParams.sort, 'name_ascending');
    assert.equal(
      capturedParams.filtering,
      JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }])
    );
  });

  test('caps requested limit at 1000', async () => {
    let capturedParams = null;

    await query(
      {
        account_id: '1234567890',
        entity: 'campaigns',
        limit: 5000
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { data: [] };
        }
      }
    );

    assert.equal(capturedParams.limit, '1000');
  });

  test('throws on unsupported entity', async () => {
    await assert.rejects(
      () => query({ account_id: '123', entity: 'keywords' }, { request: async () => ({ data: [] }) }),
      /Invalid entity/
    );
  });

  test('throws when account id is missing', async () => {
    delete process.env.META_ADS_ACCOUNT_ID;

    await assert.rejects(
      () => query({ entity: 'campaigns' }, { request: async () => ({ data: [] }) }),
      /META_ADS_ACCOUNT_ID/
    );
  });
});
