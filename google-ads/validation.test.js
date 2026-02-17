import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateRequired, validateEnum, validateDateRange, blockMutations } from './server/utils/validation.js';

describe('validateRequired', () => {
  test('passes with all required fields', () => {
    assert.doesNotThrow(() => {
      validateRequired({ a: 'value', b: 123 }, ['a', 'b']);
    });
  });

  test('throws on missing field', () => {
    assert.throws(
      () => validateRequired({ a: 'value' }, ['a', 'b']),
      /Missing required parameter.*b/
    );
  });

  test('throws on empty string', () => {
    assert.throws(
      () => validateRequired({ a: '' }, ['a']),
      /Missing required parameter.*a/
    );
  });

  test('throws on null', () => {
    assert.throws(
      () => validateRequired({ a: null }, ['a']),
      /Missing required parameter/
    );
  });
});

describe('validateEnum', () => {
  test('passes with valid value', () => {
    assert.doesNotThrow(() => {
      validateEnum('ENABLED', ['ENABLED', 'PAUSED', 'REMOVED'], 'status');
    });
  });

  test('throws on invalid value', () => {
    assert.throws(
      () => validateEnum('INVALID', ['ENABLED', 'PAUSED'], 'status'),
      /Invalid status.*INVALID.*Allowed values/
    );
  });
});

describe('validateDateRange', () => {
  test('returns dates for LAST_7_DAYS', () => {
    const result = validateDateRange('LAST_7_DAYS');
    assert.ok(result.start);
    assert.ok(result.end);
    assert.match(result.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(result.end, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('returns dates for LAST_30_DAYS', () => {
    const result = validateDateRange('LAST_30_DAYS');
    const start = new Date(result.start);
    const end = new Date(result.end);
    const diff = (end - start) / (1000 * 60 * 60 * 24);
    assert.ok(diff >= 29 && diff <= 31);
  });

  test('throws on invalid range', () => {
    assert.throws(
      () => validateDateRange('INVALID_RANGE'),
      /Invalid date_range/
    );
  });

  test('CUSTOM requires start and end dates', () => {
    assert.throws(
      () => validateDateRange('CUSTOM'),
      /start_date and end_date required/
    );
  });

  test('CUSTOM works with dates', () => {
    const result = validateDateRange('CUSTOM', '2024-01-01', '2024-01-31');
    assert.strictEqual(result.start, '2024-01-01');
    assert.strictEqual(result.end, '2024-01-31');
  });
});

describe('blockMutations', () => {
  test('allows SELECT queries', () => {
    assert.doesNotThrow(() => {
      blockMutations('SELECT campaign.id FROM campaign');
    });
  });

  test('blocks CREATE', () => {
    assert.throws(
      () => blockMutations('CREATE campaign'),
      /Mutation operations not allowed.*create/
    );
  });

  test('blocks UPDATE', () => {
    assert.throws(
      () => blockMutations('UPDATE campaign SET status'),
      /Mutation operations not allowed.*update/
    );
  });

  test('blocks DELETE', () => {
    assert.throws(
      () => blockMutations('DELETE FROM campaign'),
      /Mutation operations not allowed.*delete/
    );
  });

  test('blocks MUTATE', () => {
    assert.throws(
      () => blockMutations('MUTATE campaign'),
      /Mutation operations not allowed.*mutate/
    );
  });

  test('case insensitive blocking', () => {
    assert.throws(
      () => blockMutations('select * from campaign; DELETE all'),
      /Mutation operations not allowed/
    );
  });
});
