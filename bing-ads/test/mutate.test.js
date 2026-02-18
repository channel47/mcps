import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mutate } from '../server/tools/mutate.js';
import {
  MOCK_CAMPAIGNS_ADD_RESPONSE,
  MOCK_KEYWORDS_ADD_RESPONSE,
  MOCK_UPDATE_RESPONSE,
  MOCK_DELETE_RESPONSE,
  MOCK_NEGATIVE_KW_RESPONSE,
  MOCK_NEGATIVE_KW_PARTIAL_ERROR_RESPONSE,
  MOCK_PARTIAL_FAILURE_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

describe('mutate — dry run', () => {
  test('validates and previews a campaign update', async () => {
    const result = await mutate({
      operations: [{ entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }],
      dry_run: true
    });

    const payload = parseResult(result);
    assert.equal(payload.success, true);
    assert.equal(payload.metadata.dryRun, true);
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].method, 'PUT');
    assert.match(payload.summary, /Dry run/);
    assert.match(payload.summary, /Client-side validation only/);
  });

  test('defaults to dry_run=true when omitted', async () => {
    const result = await mutate({
      operations: [{ entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }]
    });

    const payload = parseResult(result);
    assert.equal(payload.metadata.dryRun, true);
  });

  test('returns validation errors for invalid operations', async () => {
    await assert.rejects(
      () => mutate({
        operations: [{ entity: 'campaigns', update: { Status: 'Paused' } }]
      }),
      /Invalid operations.*requires Id/
    );
  });

  test('returns validation error for missing entity', async () => {
    await assert.rejects(
      () => mutate({
        operations: [{ create: { Name: 'Test' } }]
      }),
      /Missing required field: entity/
    );
  });

  test('returns error for unsupported action on entity', async () => {
    await assert.rejects(
      () => mutate({
        operations: [{ entity: 'negative_keywords', update: { Id: 1 } }]
      }),
      /not supported/
    );
  });

  test('previews multiple operations grouped correctly', async () => {
    const result = await mutate({
      operations: [
        { entity: 'campaigns', create: { Name: 'C1' } },
        { entity: 'keywords', create: { ad_group_id: '444', Text: 'kw1', MatchType: 'Exact' } },
        { entity: 'campaigns', create: { Name: 'C2' } }
      ],
      dry_run: true
    });

    const payload = parseResult(result);
    assert.equal(payload.data.length, 2);
    assert.equal(payload.metadata.apiCallCount, 2);
  });

  test('returns error for empty operations array', async () => {
    await assert.rejects(
      () => mutate({ operations: [] }),
      /non-empty array/
    );
  });

  test('treats dry_run=0 and dry_run="" as false (live execution)', async () => {
    const result = await mutate(
      {
        operations: [{ entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }],
        dry_run: 0
      },
      {
        request: async () => MOCK_UPDATE_RESPONSE
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.metadata.dryRun, false);
  });
});

