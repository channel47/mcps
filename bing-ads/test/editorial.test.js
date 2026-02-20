import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MOCK_EDITORIAL_REASONS_RESPONSE } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('get_editorial_reasons', () => {
  test('fetches editorial reasons and normalizes response', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');
    let captured = null;

    const result = await getEditorialReasons(
      {
        entity_type: 'Ad',
        entity_ids: [
          { entity_id: '666666666', ad_group_id: '444444444' }
        ]
      },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return MOCK_EDITORIAL_REASONS_RESPONSE;
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);

    assert.equal(captured.url.endsWith('/EditorialReasons/QueryByIds'), true);
    assert.equal(captured.body.AccountId, 123123123);
    assert.equal(captured.body.EntityType, 'Ad');
    assert.deepEqual(captured.body.EntityIdToParentIdAssociations, [
      { EntityId: 666666666, ParentId: 444444444 }
    ]);

    assert.equal(payload.success, true);
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].entity_id, '666666666');
    assert.equal(payload.data[0].ad_group_id, '444444444');
    assert.equal(payload.data[0].appeal_status, 'AppealPending');
    assert.equal(payload.data[0].reasons[0].location, 'Ad Description');
    assert.deepEqual(payload.data[0].reasons[0].publisher_countries, ['US', 'CA']);
    assert.equal(payload.data[0].reasons[0].reason_code, 8);
    assert.equal(payload.data[0].reasons[0].term, 'unsubstantiated claim');
  });

  test('requires entity_type parameter', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');

    await assert.rejects(
      () => getEditorialReasons(
        { entity_ids: [{ entity_id: '1', ad_group_id: '2' }] },
        { request: async () => ({}) }
      ),
      /entity_type/
    );
  });

  test('requires entity_ids parameter', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');

    await assert.rejects(
      () => getEditorialReasons(
        { entity_type: 'Ad' },
        { request: async () => ({}) }
      ),
      /entity_ids/
    );
  });

  test('validates entity_type enum', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');

    await assert.rejects(
      () => getEditorialReasons(
        { entity_type: 'Campaign', entity_ids: [{ entity_id: '1', ad_group_id: '2' }] },
        { request: async () => ({}) }
      ),
      /Invalid entity_type/
    );
  });

  test('requires entity_id and ad_group_id in each entry', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');

    await assert.rejects(
      () => getEditorialReasons(
        { entity_type: 'Ad', entity_ids: ['666666666'] },
        { request: async () => ({}) }
      ),
      /entity_id and ad_group_id/
    );
  });

  test('handles empty editorial reasons response', async () => {
    const { getEditorialReasons } = await import('../server/tools/editorial.js');

    const result = await getEditorialReasons(
      {
        entity_type: 'Keyword',
        entity_ids: [{ entity_id: '555555555', ad_group_id: '444444444' }]
      },
      {
        request: async () => ({ EditorialReasons: [null], PartialErrors: [] })
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.data.length, 0);
  });
});
