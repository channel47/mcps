import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { listAccounts } from '../server/tools/list-accounts.js';
import { listProducts } from '../server/tools/list-products.js';
import { listStores } from '../server/tools/list-stores.js';
import { mutate } from '../server/tools/mutate.js';
import { query } from '../server/tools/query-campaigns.js';
import { report } from '../server/tools/report.js';
import { getEditorialReasons } from '../server/tools/editorial.js';
import {
  buildSingleFileZip,
  MOCK_ACCOUNTS_RESPONSE,
  MOCK_CAMPAIGNS_RESPONSE,
  MOCK_EDITORIAL_REASONS_RESPONSE,
  MOCK_PRODUCTS_RESPONSE,
  MOCK_STORES_RESPONSE,
  MOCK_UPDATE_RESPONSE,
  SAMPLE_REPORT_CSV
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('tool integration', () => {
  test('runs all tools with mocked dependencies', async () => {
    const listResult = await listAccounts(
      {},
      {
        request: async () => MOCK_ACCOUNTS_RESPONSE
      }
    );
    const listPayload = JSON.parse(listResult.content[0].text);
    assert.equal(listPayload.success, true);
    assert.equal(listPayload.data.length, 2);

    const productsResult = await listProducts(
      { store_id: '12345' },
      {
        request: async () => MOCK_PRODUCTS_RESPONSE
      }
    );
    const productsPayload = JSON.parse(productsResult.content[0].text);
    assert.equal(productsPayload.success, true);
    assert.equal(productsPayload.data.length, 1);
    assert.equal(productsPayload.data[0].link, 'https://www.channel47.com/products/sku-1');

    const storesResult = await listStores(
      {},
      {
        request: async () => MOCK_STORES_RESPONSE
      }
    );
    const storesPayload = JSON.parse(storesResult.content[0].text);
    assert.equal(storesPayload.success, true);
    assert.equal(storesPayload.data.length, 1);
    assert.equal(storesPayload.data[0].id, '12345');

    const queryResult = await query(
      { entity: 'campaigns', campaign_type: 'Search' },
      {
        request: async () => MOCK_CAMPAIGNS_RESPONSE
      }
    );
    const queryPayload = JSON.parse(queryResult.content[0].text);
    assert.equal(queryPayload.success, true);
    assert.equal(queryPayload.data[0].name, 'Search - Brand');

    const reportResult = await report(
      { report_type: 'campaign', limit: 1 },
      {
        request: async (url) => {
          if (url.endsWith('/GenerateReport/Submit')) {
            return { ReportRequestId: 'integration-report' };
          }
          return {
            ReportRequestStatus: {
              Status: 'Success',
              ReportDownloadUrl: 'https://download.example/report.zip'
            }
          };
        },
        downloadReport: async () => buildSingleFileZip('report.csv', SAMPLE_REPORT_CSV),
        sleepFn: async () => {}
      }
    );
    const reportPayload = JSON.parse(reportResult.content[0].text);
    assert.equal(reportPayload.success, true);
    assert.equal(reportPayload.data.length, 1);

    const mutateResult = await mutate(
      {
        operations: [
          { entity: 'campaigns', update: { Id: 333333333, Status: 'Paused' } }
        ],
        dry_run: false
      },
      {
        request: async () => MOCK_UPDATE_RESPONSE
      }
    );
    const mutatePayload = JSON.parse(mutateResult.content[0].text);
    assert.equal(mutatePayload.success, true);
    assert.equal(mutatePayload.metadata.succeeded, 1);
    assert.equal(mutatePayload.metadata.dryRun, false);

    const editorialResult = await getEditorialReasons(
      {
        entity_type: 'Ad',
        entity_ids: [{ entity_id: '666666666', ad_group_id: '444444444' }]
      },
      {
        request: async () => MOCK_EDITORIAL_REASONS_RESPONSE
      }
    );
    const editorialPayload = JSON.parse(editorialResult.content[0].text);
    assert.equal(editorialPayload.success, true);
    assert.equal(editorialPayload.data[0].reasons[0].term, 'unsubstantiated claim');
  });
});
