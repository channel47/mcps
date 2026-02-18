import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getActionType,
  validateOperations,
  groupOperations,
  buildApiRequest,
  normalizeResponse,
  buildRequestPreview
} from '../server/utils/mutate-operations.js';

import {
  MOCK_CAMPAIGNS_ADD_RESPONSE,
  MOCK_KEYWORDS_ADD_RESPONSE,
  MOCK_UPDATE_RESPONSE,
  MOCK_DELETE_RESPONSE,
  MOCK_NEGATIVE_KW_RESPONSE,
  MOCK_NEGATIVE_KW_PARTIAL_ERROR_RESPONSE,
  MOCK_PARTIAL_FAILURE_RESPONSE
} from './fixtures.js';

describe('getActionType', () => {
  test('extracts create action', () => {
    assert.equal(getActionType({ entity: 'campaigns', create: {} }), 'create');
  });

  test('extracts update action', () => {
    assert.equal(getActionType({ entity: 'campaigns', update: {} }), 'update');
  });

  test('extracts remove action', () => {
    assert.equal(getActionType({ entity: 'campaigns', remove: {} }), 'remove');
  });

  test('throws when no action key present', () => {
    assert.throws(() => getActionType({ entity: 'campaigns' }), /must include one of/);
  });

  test('throws when multiple action keys present', () => {
    assert.throws(
      () => getActionType({ entity: 'campaigns', create: {}, update: {} }),
      /must include only one of/
    );
  });
});

