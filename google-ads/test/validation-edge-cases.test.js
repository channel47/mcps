/**
 * Edge case tests for validation utilities
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  getCustomerId,
  blockMutations
} from '../server/utils/validation.js';

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
// blockMutations Edge Cases
// ============================================

describe('blockMutations edge cases', () => {
  test('blocks query with "update" in column name', () => {
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
