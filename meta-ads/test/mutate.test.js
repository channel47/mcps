import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mutate } from '../server/tools/mutate.js';
import {
  MOCK_MUTATE_CREATE_RESPONSE,
  MOCK_MUTATE_UPDATE_RESPONSE,
  MOCK_MUTATE_DELETE_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.META_ADS_ACCOUNT_ID = '1234567890';
  delete process.env.META_ADS_READ_ONLY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('mutate - dry run', () => {
  test('defaults to dry_run=true and returns request preview', async () => {
    const result = await mutate({
      operations: [
        {
          entity: 'campaign',
          action: 'create',
          params: {
            name: 'Campaign A'
          }
        }
      ]
    });

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.dryRun, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].path, '/act_1234567890/campaigns');
  });

  test('returns validation errors for invalid operations', async () => {
    await assert.rejects(
      () => mutate({
        operations: [
          {
            entity: 'campaign',
            action: 'update',
            params: {
              status: 'PAUSED'
            }
          }
        ]
      }),
      /Invalid operations/
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
              name: 'Campaign A'
            }
          },
          {
            entity: 'campaign',
            action: 'update',
            id: '9001',
            params: {
              daily_budget: '7500'
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
          if (options.method === 'DELETE') {
            return MOCK_MUTATE_DELETE_RESPONSE;
          }
          if (path === '/act_1234567890/campaigns') {
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
    assert.equal(calls[0].path, '/act_1234567890/campaigns');
    assert.equal(calls[1].path, '/9001');
    assert.equal(calls[2].options.method, 'DELETE');
  });

  test('continues on per-operation failure when partial_failure=true', async () => {
    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'update',
            id: '111',
            params: {
              status: 'PAUSED'
            }
          },
          {
            entity: 'campaign',
            action: 'update',
            id: '222',
            params: {
              status: 'ACTIVE'
            }
          }
        ],
        dry_run: false,
        partial_failure: true
      },
      {
        request: async (path) => {
          if (path === '/111') {
            throw new Error('Request failed for 111');
          }
          return { success: true };
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.metadata.failed, 1);
    assert.equal(body.metadata.succeeded, 1);
  });

  test('stops on first failure when partial_failure=false', async () => {
    let calls = 0;

    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'update',
              id: '111',
              params: {
                status: 'PAUSED'
              }
            },
            {
              entity: 'campaign',
              action: 'update',
              id: '222',
              params: {
                status: 'ACTIVE'
              }
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
    process.env.META_ADS_READ_ONLY = 'true';

    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'create',
              params: {
                name: 'Campaign A'
              }
            }
          ],
          dry_run: false
        },
        {
          request: async () => ({ id: '1' })
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
              entity: 'campaign',
              action: 'update',
              id: '111',
              params: {
                status: 'PAUSED'
              }
            }
          ],
          dry_run: false
        },
        {
          request: async () => {
            throw new Error('Meta API down');
          }
        }
      ),
      /All 1 operation\(s\) failed/
    );
  });
});