describe('validateOperations', () => {
  test('returns no errors for valid campaign create', () => {
    const ops = [{ entity: 'campaigns', create: { Name: 'Test', DailyBudget: 50 } }];
    const errors = validateOperations(ops, '123');
    assert.equal(errors.length, 0);
  });

  test('returns error for missing entity', () => {
    const errors = validateOperations([{ create: { Name: 'Test' } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Missing required field: entity/);
  });

  test('returns error for unsupported entity', () => {
    const errors = validateOperations([{ entity: 'extensions', create: {} }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Unsupported entity/);
  });

  test('returns error for unsupported action on negative_keywords', () => {
    const errors = validateOperations([{ entity: 'negative_keywords', update: { Id: 1 } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /not supported/);
  });

  test('returns error when ad_groups missing campaign_id', () => {
    const errors = validateOperations([{ entity: 'ad_groups', create: { Name: 'AG1' } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /campaign_id/);
  });

  test('returns error when keywords missing ad_group_id', () => {
    const errors = validateOperations([{ entity: 'keywords', create: { Text: 'shoes' } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /ad_group_id/);
  });

  test('returns error for update without Id', () => {
    const errors = validateOperations([{ entity: 'campaigns', update: { Status: 'Paused' } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /requires Id/);
  });

  test('returns error for remove without Id', () => {
    const errors = validateOperations([{ entity: 'keywords', remove: { ad_group_id: '444' } }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /requires Id/);
  });

  test('returns error for negative_keywords missing entity_id', () => {
    const errors = validateOperations([
      { entity: 'negative_keywords', create: { entity_type: 'Campaign', Text: 'free', MatchType: 'Phrase' } }
    ], '123');
    assert.ok(errors.some((e) => e.message.includes('entity_id')));
  });

  test('returns error for negative_keywords missing entity_type', () => {
    const errors = validateOperations([
      { entity: 'negative_keywords', create: { entity_id: '333', Text: 'free', MatchType: 'Phrase' } }
    ], '123');
    assert.ok(errors.some((e) => e.message.includes('entity_type')));
  });

  test('returns error for empty operations array', () => {
    assert.throws(() => validateOperations([], '123'), /non-empty array/);
  });

  test('returns error when action body is not an object', () => {
    const errors = validateOperations([{ entity: 'campaigns', create: 'bad' }], '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /non-empty object/);
  });

  test('returns error when batch limit exceeded for ads (limit 50)', () => {
    const ops = Array.from({ length: 51 }, (_, i) => ({
      entity: 'ads',
      create: { ad_group_id: '444', Type: 'ResponsiveSearchAd', Headlines: [{ Text: `Ad ${i}` }] }
    }));
    const errors = validateOperations(ops, '123');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Batch limit exceeded/);
    assert.match(errors[0].message, /max 50/);
  });
});

describe('groupOperations', () => {
  test('groups campaigns by accountId', () => {
    const ops = [
      { entity: 'campaigns', create: { Name: 'C1' } },
      { entity: 'campaigns', create: { Name: 'C2' } }
    ];
    const groups = groupOperations(ops, '123');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[0].parentId, '123');
  });

  test('separates different entities into different groups', () => {
    const ops = [
      { entity: 'campaigns', update: { Id: 1, Status: 'Paused' } },
      { entity: 'keywords', update: { ad_group_id: '444', Id: 2, Bid: { Amount: 1.0 } } }
    ];
    const groups = groupOperations(ops, '123');
    assert.equal(groups.length, 2);
  });

  test('separates keywords in different ad groups', () => {
    const ops = [
      { entity: 'keywords', create: { ad_group_id: '100', Text: 'a', MatchType: 'Exact' } },
      { entity: 'keywords', create: { ad_group_id: '200', Text: 'b', MatchType: 'Exact' } }
    ];
    const groups = groupOperations(ops, '123');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].parentId, '100');
    assert.equal(groups[1].parentId, '200');
  });

  test('preserves original indices', () => {
    const ops = [
      { entity: 'campaigns', create: { Name: 'C1' } },
      { entity: 'keywords', create: { ad_group_id: '444', Text: 'kw1', MatchType: 'Exact' } },
      { entity: 'campaigns', create: { Name: 'C2' } }
    ];
    const groups = groupOperations(ops, '123');
    const campaignGroup = groups.find((g) => g.entity === 'campaigns');
    assert.deepEqual(campaignGroup.items.map((i) => i.index), [0, 2]);
  });
});

describe('buildApiRequest', () => {
  test('builds campaign create request', () => {
    const group = {
      entity: 'campaigns',
      action: 'create',
      parentId: '123',
      items: [
        { index: 0, body: { Name: 'Test Campaign', DailyBudget: 50 } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.method, 'POST');
    assert.match(req.url, /\/Campaigns$/);
    assert.equal(req.body.AccountId, 123);
    assert.equal(req.body.Campaigns.length, 1);
    assert.equal(req.body.Campaigns[0].Name, 'Test Campaign');
  });

  test('builds keyword create request with parent field stripped', () => {
    const group = {
      entity: 'keywords',
      action: 'create',
      parentId: '444',
      items: [
        { index: 0, body: { ad_group_id: '444', Text: 'shoes', MatchType: 'Exact' } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.body.AdGroupId, 444);
    assert.equal(req.body.Keywords[0].Text, 'shoes');
    assert.equal(req.body.Keywords[0].ad_group_id, undefined);
  });

  test('builds campaign delete request', () => {
    const group = {
      entity: 'campaigns',
      action: 'remove',
      parentId: '123',
      items: [
        { index: 0, body: { Id: 333 } },
        { index: 1, body: { Id: 444 } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.method, 'DELETE');
    assert.equal(req.body.AccountId, 123);
    assert.deepEqual(req.body.CampaignIds, [333, 444]);
  });

  test('builds keyword delete request', () => {
    const group = {
      entity: 'keywords',
      action: 'remove',
      parentId: '444',
      items: [
        { index: 0, body: { ad_group_id: '444', Id: 555 } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.method, 'DELETE');
    assert.equal(req.body.AdGroupId, 444);
    assert.deepEqual(req.body.KeywordIds, [555]);
  });

  test('builds negative keyword create request', () => {
    const group = {
      entity: 'negative_keywords',
      action: 'create',
      parentId: 'Campaign:333',
      items: [
        { index: 0, body: { entity_id: '333', entity_type: 'Campaign', Text: 'free', MatchType: 'Phrase' } },
        { index: 1, body: { entity_id: '333', entity_type: 'Campaign', Text: 'cheap', MatchType: 'Exact' } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.method, 'POST');
    assert.match(req.url, /\/EntityNegativeKeywords$/);
    assert.equal(req.body.EntityNegativeKeywords.length, 1);
    assert.equal(req.body.EntityNegativeKeywords[0].EntityId, 333);
    assert.equal(req.body.EntityNegativeKeywords[0].NegativeKeywords.length, 2);
  });

  test('builds negative keyword delete request', () => {
    const group = {
      entity: 'negative_keywords',
      action: 'remove',
      parentId: 'Campaign:333',
      items: [
        { index: 0, body: { entity_id: '333', entity_type: 'Campaign', Id: 777 } },
        { index: 1, body: { entity_id: '333', entity_type: 'Campaign', Id: 888 } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.method, 'DELETE');
    assert.equal(req.body.EntityNegativeKeywords[0].NegativeKeywordIds.length, 2);
  });

  test('builds ad group create request', () => {
    const group = {
      entity: 'ad_groups',
      action: 'create',
      parentId: '333',
      items: [
        { index: 0, body: { campaign_id: '333', Name: 'New AG', CpcBid: { Amount: 1.0 } } }
      ]
    };

    const req = buildApiRequest(group, '123');
    assert.equal(req.body.CampaignId, 333);
    assert.equal(req.body.AdGroups[0].Name, 'New AG');
    assert.equal(req.body.AdGroups[0].campaign_id, undefined);
  });
});

describe('normalizeResponse', () => {
  test('normalizes campaign create with partial errors', () => {
    const results = normalizeResponse(MOCK_CAMPAIGNS_ADD_RESPONSE, 'campaigns', 'create', [0, 1]);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[0].id, '777');
    assert.equal(results[1].success, false);
    assert.equal(results[1].error.code, 1030);
  });

  test('normalizes keyword create with all successes', () => {
    const results = normalizeResponse(MOCK_KEYWORDS_ADD_RESPONSE, 'keywords', 'create', [0, 1]);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[0].id, '888');
    assert.equal(results[1].id, '999');
  });

  test('normalizes update response (no errors)', () => {
    const results = normalizeResponse(MOCK_UPDATE_RESPONSE, 'campaigns', 'update', [0]);
    assert.equal(results.length, 1);
    assert.equal(results[0].success, true);
    assert.equal(results[0].id, undefined);
  });

  test('normalizes delete response', () => {
    const results = normalizeResponse(MOCK_DELETE_RESPONSE, 'keywords', 'remove', [3, 5]);
    assert.equal(results.length, 2);
    assert.equal(results[0].index, 3);
    assert.equal(results[0].success, true);
    assert.equal(results[1].index, 5);
  });

  test('normalizes update response with partial failure', () => {
    const results = normalizeResponse(MOCK_PARTIAL_FAILURE_RESPONSE, 'campaigns', 'update', [0]);
    assert.equal(results[0].success, false);
    assert.equal(results[0].error.code, 1100);
    assert.match(results[0].error.message, /budget/);
  });

  test('normalizes negative keyword create response', () => {
    const results = normalizeResponse(MOCK_NEGATIVE_KW_RESPONSE, 'negative_keywords', 'create', [0, 1]);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[0].id, '111');
    assert.equal(results[1].id, '222');
  });

  test('maps results to correct original indices', () => {
    const results = normalizeResponse(MOCK_KEYWORDS_ADD_RESPONSE, 'keywords', 'create', [5, 8]);
    assert.equal(results[0].index, 5);
    assert.equal(results[1].index, 8);
  });

  test('normalizes negative keyword create with nested partial errors', () => {
    const results = normalizeResponse(MOCK_NEGATIVE_KW_PARTIAL_ERROR_RESPONSE, 'negative_keywords', 'create', [0, 1]);
    assert.equal(results.length, 2);
    assert.equal(results[0].success, true);
    assert.equal(results[0].id, '111');
    assert.equal(results[1].success, false);
    assert.equal(results[1].error.code, 4802);
    assert.match(results[1].error.message, /match type/);
  });
});

describe('buildRequestPreview', () => {
  test('returns valid preview for correct operations', () => {
    const ops = [
      { entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }
    ];
    const preview = buildRequestPreview(ops, '123');
    assert.equal(preview.valid, true);
    assert.equal(preview.requests.length, 1);
    assert.equal(preview.requests[0].method, 'PUT');
  });

  test('returns invalid preview with validation errors', () => {
    const ops = [{ entity: 'bad_entity', create: {} }];
    const preview = buildRequestPreview(ops, '123');
    assert.equal(preview.valid, false);
    assert.ok(preview.errors.length > 0);
  });

  test('groups multiple operations in preview', () => {
    const ops = [
      { entity: 'campaigns', create: { Name: 'C1' } },
      { entity: 'keywords', create: { ad_group_id: '444', Text: 'kw1', MatchType: 'Exact' } },
      { entity: 'campaigns', create: { Name: 'C2' } }
    ];
    const preview = buildRequestPreview(ops, '123');
    assert.equal(preview.valid, true);
    assert.equal(preview.requests.length, 2);
    const campaignReq = preview.requests.find((r) => r.entity === 'campaigns');
    assert.equal(campaignReq.operationCount, 2);
    assert.deepEqual(campaignReq.indices, [0, 2]);
  });
});
