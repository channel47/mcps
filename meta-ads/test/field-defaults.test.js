import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTITY_FIELDS,
  SUPPORTED_ENTITIES,
  resolveInsightsDateRange
} from '../server/utils/field-defaults.js';

describe('SUPPORTED_ENTITIES', () => {
  test('includes all supported query entities', () => {
    assert.deepEqual(SUPPORTED_ENTITIES, [
      'campaigns',
      'adsets',
      'ads',
      'insights',
      'audiences',
      'creatives'
    ]);
  });
});

describe('ENTITY_FIELDS', () => {
  test('has default campaign and insights fields', () => {
    assert.ok(ENTITY_FIELDS.campaigns.includes('objective'));
    assert.ok(ENTITY_FIELDS.insights.includes('spend'));
  });
});

describe('resolveInsightsDateRange', () => {
  test('resolves last_7d preset', () => {
    const result = resolveInsightsDateRange('last_7d', new Date('2026-02-28T12:00:00.000Z'));
    assert.deepEqual(result, {
      since: '2026-02-22',
      until: '2026-02-28'
    });
  });

  test('resolves yesterday preset', () => {
    const result = resolveInsightsDateRange('yesterday', new Date('2026-02-28T12:00:00.000Z'));
    assert.deepEqual(result, {
      since: '2026-02-27',
      until: '2026-02-27'
    });
  });

  test('passes through explicit date object', () => {
    const result = resolveInsightsDateRange({ since: '2026-01-01', until: '2026-01-15' });
    assert.deepEqual(result, {
      since: '2026-01-01',
      until: '2026-01-15'
    });
  });

  test('throws on unsupported preset', () => {
    assert.throws(
      () => resolveInsightsDateRange('last_90d'),
      /Invalid date_range preset/
    );
  });
});
