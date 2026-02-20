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

describe('listProducts', () => {
  test('requires store_id', async () => {
    const { listProducts } = await import('../server/tools/list-products.js');

    await assert.rejects(
      () => listProducts({}, { request: async () => ({ resources: [] }) }),
      /store_id/
    );
  });

  test('uses default max_results and normalizes product data', async () => {
    const { listProducts } = await import('../server/tools/list-products.js');
    let captured = null;

    const result = await listProducts(
      { store_id: '12345' },
      {
        request: async (url, body, options) => {
          captured = { url, body, options };
          return {
            resources: [
              {
                id: 'online:en:US:sku-1',
                offerId: 'sku-1',
                title: 'Blue Shirt',
                link: 'https://example.com/products/sku-1',
                price: { value: '19.99', currency: 'USD' },
                salePrice: { value: '14.99', currency: 'USD' },
                availability: 'in stock',
                imageLink: 'https://example.com/images/sku-1.jpg',
                brand: 'Channel47',
                customLabel0: 'sale',
                customLabel2: 'spring',
                mobileLink: 'https://m.example.com/products/sku-1',
                adwordsRedirect: 'https://redirect.example.com/sku-1',
                expirationDate: '2026-03-01T00:00:00Z'
              }
            ],
            nextPageToken: 'next-page-token'
          };
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(captured.url.endsWith('/12345/products?max-results=250'), true);
    assert.equal(captured.body, undefined);
    assert.equal(captured.options.method, 'GET');
    assert.equal(captured.options.includeContextHeaders, false);
    assert.equal(payload.success, true);
    assert.equal(payload.data[0].offer_id, 'sku-1');
    assert.equal(payload.data[0].link, 'https://example.com/products/sku-1');
    assert.deepEqual(payload.data[0].custom_labels, ['sale', 'spring']);
    assert.equal(payload.metadata.nextPageToken, 'next-page-token');
    assert.equal(payload.metadata.storeId, '12345');
  });

  test('supports start_token and custom max_results', async () => {
    const { listProducts } = await import('../server/tools/list-products.js');
    let capturedUrl = null;

    await listProducts(
      { store_id: '12345', max_results: 100, start_token: 'abc123' },
      {
        request: async (url) => {
          capturedUrl = url;
          return { resources: [] };
        }
      }
    );

    assert.equal(
      capturedUrl,
      'https://content.api.bingads.microsoft.com/shopping/v9.1/bmc/12345/products?max-results=100&start-token=abc123'
    );
  });

  test('validates max_results range', async () => {
    const { listProducts } = await import('../server/tools/list-products.js');

    await assert.rejects(
      () => listProducts({ store_id: '12345', max_results: 0 }, { request: async () => ({ resources: [] }) }),
      /Invalid max_results/
    );
  });
});
