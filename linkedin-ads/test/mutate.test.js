import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mutate } from '../server/tools/mutate.js';
import { MOCK_MUTATE_CREATE_RESPONSE, MOCK_MUTATE_UPDATE_RESPONSE } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.LINKEDIN_ADS_ACCOUNT_ID = '512345678';
  delete process.env.LINKEDIN_ADS_READ_ONLY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('mutate - dry run', () => {
  test('returns a request preview without calling the API', async () => {
    let calls = 0;

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'create',
            params: { name: 'Campaign A', costType: 'CPC' }
          },
          {
            entity: 'campaign',
            action: 'pause',
            id: '1001'
          }
        ]
      },
      {
        request: async () => {
          calls += 1;
          return {};
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(calls, 0);
    assert.equal(body.metadata.dryRun, true);
    assert.equal(body.metadata.serverValidated, false);
    assert.equal(body.metadata.apiCallCount, 2);
    assert.match(body.summary, /no API calls were made/i);

    const [create, pause] = body.data;
    assert.equal(create.method, 'POST');
    assert.equal(create.path, '/adAccounts/512345678/adCampaigns');
    assert.equal(create.body.status, 'DRAFT');
    assert.equal(pause.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.deepEqual(pause.body, { patch: { $set: { status: 'PAUSED' } } });
  });

  test('dry run works in read-only mode', async () => {
    process.env.LINKEDIN_ADS_READ_ONLY = 'true';

    const result = await mutate(
      {
        operations: [
          { entity: 'campaign', action: 'pause', id: '1001' }
        ]
      },
      { request: async () => ({}) }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.dryRun, true);
  });

  test('rejects invalid operations with indexed messages', async () => {
    await assert.rejects(
      () => mutate({
        operations: [
          { entity: 'campaign', action: 'update', params: { status: 'PAUSED' } },
          { entity: 'keyword', action: 'create', params: {} }
        ]
      }),
      /Invalid operations: \[0\] update requires id; \[1\] Unsupported entity: keyword/
    );
  });
});

describe('mutate - live execution', () => {
  test('executes operations and returns per-operation results', async () => {
    const calls = [];

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'create',
            params: { name: 'Campaign A', costType: 'CPC' }
          },
          {
            entity: 'campaign',
            action: 'update',
            id: '1001',
            params: { name: 'Renamed' }
          },
          {
            entity: 'creative',
            action: 'pause',
            id: '301'
          }
        ],
        dry_run: false
      },
      {
        request: async (path, params, options) => {
          calls.push({ path, params, options });
          if (path === '/adAccounts/512345678/adCampaigns') {
            return MOCK_MUTATE_CREATE_RESPONSE;
          }
          return MOCK_MUTATE_UPDATE_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.dryRun, false);
    assert.equal(body.metadata.operationCount, 3);
    assert.equal(body.metadata.succeeded, 3);
    assert.equal(calls.length, 3);

    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.body.status, 'DRAFT');
    assert.equal(calls[1].path, '/adAccounts/512345678/adCampaigns/1001');
    assert.equal(calls[1].options.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.equal(calls[2].path, '/adAccounts/512345678/creatives/urn%3Ali%3AsponsoredCreative%3A301');

    assert.equal(body.data[0].id, '99887766');
    assert.equal(body.data[1].id, '1001');
  });

  test('continues on per-operation failure when partial_failure=true', async () => {
    const result = await mutate(
      {
        operations: [
          { entity: 'campaign', action: 'pause', id: '111' },
          { entity: 'campaign', action: 'pause', id: '222' }
        ],
        dry_run: false,
        partial_failure: true
      },
      {
        request: async (path) => {
          if (path.endsWith('/111')) {
            throw new Error('Request failed for 111');
          }
          return {};
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.metadata.failed, 1);
    assert.equal(body.metadata.succeeded, 1);
    assert.match(body.data[0].error.message, /Request failed for 111/);
  });

  test('stops on first failure when partial_failure=false', async () => {
    let calls = 0;

    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaign', action: 'pause', id: '111' },
            { entity: 'campaign', action: 'pause', id: '222' }
          ],
          dry_run: false,
          partial_failure: false
        },
        {
          request: async () => {
            calls += 1;
            throw new Error('Request failed');
          }
        }
      ),
      /All 1 operation\(s\) failed/
    );

    assert.equal(calls, 1);
  });

  test('throws when read-only mode is enabled', async () => {
    process.env.LINKEDIN_ADS_READ_ONLY = 'true';

    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaign', action: 'pause', id: '1001' }
          ],
          dry_run: false
        },
        { request: async () => ({}) }
      ),
      /read-only/
    );
  });

  test('throws when all live operations fail', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [
            { entity: 'campaign', action: 'update', id: '111', params: { name: 'x' } }
          ],
          dry_run: false
        },
        {
          request: async () => {
            throw new Error('LinkedIn API down');
          }
        }
      ),
      /All 1 operation\(s\) failed. First error: LinkedIn API down/
    );
  });
});
