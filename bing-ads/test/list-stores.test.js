import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('listStores', () => {
  test('returns formatted store list', async () => {
    const { listStores } = await import('../server/tools/list-stores.js');
    let captured = null;

    const result = await listStores(
      {},
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return {
            BMCStores: [
              {
                Id: 12345,
                Name: 'My Store',
                StoreUrl: 'https://www.example.com',
                IsActive: true,
                HasCatalog: true,
                IsProductAdsEnabled: true,
                SubType: 'CoOp'
              },
              {
                Id: 67890,
                Name: 'Other Store',
                StoreUrl: 'https://other.example.com',
                IsActive: false,
                HasCatalog: false,
                IsProductAdsEnabled: false
              }
            ]
          };
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(captured.url.endsWith('/BMCStores/QueryByCustomerId'), true);
    assert.equal(captured.context.customerId, '456456456');
    assert.equal(payload.success, true);
    assert.equal(payload.data.length, 2);
    assert.equal(payload.data[0].id, '12345');
    assert.equal(payload.data[0].name, 'My Store');
    assert.equal(payload.data[0].is_active, true);
    assert.equal(payload.data[1].is_active, false);
    assert.equal(payload.data[1].sub_type, null);
  });

  test('uses customer_id from params over env', async () => {
    const { listStores } = await import('../server/tools/list-stores.js');
    let capturedContext = null;

    await listStores(
      { customer_id: '999' },
      {
        request: async (_url, _body, context) => {
          capturedContext = context;
          return { BMCStores: [] };
        }
      }
    );

    assert.equal(capturedContext.customerId, '999');
  });

  test('returns empty list when no stores exist', async () => {
    const { listStores } = await import('../server/tools/list-stores.js');

    const result = await listStores(
      {},
      {
        request: async () => ({ BMCStores: [] })
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.success, true);
    assert.equal(payload.data.length, 0);
  });
});