describe('mutate — live execution', () => {
  test('creates campaigns and returns IDs', async () => {
    let capturedRequest = null;

    const result = await mutate(
      {
        operations: [
          { entity: 'campaigns', create: { Name: 'Campaign A', DailyBudget: 50 } },
          { entity: 'campaigns', create: { Name: 'Bad Campaign' } }
        ],
        dry_run: false
      },
      {
        request: async (url, body, context) => {
          capturedRequest = { url, body, context };
          return MOCK_CAMPAIGNS_ADD_RESPONSE;
        }
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.success, true);
    assert.equal(payload.metadata.dryRun, false);
    assert.equal(payload.metadata.succeeded, 1);
    assert.equal(payload.metadata.failed, 1);

    // First op succeeded with ID
    assert.equal(payload.data[0].success, true);
    assert.equal(payload.data[0].id, '777');

    // Second op failed
    assert.equal(payload.data[1].success, false);
    assert.equal(payload.data[1].error.code, 1030);

    // Verify request structure
    assert.match(capturedRequest.url, /\/Campaigns$/);
    assert.equal(capturedRequest.body.AccountId, 123123123);
    assert.equal(capturedRequest.body.Campaigns.length, 2);
    assert.equal(capturedRequest.context.method, 'POST');
  });

  test('creates keywords with all succeeding', async () => {
    const result = await mutate(
      {
        operations: [
          { entity: 'keywords', create: { ad_group_id: '444', Text: 'shoes', MatchType: 'Exact', Bid: { Amount: 1.5 } } },
          { entity: 'keywords', create: { ad_group_id: '444', Text: 'boots', MatchType: 'Phrase', Bid: { Amount: 2.0 } } }
        ],
        dry_run: false
      },
      {
        request: async () => MOCK_KEYWORDS_ADD_RESPONSE
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.metadata.succeeded, 2);
    assert.equal(payload.metadata.failed, 0);
    assert.equal(payload.data[0].id, '888');
    assert.equal(payload.data[1].id, '999');
  });

  test('updates campaigns — all failures throws error', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [{ entity: 'campaigns', update: { Id: 333, DailyBudget: -5 } }],
          dry_run: false
        },
        { request: async () => MOCK_PARTIAL_FAILURE_RESPONSE }
      ),
      /All.*failed/
    );
  });

  test('deletes keywords with correct URL/method/body', async () => {
    let capturedRequest = null;

    const result = await mutate(
      {
        operations: [
          { entity: 'keywords', remove: { ad_group_id: '444', Id: 555 } }
        ],
        dry_run: false
      },
      {
        request: async (url, body, context) => {
          capturedRequest = { url, body, context };
          return MOCK_DELETE_RESPONSE;
        }
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.metadata.succeeded, 1);
    assert.equal(capturedRequest.context.method, 'DELETE');
    assert.equal(capturedRequest.body.AdGroupId, 444);
    assert.deepEqual(capturedRequest.body.KeywordIds, [555]);
  });

  test('creates negative keywords with nested structure', async () => {
    let capturedRequest = null;

    const result = await mutate(
      {
        operations: [
          { entity: 'negative_keywords', create: { entity_id: '333', entity_type: 'Campaign', Text: 'free', MatchType: 'Phrase' } },
          { entity: 'negative_keywords', create: { entity_id: '333', entity_type: 'Campaign', Text: 'cheap', MatchType: 'Exact' } }
        ],
        dry_run: false
      },
      {
        request: async (url, body, context) => {
          capturedRequest = { url, body, context };
          return MOCK_NEGATIVE_KW_RESPONSE;
        }
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.metadata.succeeded, 2);
    assert.equal(payload.data[0].id, '111');
    assert.equal(payload.data[1].id, '222');

    // Verify nested structure
    assert.equal(capturedRequest.body.EntityNegativeKeywords.length, 1);
    assert.equal(capturedRequest.body.EntityNegativeKeywords[0].EntityId, 333);
    assert.equal(capturedRequest.body.EntityNegativeKeywords[0].NegativeKeywords.length, 2);
  });

  test('dispatches multiple API calls for mixed entities', async () => {
    const calls = [];

    const result = await mutate(
      {
        operations: [
          { entity: 'campaigns', update: { Id: 333, Status: 'Paused' } },
          { entity: 'keywords', create: { ad_group_id: '444', Text: 'test', MatchType: 'Exact' } }
        ],
        dry_run: false
      },
      {
        request: async (url, body, context) => {
          calls.push({ url, body, context });
          if (url.includes('/Campaigns')) return MOCK_UPDATE_RESPONSE;
          return MOCK_KEYWORDS_ADD_RESPONSE;
        }
      }
    );

    assert.equal(calls.length, 2);
    const payload = parseResult(result);
    assert.equal(payload.metadata.operationCount, 2);
  });

  test('groups keywords by ad_group_id into separate API calls', async () => {
    const calls = [];

    await mutate(
      {
        operations: [
          { entity: 'keywords', create: { ad_group_id: '100', Text: 'a', MatchType: 'Exact' } },
          { entity: 'keywords', create: { ad_group_id: '200', Text: 'b', MatchType: 'Exact' } }
        ],
        dry_run: false
      },
      {
        request: async (url, body) => {
          calls.push({ url, body });
          return { KeywordIds: [1000], PartialErrors: [] };
        }
      }
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.AdGroupId, 100);
    assert.equal(calls[1].body.AdGroupId, 200);
  });

  test('partial_failure=false stops on first group error', async () => {
    const calls = [];

    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaigns', update: { Id: 333, Status: 'Paused' } },
            { entity: 'keywords', create: { ad_group_id: '444', Text: 'test', MatchType: 'Exact' } }
          ],
          dry_run: false,
          partial_failure: false
        },
        {
          request: async (url, body) => {
            calls.push(url);
            if (url.includes('/Campaigns')) return MOCK_PARTIAL_FAILURE_RESPONSE;
            return MOCK_KEYWORDS_ADD_RESPONSE;
          }
        }
      ),
      /All.*failed/
    );
  });

  test('all operations failed throws error', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaigns', update: { Id: 333, DailyBudget: -5 } }
          ],
          dry_run: false
        },
        {
          request: async () => MOCK_PARTIAL_FAILURE_RESPONSE
        }
      ),
      /All.*failed/
    );
  });

  test('handles API request failure gracefully', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaigns', create: { Name: 'Test' } }
          ],
          dry_run: false
        },
        {
          request: async () => { throw new Error('Network timeout'); }
        }
      ),
      /All.*failed/
    );
  });

  test('uses account_id from params over env', async () => {
    let capturedContext = null;

    await mutate(
      {
        account_id: '999',
        operations: [{ entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }],
        dry_run: false
      },
      {
        request: async (_url, _body, context) => {
          capturedContext = context;
          return MOCK_UPDATE_RESPONSE;
        }
      }
    );

    assert.equal(capturedContext.accountId, '999');
  });

  test('response format matches expected structure', async () => {
    const result = await mutate(
      {
        operations: [{ entity: 'campaigns', update: { Id: 333, Status: 'Paused' } }],
        dry_run: false
      },
      {
        request: async () => MOCK_UPDATE_RESPONSE
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.success, true);
    assert.ok(payload.summary);
    assert.ok(Array.isArray(payload.data));
    assert.ok(payload.metadata);
    assert.equal(typeof payload.metadata.succeeded, 'number');
    assert.equal(typeof payload.metadata.failed, 'number');
    assert.ok(payload.metadata.accountId);
    assert.ok(payload.metadata.customerId);
  });

  test('negative keyword create with partial errors returns mixed results', async () => {
    const result = await mutate(
      {
        operations: [
          { entity: 'negative_keywords', create: { entity_id: '333', entity_type: 'Campaign', Text: 'free', MatchType: 'Phrase' } },
          { entity: 'negative_keywords', create: { entity_id: '333', entity_type: 'Campaign', Text: 'bad', MatchType: 'Invalid' } }
        ],
        dry_run: false
      },
      {
        request: async () => MOCK_NEGATIVE_KW_PARTIAL_ERROR_RESPONSE
      }
    );

    const payload = parseResult(result);
    assert.equal(payload.metadata.succeeded, 1);
    assert.equal(payload.metadata.failed, 1);
    assert.equal(payload.data[0].success, true);
    assert.equal(payload.data[0].id, '111');
    assert.equal(payload.data[1].success, false);
    assert.equal(payload.data[1].error.code, 4802);
  });

  test('results sorted by original index', async () => {
    const result = await mutate(
      {
        operations: [
          { entity: 'keywords', create: { ad_group_id: '444', Text: 'kw1', MatchType: 'Exact' } },
          { entity: 'campaigns', update: { Id: 333, Status: 'Paused' } },
          { entity: 'keywords', create: { ad_group_id: '444', Text: 'kw2', MatchType: 'Phrase' } }
        ],
        dry_run: false
      },
      {
        request: async (url) => {
          if (url.includes('/Campaigns')) return MOCK_UPDATE_RESPONSE;
          return MOCK_KEYWORDS_ADD_RESPONSE;
        }
      }
    );

    const payload = parseResult(result);
    const indices = payload.data.map((r) => r.index);
    assert.deepEqual(indices, [0, 1, 2]);
  });
});
