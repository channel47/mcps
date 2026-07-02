import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { query } from '../server/tools/query.js';
import { isRawParam } from '../server/utils/restli.js';
import {
  MOCK_QUERY_CAMPAIGNS_PAGE_1,
  MOCK_QUERY_CAMPAIGNS_PAGE_2,
  MOCK_CREATIVES_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.LINKEDIN_ADS_ACCOUNT_ID = '512345678';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('query', () => {
  test('queries campaigns via the search finder with env account fallback', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await query(
      { entity: 'campaigns' },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/adAccounts/512345678/adCampaigns');
    assert.equal(capturedParams.q, 'search');
    assert.equal(capturedParams.search, undefined);
    assert.equal(body.metadata.accountId, '512345678');
  });

  test('normalizes sponsoredAccount URN account ids', async () => {
    let capturedPath = null;

    await query(
      {
        account_id: 'urn:li:sponsoredAccount:99',
        entity: 'campaign_groups'
      },
      {
        request: async (path) => {
          capturedPath = path;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedPath, '/adAccounts/99/adCampaignGroups');
  });

  test('builds status search filter for campaigns', async () => {
    let capturedParams = null;

    await query(
      {
        entity: 'campaigns',
        status: ['active', 'PAUSED']
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.ok(isRawParam(capturedParams.search));
    assert.equal(capturedParams.search.value, '(status:(values:List(ACTIVE,PAUSED)))');
  });

  test('queries creatives via the criteria finder with intendedStatuses and campaign URNs', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await query(
      {
        entity: 'creatives',
        status: 'ACTIVE',
        campaign_ids: ['1001', 'urn:li:sponsoredCampaign:1002']
      },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return MOCK_CREATIVES_RESPONSE;
        }
      }
    );

    assert.equal(capturedPath, '/adAccounts/512345678/creatives');
    assert.equal(capturedParams.q, 'criteria');
    assert.deepEqual(capturedParams.intendedStatuses, ['ACTIVE']);
    assert.deepEqual(capturedParams.campaigns, [
      'urn:li:sponsoredCampaign:1001',
      'urn:li:sponsoredCampaign:1002'
    ]);

    const body = parseResult(result);
    assert.equal(body.data[0].id, 'urn:li:sponsoredCreative:301');
  });

  test('caps creatives pageSize at 100', async () => {
    let capturedParams = null;

    await query(
      {
        entity: 'creatives',
        limit: 500
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedParams.pageSize, 100);
  });

  test('handles pageToken pagination up to requested limit', async () => {
    let calls = 0;

    const result = await query(
      {
        account_id: '512345678',
        entity: 'campaigns',
        limit: 3
      },
      {
        request: async (_path, params) => {
          calls += 1;
          if (params.pageToken === 'token_page_2') {
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
    assert.equal(body.metadata.returned, 3);
  });

  test('stops paginating once the limit is satisfied', async () => {
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

  test('rejects unsupported entities', async () => {
    await assert.rejects(
      () => query({ entity: 'audiences' }, { request: async () => ({ elements: [] }) }),
      /Invalid entity: audiences/
    );
  });

  test('rejects invalid status for entity', async () => {
    await assert.rejects(
      () => query(
        { entity: 'campaigns', status: 'ENABLED' },
        { request: async () => ({ elements: [] }) }
      ),
      /Invalid status: ENABLED/
    );
  });

  test('requires an account id from params or environment', async () => {
    delete process.env.LINKEDIN_ADS_ACCOUNT_ID;

    await assert.rejects(
      () => query({ entity: 'campaigns' }, { request: async () => ({ elements: [] }) }),
      /account_id parameter or LINKEDIN_ADS_ACCOUNT_ID/
    );
  });
});
