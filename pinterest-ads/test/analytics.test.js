import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { analytics } from '../server/tools/analytics.js';
import { MOCK_ANALYTICS_RESPONSE } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

function recentDate(daysBack) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

beforeEach(() => {
  process.env.PINTEREST_ADS_AD_ACCOUNT_ID = '549755885175';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('analytics', () => {
  test('defaults to account level with default columns and TOTAL granularity', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await analytics(
      {
        start_date: recentDate(7),
        end_date: recentDate(1)
      },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return MOCK_ANALYTICS_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(capturedPath, '/ad_accounts/549755885175/analytics');
    assert.deepEqual(capturedParams.columns, [
      'SPEND_IN_DOLLAR',
      'IMPRESSION_2',
      'CLICKTHROUGH_2',
      'CTR_2',
      'TOTAL_CONVERSIONS'
    ]);
    assert.equal(capturedParams.granularity, 'TOTAL');
  });

  test('routes campaign level to campaigns/analytics with campaign_ids', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await analytics(
      {
        level: 'campaign',
        campaign_ids: ['626735565838', '626735565839'],
        start_date: recentDate(30),
        end_date: recentDate(1),
        granularity: 'DAY'
      },
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return MOCK_ANALYTICS_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/ad_accounts/549755885175/campaigns/analytics');
    assert.deepEqual(capturedParams.campaign_ids, ['626735565838', '626735565839']);
    assert.equal(capturedParams.granularity, 'DAY');
    assert.equal(body.metadata.level, 'campaign');
  });

  test('routes ad_group and ad levels to their endpoints', async () => {
    const capturedPaths = [];

    const request = async (path) => {
      capturedPaths.push(path);
      return [];
    };

    await analytics(
      {
        level: 'ad_group',
        ad_group_ids: '777',
        start_date: recentDate(7),
        end_date: recentDate(1)
      },
      { request }
    );
    await analytics(
      {
        level: 'ad',
        ad_ids: '888',
        start_date: recentDate(7),
        end_date: recentDate(1)
      },
      { request }
    );

    assert.deepEqual(capturedPaths, [
      '/ad_accounts/549755885175/ad_groups/analytics',
      '/ad_accounts/549755885175/ads/analytics'
    ]);
  });

  test('accepts custom columns as comma-separated string and uppercases them', async () => {
    let capturedParams = null;

    await analytics(
      {
        start_date: recentDate(7),
        end_date: recentDate(1),
        columns: 'spend_in_dollar, total_engagement'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return [];
        }
      }
    );

    assert.deepEqual(capturedParams.columns, ['SPEND_IN_DOLLAR', 'TOTAL_ENGAGEMENT']);
  });

  test('passes optional attribution and timezone params through', async () => {
    let capturedParams = null;

    await analytics(
      {
        start_date: recentDate(7),
        end_date: recentDate(1),
        click_window_days: 14,
        engagement_window_days: 7,
        view_window_days: 1,
        conversion_report_time: 'TIME_OF_CONVERSION',
        reporting_timezone: 'AD_ACCOUNT_TIME_ZONE'
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return [];
        }
      }
    );

    assert.equal(capturedParams.click_window_days, '14');
    assert.equal(capturedParams.engagement_window_days, '7');
    assert.equal(capturedParams.view_window_days, '1');
    assert.equal(capturedParams.conversion_report_time, 'TIME_OF_CONVERSION');
    assert.equal(capturedParams.reporting_timezone, 'AD_ACCOUNT_TIME_ZONE');
  });

  test('rejects invalid attribution window values', async () => {
    await assert.rejects(
      () => analytics(
        {
          start_date: recentDate(7),
          end_date: recentDate(1),
          click_window_days: 45
        },
        { request: async () => [] }
      ),
      /Invalid click_window_days/
    );
  });

  test('requires matching ids param for entity levels', async () => {
    await assert.rejects(
      () => analytics(
        {
          level: 'campaign',
          start_date: recentDate(7),
          end_date: recentDate(1)
        },
        { request: async () => [] }
      ),
      /campaign_ids is required for level "campaign"/
    );
  });

  test('requires start_date and end_date', async () => {
    await assert.rejects(
      () => analytics({}, { request: async () => [] }),
      /Missing required parameters: start_date, end_date/
    );
  });

  test('rejects malformed dates', async () => {
    await assert.rejects(
      () => analytics(
        { start_date: '06/01/2026', end_date: recentDate(1) },
        { request: async () => [] }
      ),
      /Invalid start_date date format/
    );
  });

  test('rejects start_date more than 90 days back', async () => {
    await assert.rejects(
      () => analytics(
        { start_date: recentDate(120), end_date: recentDate(1) },
        { request: async () => [] }
      ),
      /cannot be more than 90 days back/
    );
  });

  test('rejects invalid granularity', async () => {
    await assert.rejects(
      () => analytics(
        {
          start_date: recentDate(7),
          end_date: recentDate(1),
          granularity: 'QUARTER'
        },
        { request: async () => [] }
      ),
      /Invalid granularity/
    );
  });

  test('rejects invalid level', async () => {
    await assert.rejects(
      () => analytics(
        {
          level: 'keyword',
          start_date: recentDate(7),
          end_date: recentDate(1)
        },
        { request: async () => [] }
      ),
      /Invalid level/
    );
  });
});
