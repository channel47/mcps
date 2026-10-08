/**
 * Tests for login_customer_id (MCC override) pass-through.
 * Stubs Customer.prototype from google-ads-api so the real client is
 * constructed but no network calls are made.
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Customer } from 'google-ads-api';

import { getCustomerClient } from '../server/auth.js';
import { runGaqlQuery } from '../server/tools/gaql-query.js';
import { listAccounts } from '../server/tools/list-accounts.js';
import { mutate } from '../server/tools/mutate.js';

const originalEnv = { ...process.env };
let calls;

beforeEach(() => {
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-token';
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh';
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '1111111111';
  process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '2222222222';

  calls = [];
  mock.method(Customer.prototype, 'query', async function () {
    calls.push(this.credentials);
    return [];
  });
  mock.method(Customer.prototype, 'mutateResources', async function () {
    calls.push(this.credentials);
    return { mutate_operation_responses: [] };
  });
});

afterEach(() => {
  mock.restoreAll();
  process.env = { ...originalEnv };
});

describe('getCustomerClient', () => {
  test('uses GOOGLE_ADS_LOGIN_CUSTOMER_ID by default', () => {
    const customer = getCustomerClient('3333333333');
    assert.strictEqual(customer.credentials.customer_id, '3333333333');
    assert.strictEqual(customer.credentials.login_customer_id, '1111111111');
  });

  test('loginCustomerId argument overrides the env var', () => {
    const customer = getCustomerClient('3333333333', '9999999999');
    assert.strictEqual(customer.credentials.login_customer_id, '9999999999');
  });
});

describe('login_customer_id pass-through', () => {
  test('query uses login_customer_id param', async () => {
    const result = await runGaqlQuery({
      customer_id: '3333333333',
      login_customer_id: '9999999999',
      query: 'SELECT campaign.id FROM campaign'
    });
    assert.ok(!result.isError, result.content[0].text);
    assert.deepStrictEqual(
      [calls[0].customer_id, calls[0].login_customer_id],
      ['3333333333', '9999999999']
    );
  });

  test('query falls back to env MCC without login_customer_id', async () => {
    await runGaqlQuery({ customer_id: '3333333333', query: 'SELECT campaign.id FROM campaign' });
    assert.strictEqual(calls[0].login_customer_id, '1111111111');
  });

  test('list_accounts enumerates the login_customer_id MCC', async () => {
    const result = await listAccounts({ login_customer_id: '9999999999' });
    assert.ok(!result.isError, result.content[0].text);
    assert.deepStrictEqual(
      [calls[0].customer_id, calls[0].login_customer_id],
      ['9999999999', '9999999999']
    );
  });

  test('list_accounts falls back to GOOGLE_ADS_LOGIN_CUSTOMER_ID', async () => {
    await listAccounts({});
    assert.deepStrictEqual(
      [calls[0].customer_id, calls[0].login_customer_id],
      ['1111111111', '1111111111']
    );
  });

  test('list_accounts falls back to GOOGLE_ADS_DEFAULT_CUSTOMER_ID', async () => {
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    await listAccounts({});
    assert.strictEqual(calls[0].customer_id, '2222222222');
  });

  test('mutate uses login_customer_id param', async () => {
    const result = await mutate({
      customer_id: '3333333333',
      login_customer_id: '9999999999',
      operations: [{ entity: 'campaign', operation: 'remove', resource: 'customers/3333333333/campaigns/1' }]
    });
    assert.ok(!result.isError, result.content[0].text);
    assert.deepStrictEqual(
      [calls[0].customer_id, calls[0].login_customer_id],
      ['3333333333', '9999999999']
    );
  });
});
