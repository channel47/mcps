import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYTICS_LEVELS,
  DEFAULT_ANALYTICS_COLUMNS,
  GRANULARITIES,
  SUPPORTED_ANALYTICS_LEVELS,
  resolveColumns,
  resolveGranularity,
  validateDateRange
} from '../server/utils/analytics-params.js';

describe('analytics level and granularity constants', () => {
  test('exposes all supported levels with correct endpoint mapping', () => {
    assert.deepEqual(SUPPORTED_ANALYTICS_LEVELS, ['account', 'campaign', 'ad_group', 'ad']);
    assert.equal(ANALYTICS_LEVELS.account.pathSuffix, '/analytics');
    assert.equal(ANALYTICS_LEVELS.account.idsParam, null);
    assert.equal(ANALYTICS_LEVELS.campaign.pathSuffix, '/campaigns/analytics');
    assert.equal(ANALYTICS_LEVELS.campaign.idsParam, 'campaign_ids');
    assert.equal(ANALYTICS_LEVELS.ad_group.idsParam, 'ad_group_ids');
    assert.equal(ANALYTICS_LEVELS.ad.idsParam, 'ad_ids');
  });

  test('exposes Pinterest granularity values', () => {
    assert.deepEqual(GRANULARITIES, ['TOTAL', 'DAY', 'HOUR', 'WEEK', 'MONTH']);
  });
});

describe('validateDateRange', () => {
  const NOW = new Date('2026-07-02T12:00:00.000Z');

  test('accepts a valid range', () => {
    const result = validateDateRange('2026-06-01', '2026-06-30', NOW);
    assert.deepEqual(result, { startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  test('accepts a range starting exactly 90 days back', () => {
    const result = validateDateRange('2026-04-03', '2026-04-10', NOW);
    assert.equal(result.startDate, '2026-04-03');
  });

  test('rejects start after end', () => {
    assert.throws(
      () => validateDateRange('2026-06-30', '2026-06-01', NOW),
      /must not be after end_date/
    );
  });

  test('rejects start more than 90 days back', () => {
    assert.throws(
      () => validateDateRange('2026-04-02', '2026-04-10', NOW),
      /cannot be more than 90 days back/
    );
  });

  test('rejects ranges longer than 90 days', () => {
    assert.throws(
      () => validateDateRange('2026-04-03', '2026-07-15', NOW),
      /Date range exceeds 90 days/
    );
  });

  test('rejects malformed dates', () => {
    assert.throws(
      () => validateDateRange('20260601', '2026-06-30', NOW),
      /Invalid start_date date format/
    );
    assert.throws(
      () => validateDateRange('2026-06-01', 'June 30', NOW),
      /Invalid end_date date format/
    );
  });
});

describe('resolveColumns', () => {
  test('returns defaults when columns omitted', () => {
    assert.deepEqual(resolveColumns(undefined), DEFAULT_ANALYTICS_COLUMNS);
    assert.deepEqual(resolveColumns([]), DEFAULT_ANALYTICS_COLUMNS);
    assert.deepEqual(resolveColumns(''), DEFAULT_ANALYTICS_COLUMNS);
  });

  test('normalizes arrays and comma-separated strings to uppercase', () => {
    assert.deepEqual(resolveColumns(['spend_in_dollar', 'CTR_2']), ['SPEND_IN_DOLLAR', 'CTR_2']);
    assert.deepEqual(resolveColumns('impression_2, ctr_2'), ['IMPRESSION_2', 'CTR_2']);
  });
});

describe('resolveGranularity', () => {
  test('defaults to TOTAL', () => {
    assert.equal(resolveGranularity(undefined), 'TOTAL');
    assert.equal(resolveGranularity(''), 'TOTAL');
  });

  test('normalizes case', () => {
    assert.equal(resolveGranularity('day'), 'DAY');
  });

  test('throws on unsupported granularity', () => {
    assert.throws(
      () => resolveGranularity('YEARLY'),
      /Invalid granularity/
    );
  });
});
