import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mutate } from '../server/tools/mutate.js';
import {
  MOCK_MUTATE_CREATE_CAMPAIGN_RESPONSE,
  MOCK_MUTATE_UPDATE_RESPONSE,
  MOCK_MUTATE_STATUS_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.TIKTOK_ADS_ADVERTISER_ID = '7000000000000000001';
  delete process.env.TIKTOK_ADS_READ_ONLY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('mutate - dry run', () => {
  test('defaults to dry run and previews requests without calling the API', async () => {
    let calls = 0;

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'create',
            params: {
              campaign_name: 'Campaign A',
              objective_type: 'TRAFFIC'
            }
          },
          {
            entity: 'adgroup',
            action: 'pause',
            id: '8001'
          }
        ]
      },
      {
        request: async () => {
          calls += 1;
          return { code: 0, data: {} };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(calls, 0);
    assert.equal(body.metadata.dryRun, true);
    assert.equal(body.metadata.serverValidated, false);
    assert.equal(body.metadata.apiCallCount, 2);
    assert.match(body.summary, /No changes applied/);

    assert.equal(body.data[0].method, 'POST');
    assert.equal(body.data[0].path, '/campaign/create/');
    assert.equal(body.data[0].body.operation_status, 'DISABLE');
    assert.equal(body.data[1].path, '/adgroup/status/update/');
    assert.deepEqual(body.data[1].body.adgroup_ids, ['8001']);
  });

  test('dry run works in read-only mode', async () => {
    process.env.TIKTOK_ADS_READ_ONLY = 'true';

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'pause',
            id: '9001'
          }
        ]
      },
      {
        request: async () => {
          throw new Error('should not be called');
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.dryRun, true);
  });

  test('throws validation errors for invalid operations', async () => {
    await assert.rejects(
      () => mutate({
        operations: [
          {
            entity: 'campaign',
            action: 'update',
            params: {
              budget: 100
            }
          }
        ]
      }),
      /Invalid operations: \[0\] update requires id/
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
            params: {
              campaign_name: 'Campaign A',
              objective_type: 'TRAFFIC'
            }
          },
          {
            entity: 'campaign',
            action: 'update',
            id: '9001',
            params: {
              budget: 750
            }
          },
          {
            entity: 'campaign',
            action: 'delete',
            id: '9002'
          }
        ],
        dry_run: false
      },
      {
        request: async (path, params, options) => {
          calls.push({ path, params, options });
          if (path === '/campaign/create/') {
            return MOCK_MUTATE_CREATE_CAMPAIGN_RESPONSE;
          }
          if (path === '/campaign/status/update/') {
            return MOCK_MUTATE_STATUS_RESPONSE;
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

    assert.equal(calls[0].path, '/campaign/create/');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.body.advertiser_id, '7000000000000000001');
    assert.equal(calls[0].options.body.operation_status, 'DISABLE');
    assert.equal(calls[1].path, '/campaign/update/');
    assert.equal(calls[1].options.body.campaign_id, '9001');
    assert.equal(calls[2].path, '/campaign/status/update/');
    assert.equal(calls[2].options.body.operation_status, 'DELETE');

    assert.equal(body.data[0].id, '99887766');
  });

  test('continues on per-operation failure when partial_failure=true', async () => {
    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'pause',
            id: '111'
          },
          {
            entity: 'campaign',
            action: 'pause',
            id: '222'
          }
        ],
        dry_run: false,
        partial_failure: true
      },
      {
        request: async (_path, _params, options) => {
          if (options.body.campaign_ids[0] === '111') {
            throw new Error('Request failed for 111');
          }
          return MOCK_MUTATE_STATUS_RESPONSE;
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
            {
              entity: 'campaign',
              action: 'pause',
              id: '111'
            },
            {
              entity: 'campaign',
              action: 'pause',
              id: '222'
            }
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
    process.env.TIKTOK_ADS_READ_ONLY = 'true';

    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'create',
              params: {
                campaign_name: 'Campaign A',
                objective_type: 'TRAFFIC'
              }
            }
          ],
          dry_run: false
        },
        {
          request: async () => ({ code: 0, data: {} })
        }
      ),
      /read-only/
    );
  });

  test('throws when all live operations fail', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'adgroup',
              action: 'enable',
              id: '111'
            }
          ],
          dry_run: false
        },
        {
          request: async () => {
            throw new Error('TikTok API down');
          }
        }
      ),
      /All 1 operation\(s\) failed. First error: TikTok API down/
    );
  });

  test('throws when advertiser id is missing', async () => {
    delete process.env.TIKTOK_ADS_ADVERTISER_ID;

    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'pause',
              id: '111'
            }
          ]
        },
        {
          request: async () => ({ code: 0, data: {} })
        }
      ),
      /TIKTOK_ADS_ADVERTISER_ID/
    );
  });
});
