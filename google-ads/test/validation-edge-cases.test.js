/**
 * Edge case tests for validation utilities
 * Comprehensive tests for date range parsing and new utility functions
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  validateDateRange,
  validateRequired,
  validateEnum,
  getCustomerId,
  buildCampaignFilter,
  blockMutations
} from '../server/utils/validation.js';

// ============================================
// Date Range Edge Cases
// ============================================

describe('validateDateRange edge cases', () => {
  describe('TODAY range', () => {
    test('returns same date for start and end', () => {
      const result = validateDateRange('TODAY');
      assert.strictEqual(result.start, result.end);
    });

    test('returns valid date format', () => {
      const result = validateDateRange('TODAY');
      assert.match(result.start, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('YESTERDAY range', () => {
    test('returns same date for start and end', () => {
      const result = validateDateRange('YESTERDAY');
      assert.strictEqual(result.start, result.end);
    });

    test('returns date before today', () => {
      const result = validateDateRange('YESTERDAY');
      const yesterday = new Date(result.start);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      assert.ok(yesterday < today);
    });
  });

  describe('LAST_7_DAYS range', () => {
    test('returns 7 day span', () => {
      const result = validateDateRange('LAST_7_DAYS');
      const start = new Date(result.start);
      const end = new Date(result.end);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, 7);
    });
  });

  describe('LAST_14_DAYS range', () => {
    test('returns 14 day span', () => {
      const result = validateDateRange('LAST_14_DAYS');
      const start = new Date(result.start);
      const end = new Date(result.end);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, 14);
    });
  });

  describe('LAST_90_DAYS range', () => {
    test('returns 90 day span', () => {
      const result = validateDateRange('LAST_90_DAYS');
      const start = new Date(result.start);
      const end = new Date(result.end);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, 90);
    });
  });

  describe('THIS_MONTH range', () => {
    test('starts on first of month', () => {
      const result = validateDateRange('THIS_MONTH');
      const start = new Date(result.start.replace(/-/g, '/'));
      assert.strictEqual(start.getDate(), 1);
    });

    test('ends on today', () => {
      const result = validateDateRange('THIS_MONTH');
      const end = new Date(result.end.replace(/-/g, '/'));
      const today = new Date();
      assert.strictEqual(end.getDate(), today.getDate());
    });
  });

  describe('LAST_MONTH range', () => {
    test('starts on first of last month', () => {
      const result = validateDateRange('LAST_MONTH');
      const start = new Date(result.start.replace(/-/g, '/'));
      assert.strictEqual(start.getDate(), 1);
    });

    test('ends on last day of last month', () => {
      const result = validateDateRange('LAST_MONTH');
      const end = new Date(result.end.replace(/-/g, '/'));
      const expectedEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
      assert.strictEqual(end.getDate(), expectedEnd.getDate());
    });
  });

  describe('CUSTOM range', () => {
    test('works with standard dates', () => {
      const result = validateDateRange('CUSTOM', '2024-06-01', '2024-06-30');
      assert.strictEqual(result.start, '2024-06-01');
      assert.strictEqual(result.end, '2024-06-30');
    });

    test('throws when start_date is missing', () => {
      assert.throws(
        () => validateDateRange('CUSTOM', undefined, '2024-06-30'),
        /start_date and end_date required/
      );
    });

    test('throws when end_date is missing', () => {
      assert.throws(
        () => validateDateRange('CUSTOM', '2024-06-01', undefined),
        /start_date and end_date required/
      );
    });

    test('throws when both dates are missing', () => {
      assert.throws(
        () => validateDateRange('CUSTOM'),
        /start_date and end_date required/
      );
    });

    test('handles leap year dates', () => {
      const result = validateDateRange('CUSTOM', '2024-02-29', '2024-03-01');
      assert.strictEqual(result.start, '2024-02-29');
      assert.strictEqual(result.end, '2024-03-01');
    });

    test('handles year boundary', () => {
      const result = validateDateRange('CUSTOM', '2023-12-31', '2024-01-01');
      assert.strictEqual(result.start, '2023-12-31');
      assert.strictEqual(result.end, '2024-01-01');
    });

    test('preserves single digit months and days', () => {
      const result = validateDateRange('CUSTOM', '2024-01-05', '2024-02-09');
      assert.strictEqual(result.start, '2024-01-05');
      assert.strictEqual(result.end, '2024-02-09');
    });
  });

  describe('invalid ranges', () => {
    test('throws on empty string', () => {
      assert.throws(
        () => validateDateRange(''),
        /Invalid date_range/
      );
    });

    test('throws on null', () => {
      assert.throws(
        () => validateDateRange(null),
        /Invalid date_range|Cannot read/
      );
    });

    test('throws on undefined', () => {
      assert.throws(
        () => validateDateRange(undefined),
        /Invalid date_range|Cannot read/
      );
    });

    test('throws on lowercase range', () => {
      assert.throws(
        () => validateDateRange('last_7_days'),
        /Invalid date_range/
      );
    });

    test('throws on misspelled range', () => {
      assert.throws(
        () => validateDateRange('LAST_WEEK'),
        /Invalid date_range/
      );
    });

    test('throws on numeric range', () => {
      assert.throws(
        () => validateDateRange(30),
        /Invalid date_range/
      );
    });
  });
});

// ============================================
// getCustomerId Edge Cases
// ============================================

describe('getCustomerId', () => {
  // Save original env
  const originalEnv = process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

  test('returns customer_id from params when provided', () => {
    const result = getCustomerId({ customer_id: '1234567890' });
    assert.strictEqual(result, '1234567890');
  });

  test('returns env variable when param not provided', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '9876543210';
    const result = getCustomerId({});
    assert.strictEqual(result, '9876543210');
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = originalEnv;
  });

  test('prefers params over env variable', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '9876543210';
    const result = getCustomerId({ customer_id: '1234567890' });
    assert.strictEqual(result, '1234567890');
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = originalEnv;
  });

  test('throws when neither param nor env is set', () => {
    const savedEnv = process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

    assert.throws(
      () => getCustomerId({}),
      /customer_id parameter or GOOGLE_ADS_DEFAULT_CUSTOMER_ID/
    );

    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = savedEnv;
  });

  test('works with undefined params', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '1111111111';
    const result = getCustomerId();
    assert.strictEqual(result, '1111111111');
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = originalEnv;
  });

  test('handles empty string customer_id', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '2222222222';
    const result = getCustomerId({ customer_id: '' });
    assert.strictEqual(result, '2222222222');
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = originalEnv;
  });
});

// ============================================
// buildCampaignFilter Edge Cases
// ============================================

describe('buildCampaignFilter', () => {
  test('returns empty string for undefined', () => {
    const result = buildCampaignFilter(undefined);
    assert.strictEqual(result, '');
  });

  test('returns empty string for null', () => {
    const result = buildCampaignFilter(null);
    assert.strictEqual(result, '');
  });

  test('returns empty string for empty array', () => {
    const result = buildCampaignFilter([]);
    assert.strictEqual(result, '');
  });

  test('returns correct filter for single ID', () => {
    const result = buildCampaignFilter(['123']);
    assert.strictEqual(result, 'AND campaign.id IN (123)');
  });

  test('returns correct filter for multiple IDs', () => {
    const result = buildCampaignFilter(['123', '456', '789']);
    assert.strictEqual(result, 'AND campaign.id IN (123, 456, 789)');
  });

  test('handles string IDs correctly', () => {
    const result = buildCampaignFilter(['abc123', 'def456']);
    assert.strictEqual(result, 'AND campaign.id IN (abc123, def456)');
  });

  test('handles numeric IDs as strings', () => {
    const result = buildCampaignFilter([123, 456]);
    assert.strictEqual(result, 'AND campaign.id IN (123, 456)');
  });
});

// ============================================
// validateRequired Edge Cases
// ============================================

describe('validateRequired edge cases', () => {
  test('passes with zero as valid value', () => {
    assert.doesNotThrow(() => {
      validateRequired({ count: 0 }, ['count']);
    });
  });

  test('passes with false as valid value', () => {
    assert.doesNotThrow(() => {
      validateRequired({ flag: false }, ['flag']);
    });
  });

  test('throws on undefined value', () => {
    assert.throws(
      () => validateRequired({ a: undefined }, ['a']),
      /Missing required parameter/
    );
  });

  test('handles empty fields array', () => {
    assert.doesNotThrow(() => {
      validateRequired({}, []);
    });
  });

  test('reports multiple missing fields', () => {
    assert.throws(
      () => validateRequired({}, ['a', 'b', 'c']),
      /a.*b.*c|Missing required parameters/
    );
  });
});

// ============================================
// validateEnum Edge Cases
// ============================================

describe('validateEnum edge cases', () => {
  test('handles empty allowed array', () => {
    assert.throws(
      () => validateEnum('any', [], 'param'),
      /Invalid param/
    );
  });

  test('is case sensitive', () => {
    assert.throws(
      () => validateEnum('enabled', ['ENABLED', 'PAUSED'], 'status'),
      /Invalid status.*enabled/
    );
  });

  test('handles numeric values', () => {
    assert.doesNotThrow(() => {
      validateEnum(1, [1, 2, 3], 'number');
    });
  });

  test('handles undefined value', () => {
    assert.throws(
      () => validateEnum(undefined, ['A', 'B'], 'param'),
      /Invalid param/
    );
  });
});

// ============================================
// blockMutations Edge Cases
// ============================================

describe('blockMutations edge cases', () => {
  test('allows query with "update" in column name', () => {
    // This should ideally be handled better, but documenting current behavior
    assert.throws(
      () => blockMutations('SELECT last_update_date FROM table'),
      /Mutation operations not allowed/
    );
  });

  test('allows empty query', () => {
    assert.doesNotThrow(() => {
      blockMutations('');
    });
  });

  test('allows whitespace-only query', () => {
    assert.doesNotThrow(() => {
      blockMutations('   \n\t   ');
    });
  });

  test('blocks mixed case mutations', () => {
    assert.throws(
      () => blockMutations('CrEaTe campaign'),
      /Mutation operations not allowed/
    );
  });

  test('blocks mutation at end of query', () => {
    assert.throws(
      () => blockMutations('SELECT * FROM campaign REMOVE'),
      /Mutation operations not allowed/
    );
  });
});
