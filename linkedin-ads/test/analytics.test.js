import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { analytics, DEFAULT_ANALYTICS_FIELDS } from '../server/tools/analytics.js';
import { isRawParam } from '../server/utils/restli.js';
import { MOCK_ANALYTICS_RESPONSE } from './fixtures.js';

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

describe('analytics', () => {
  test('builds the q=analytics request with defaults scoped to the account', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await analytics(
      {
        pivot: 'CAMPAIGN',
        start: '2026-06-01',
        end: '2026-06-30'
      },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return MOCK_ANALYTICS_RESPONSE;
        }
      }
    );

    assert.equal(capturedPath, '/adAnalytics');
    assert.equal(capturedParams.q, 'analytics');
    assert.equal(capturedParams.pivot, 'CAMPAIGN');
    assert.equal(capturedParams.timeGranularity, 'ALL');

    assert.ok(isRawParam(capturedParams.dateRange));
    assert.equal(
      capturedParams.dateRange.value,
      '(start:(year:2026,month:6,day:1),end:(year:2026,month:6,day:30))'
    );

    assert.deepEqual(capturedParams.accounts, ['urn:li:sponsoredAccount:512345678']);

    assert.ok(isRawParam(capturedParams.fields));
    assert.equal(capturedParams.fields.value, DEFAULT_ANALYTICS_FIELDS.join(','));

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].impressions, 10000);
    assert.match(body.metadata.paginationNote, /does not support pagination/);
  });

  test('builds campaign URN list from plain entity ids', async () => {
    let capturedParams = null;

    await analytics(
      {
        pivot: 'CREATIVE',
        start: '2026-06-01',
        time_granularity: 'daily',
        entity_type: 'campaign',
        entity_ids: ['1001', 'urn:li:sponsoredCampaign:1002']
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedParams.timeGranularity, 'DAILY');
    assert.deepEqual(capturedParams.campaigns, [
      'urn:li:sponsoredCampaign:1001',
      'urn:li:sponsoredCampaign:1002'
    ]);
    assert.equal(capturedParams.accounts, undefined);
  });

  test('uses the campaignGroups facet for campaign_group entity type', async () => {
    let capturedParams = null;

    await analytics(
      {
        pivot: 'CAMPAIGN_GROUP',
        start: '2026-06-01',
        entity_type: 'campaign_group',
        entity_ids: ['601']
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.deepEqual(capturedParams.campaignGroups, ['urn:li:sponsoredCampaignGroup:601']);
  });

  test('omits end from dateRange when not provided', async () => {
    let capturedParams = null;

    await analytics(
      {
        pivot: 'ACCOUNT',
        start: '2026-06-01'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedParams.dateRange.value, '(start:(year:2026,month:6,day:1))');
  });

  test('accepts custom fields as string or array', async () => {
    let capturedParams = null;

    await analytics(
      {
        pivot: 'CAMPAIGN',
        start: '2026-06-01',
        fields: 'impressions, clicks ,pivotValues'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return { elements: [] };
        }
      }
    );

    assert.equal(capturedParams.fields.value, 'impressions,clicks,pivotValues');
  });

  test('rejects more than 20 metric fields', async () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => `metricField${index}`);

    await assert.rejects(
      () => analytics(
        {
          pivot: 'CAMPAIGN',
          start: '2026-06-01',
          fields: [...tooMany, 'dateRange', 'pivotValues']
        },
        { request: async () => ({ elements: [] }) }
      ),
      /Too many metric fields: 21/
    );
  });

  test('allows 20 metrics plus dimensional fields', async () => {
    const exactlyTwenty = Array.from({ length: 20 }, (_, index) => `metricField${index}`);

    const result = await analytics(
      {
        pivot: 'CAMPAIGN',
        start: '2026-06-01',
        fields: [...exactlyTwenty, 'dateRange', 'pivotValues']
      },
      { request: async () => ({ elements: [] }) }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
  });

  test('rejects invalid field names', async () => {
    await assert.rejects(
      () => analytics(
        {
          pivot: 'CAMPAIGN',
          start: '2026-06-01',
          fields: ['impressions', 'drop table']
        },
        { request: async () => ({ elements: [] }) }
      ),
      /Invalid analytics field name/
    );
  });

  test('rejects invalid pivot, granularity, and dates', async () => {
    const request = async () => ({ elements: [] });

    await assert.rejects(
      () => analytics({ pivot: 'MEMBER_COMPANY', start: '2026-06-01' }, { request }),
      /Invalid pivot/
    );

    await assert.rejects(
      () => analytics({ pivot: 'CAMPAIGN', start: '2026-06-01', time_granularity: 'WEEKLY' }, { request }),
      /Invalid time_granularity/
    );

    await assert.rejects(
      () => analytics({ pivot: 'CAMPAIGN', start: '06-01-2026' }, { request }),
      /Expected YYYY-MM-DD/
    );
  });

  test('requires pivot and start', async () => {
    await assert.rejects(
      () => analytics({}, { request: async () => ({ elements: [] }) }),
      /Missing required parameters: pivot, start/
    );
  });

  test('requires entity_ids for non-account entity types', async () => {
    await assert.rejects(
      () => analytics(
        { pivot: 'CAMPAIGN', start: '2026-06-01', entity_type: 'campaign' },
        { request: async () => ({ elements: [] }) }
      ),
      /entity_ids is required when entity_type is campaign/
    );
  });
});
