import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getCustomerId, blockMutations } from './server/utils/validation.js';

const originalCustomerId = process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

describe('getCustomerId', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  });

  afterEach(() => {
    if (originalCustomerId === undefined) {
      delete process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
    } else {
      process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = originalCustomerId;
    }
  });

  test('prefers customer_id param', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '9999999999';
    assert.strictEqual(getCustomerId({ customer_id: '1234567890' }), '1234567890');
  });

  test('falls back to GOOGLE_ADS_DEFAULT_CUSTOMER_ID env var', () => {
    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '9999999999';
    assert.strictEqual(getCustomerId({}), '9999999999');
  });

  test('throws when neither param nor env var is set', () => {
    assert.throws(
      () => getCustomerId({}),
      /customer_id parameter or GOOGLE_ADS_DEFAULT_CUSTOMER_ID environment variable required/
    );
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
