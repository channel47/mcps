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
  process.env.PINTEREST_ADS_AD_ACCOUNT_ID = '549755885175';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('query', () => {
  test('queries campaigns using account id from environment', async () => {
    let capturedPath = null;

    const result = await query(
      {
        entity: 'campaigns'
      },
      {
        request: async (path) => {
          capturedPath = path;
          return { items: [], bookmark: null };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/ad_accounts/549755885175/campaigns');
    assert.equal(body.metadata.entity, 'campaigns');
  });

  test('handles bookmark pagination up to requested limit', async () => {
    let calls = 0;

    const result = await query(
      {
        ad_account_id: '549755885175',
        entity: 'campaigns',
        limit: 3
      },
      {
        request: async (_path, params) => {
          calls += 1;
          if (params.bookmark === 'campaign_cursor_2') {
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

  test('stops paginating once the requested limit is satisfied', async () => {
    let calls = 0;

    const result = await query(
      {
        ad_account_id: '549755885175',
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

  test('caps page_size at 250 and clamps limit to 1000', async () => {
    let capturedParams = null;

    const result = await query(
      {
        ad_account_id: '549755885175',
        entity: 'campaigns',
        limit: 5000
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { items: [], bookmark: null };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(capturedParams.page_size, '250');
    assert.equal(body.metadata.limit, 1000);
  });

  test('passes entity_statuses, order, and id filters', async () => {
    let capturedParams = null;

    await query(
      {
        ad_account_id: '549755885175',
        entity: 'ads',
        entity_statuses: ['active', 'archived'],
        order: 'descending',
        campaign_ids: '111,222',
        ad_group_ids: ['333'],
        ad_ids: ['444', '555']
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { items: [], bookmark: null };
        }
      }
    );

    assert.deepEqual(capturedParams.entity_statuses, ['ACTIVE', 'ARCHIVED']);
    assert.equal(capturedParams.order, 'DESCENDING');
    assert.deepEqual(capturedParams.campaign_ids, ['111', '222']);
    assert.deepEqual(capturedParams.ad_group_ids, ['333']);
    assert.deepEqual(capturedParams.ad_ids, ['444', '555']);
  });

  test('rejects id filters unsupported by the entity', async () => {
    await assert.rejects(
      () => query(
        {
          ad_account_id: '549755885175',
          entity: 'campaigns',
          ad_ids: ['444']
        },
        { request: async () => ({ items: [], bookmark: null }) }
      ),
      /ad_ids is not supported for entity "campaigns"/
    );
  });

  test('rejects invalid entity_statuses values', async () => {
    await assert.rejects(
      () => query(
        {
          ad_account_id: '549755885175',
          entity: 'campaigns',
          entity_statuses: ['RUNNING']
        },
        { request: async () => ({ items: [], bookmark: null }) }
      ),
      /Invalid entity_statuses/
    );
  });

  test('throws on unsupported entity', async () => {
    await assert.rejects(
      () => query({ ad_account_id: '123', entity: 'keywords' }, { request: async () => ({ items: [] }) }),
      /Invalid entity/
    );
  });

  test('throws when ad account id is missing', async () => {
    delete process.env.PINTEREST_ADS_AD_ACCOUNT_ID;

    await assert.rejects(
      () => query({ entity: 'campaigns' }, { request: async () => ({ items: [] }) }),
      /PINTEREST_ADS_AD_ACCOUNT_ID/
    );
  });
});
