import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getAccountId,
  getCustomerId,
  validateDateRange,
  validateEnum,
  validateRequired
} from '../server/utils/validation.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ── validateRequired ─────────────────────────────────────────

describe('validateRequired', () => {
  test('passes when all fields are present', () => {
    assert.doesNotThrow(() => {
      validateRequired({ entity: 'campaigns', account_id: '123' }, ['entity', 'account_id']);
    });
  });

  test('throws for single missing field', () => {
    assert.throws(
      () => validateRequired({ entity: 'campaigns' }, ['entity', 'account_id']),
      /account_id/
    );
  });

  test('throws for multiple missing fields', () => {
    let caught;
    try {
      validateRequired({}, ['entity', 'account_id']);
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.match(caught.message, /Missing required parameters/);
    assert.match(caught.message, /entity/);
    assert.match(caught.message, /account_id/);
  });

  test('treats empty string as missing', () => {
    assert.throws(
      () => validateRequired({ entity: '' }, ['entity']),
      /entity/
    );
  });

  test('treats null as missing', () => {
    assert.throws(
      () => validateRequired({ entity: null }, ['entity']),
      /entity/
    );
  });
});

// ── validateEnum ─────────────────────────────────────────────

describe('validateEnum', () => {
  test('passes for valid value', () => {
    assert.doesNotThrow(() => {
      validateEnum('campaigns', ['campaigns', 'ad_groups', 'keywords'], 'entity');
    });
  });

  test('throws for invalid value with param name', () => {
    assert.throws(
      () => validateEnum('invalid', ['campaigns', 'ad_groups'], 'entity'),
      /Invalid entity.*invalid.*Allowed values.*campaigns.*ad_groups/
    );
  });
});

// ── getAccountId ─────────────────────────────────────────────

describe('getAccountId', () => {
  test('prefers param over env var', () => {
    const id = getAccountId({ account_id: '999' });
    assert.equal(id, '999');
  });

  test('falls back to BING_ADS_ACCOUNT_ID env var', () => {
    const id = getAccountId({});
    assert.equal(id, '123123123');
  });

  test('returns string type', () => {
    const id = getAccountId({ account_id: 42 });
    assert.equal(typeof id, 'string');
    assert.equal(id, '42');
  });

  test('throws when neither param nor env var is set', () => {
    delete process.env.BING_ADS_ACCOUNT_ID;

    assert.throws(
      () => getAccountId({}),
      /account_id.*BING_ADS_ACCOUNT_ID/
    );
  });
});

// ── getCustomerId ────────────────────────────────────────────

describe('getCustomerId', () => {
  test('prefers param over env var', () => {
    const id = getCustomerId({ customer_id: '888' });
    assert.equal(id, '888');
  });

  test('falls back to BING_ADS_CUSTOMER_ID env var', () => {
    const id = getCustomerId({});
    assert.equal(id, '456456456');
  });

  test('returns string type', () => {
    const id = getCustomerId({ customer_id: 77 });
    assert.equal(typeof id, 'string');
    assert.equal(id, '77');
  });

  test('throws when neither param nor env var is set', () => {
    delete process.env.BING_ADS_CUSTOMER_ID;

    assert.throws(
      () => getCustomerId({}),
      /customer_id.*BING_ADS_CUSTOMER_ID/
    );
  });
});

// ── validateDateRange ────────────────────────────────────────

describe('validateDateRange', () => {
  const validRanges = [
    'Today', 'Yesterday', 'LastSevenDays', 'ThisWeek', 'LastWeek',
    'Last14Days', 'Last30Days', 'LastFourWeeks', 'ThisMonth', 'LastMonth',
    'LastThreeMonths', 'LastSixMonths', 'ThisYear', 'LastYear'
  ];

  for (const range of validRanges) {
    test(`accepts "${range}"`, () => {
      const result = validateDateRange(range);
      assert.equal(result, range);
    });
  }

  test('throws for invalid date range', () => {
    assert.throws(
      () => validateDateRange('Last3Days'),
      /Invalid date_range.*Last3Days/
    );
  });

  test('accepts default param value (LastSevenDays)', () => {
    assert.equal(validateDateRange(), 'LastSevenDays');
  });
});
