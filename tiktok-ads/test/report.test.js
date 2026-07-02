import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { report, DEFAULT_METRICS } from '../server/tools/report.js';
import { MOCK_REPORT_RESPONSE } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };
const FIXED_NOW = new Date('2026-07-01T12:00:00Z');

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.TIKTOK_ADS_ADVERTISER_ID = '7000000000000000001';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('report', () => {
  test('applies BASIC/AUCTION_CAMPAIGN defaults with trailing 7-day window', async () => {
    let capturedPath = null;
    let capturedParams = null;

    const result = await report(
      {},
      {
        request: async (path, params) => {
          capturedPath = path;
          capturedParams = params;
          return MOCK_REPORT_RESPONSE;
        }
      },
      FIXED_NOW
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(capturedPath, '/report/integrated/get/');
    assert.equal(capturedParams.advertiser_id, '7000000000000000001');
    assert.equal(capturedParams.report_type, 'BASIC');
    assert.equal(capturedParams.data_level, 'AUCTION_CAMPAIGN');
    assert.deepEqual(capturedParams.dimensions, ['campaign_id', 'stat_time_day']);
    assert.deepEqual(capturedParams.metrics, DEFAULT_METRICS);
    assert.equal(capturedParams.start_date, '2026-06-25');
    assert.equal(capturedParams.end_date, '2026-07-01');
    assert.equal(capturedParams.query_lifetime, undefined);
  });

  test('flattens dimensions and metrics into single row objects', async () => {
    const result = await report(
      {},
      {
        request: async () => MOCK_REPORT_RESPONSE
      },
      FIXED_NOW
    );

    const body = parseResult(result);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].campaign_id, '1001');
    assert.equal(body.data[0].spend, '145.44');
    assert.equal(body.data[0].conversion, '12');
  });

  test('derives id dimension from data_level', async () => {
    let capturedParams = null;

    await report(
      { data_level: 'AUCTION_AD' },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return MOCK_REPORT_RESPONSE;
        }
      },
      FIXED_NOW
    );

    assert.deepEqual(capturedParams.dimensions, ['ad_id', 'stat_time_day']);
  });

  test('lifetime mode sets query_lifetime and drops date/time dimensions', async () => {
    let capturedParams = null;

    const result = await report(
      { lifetime: true, data_level: 'AUCTION_ADVERTISER' },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return MOCK_REPORT_RESPONSE;
        }
      },
      FIXED_NOW
    );

    const body = parseResult(result);
    assert.equal(capturedParams.query_lifetime, true);
    assert.equal(capturedParams.start_date, undefined);
    assert.equal(capturedParams.end_date, undefined);
    assert.deepEqual(capturedParams.dimensions, ['advertiser_id']);
    assert.equal(body.metadata.dateRange, 'lifetime');
  });

  test('passes explicit dates, filtering, and ordering through', async () => {
    let capturedParams = null;
    const filtering = [{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: '["1001"]' }];

    await report(
      {
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        filtering,
        order_field: 'spend',
        order_type: 'asc',
        metrics: ['spend', 'clicks'],
        dimensions: ['campaign_id']
      },
      {
        request: async (_path, params) => {
          capturedParams = params;
          return MOCK_REPORT_RESPONSE;
        }
      },
      FIXED_NOW
    );

    assert.equal(capturedParams.start_date, '2026-06-01');
    assert.equal(capturedParams.end_date, '2026-06-30');
    assert.deepEqual(capturedParams.filtering, filtering);
    assert.equal(capturedParams.order_field, 'spend');
    assert.equal(capturedParams.order_type, 'ASC');
    assert.deepEqual(capturedParams.metrics, ['spend', 'clicks']);
    assert.deepEqual(capturedParams.dimensions, ['campaign_id']);
  });

  test('paginates report pages up to requested limit', async () => {
    const seenPages = [];
    const pageOne = {
      code: 0,
      data: {
        list: [
          { dimensions: { campaign_id: '1' }, metrics: { spend: '1.00' } },
          { dimensions: { campaign_id: '2' }, metrics: { spend: '2.00' } }
        ],
        page_info: { page: 1, page_size: 2, total_number: 3, total_page: 2 }
      }
    };
    const pageTwo = {
      code: 0,
      data: {
        list: [{ dimensions: { campaign_id: '3' }, metrics: { spend: '3.00' } }],
        page_info: { page: 2, page_size: 2, total_number: 3, total_page: 2 }
      }
    };

    const result = await report(
      { limit: 3 },
      {
        request: async (_path, params) => {
          seenPages.push(params.page);
          return params.page === 2 ? pageTwo : pageOne;
        }
      },
      FIXED_NOW
    );

    const body = parseResult(result);
    assert.deepEqual(seenPages, [1, 2]);
    assert.equal(body.data.length, 3);
    assert.equal(body.data[2].campaign_id, '3');
  });

  test('rejects invalid report_type and data_level', async () => {
    await assert.rejects(
      () => report({ report_type: 'CATALOG' }, { request: async () => MOCK_REPORT_RESPONSE }, FIXED_NOW),
      /Invalid report_type/
    );

    await assert.rejects(
      () => report({ data_level: 'RESERVATION_AD' }, { request: async () => MOCK_REPORT_RESPONSE }, FIXED_NOW),
      /Invalid data_level/
    );
  });

  test('rejects malformed dates and half-open ranges', async () => {
    await assert.rejects(
      () => report(
        { start_date: '06/01/2026', end_date: '2026-06-30' },
        { request: async () => MOCK_REPORT_RESPONSE },
        FIXED_NOW
      ),
      /Invalid start_date format/
    );

    await assert.rejects(
      () => report(
        { start_date: '2026-06-01' },
        { request: async () => MOCK_REPORT_RESPONSE },
        FIXED_NOW
      ),
      /start_date and end_date must be provided together/
    );
  });

  test('rejects dates combined with lifetime=true', async () => {
    await assert.rejects(
      () => report(
        { lifetime: true, start_date: '2026-06-01', end_date: '2026-06-30' },
        { request: async () => MOCK_REPORT_RESPONSE },
        FIXED_NOW
      ),
      /cannot be combined with lifetime/
    );
  });

  test('throws when advertiser id is missing', async () => {
    delete process.env.TIKTOK_ADS_ADVERTISER_ID;

    await assert.rejects(
      () => report({}, { request: async () => MOCK_REPORT_RESPONSE }, FIXED_NOW),
      /TIKTOK_ADS_ADVERTISER_ID/
    );
  });
});
