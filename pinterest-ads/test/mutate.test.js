import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mutate } from '../server/tools/mutate.js';
import {
  MOCK_MUTATE_CREATE_RESPONSE,
  MOCK_MUTATE_UPDATE_RESPONSE,
  MOCK_MUTATE_EXCEPTION_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  process.env.PINTEREST_ADS_AD_ACCOUNT_ID = '549755885175';
  delete process.env.PINTEREST_ADS_READ_ONLY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('mutate - dry run', () => {
  test('returns request preview without calling the API', async () => {
    let calls = 0;

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'create',
            params: {
              name: 'Campaign A',
              objective_type: 'AWARENESS'
            }
          },
          {
            entity: 'ad',
            action: 'pause',
            id: '888'
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
    assert.match(body.summary, /no API calls were made/);

    assert.equal(body.data[0].method, 'POST');
    assert.equal(body.data[0].path, '/ad_accounts/549755885175/campaigns');
    assert.equal(body.data[0].body[0].status, 'PAUSED');
    assert.equal(body.data[1].method, 'PATCH');
    assert.deepEqual(body.data[1].body, [{ id: '888', status: 'PAUSED' }]);
  });

  test('throws typed error for invalid operations before previewing', async () => {
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
      /Invalid operations: \[0\] update requires id/
    );
  });

  test('rejects delete operations with archive guidance', async () => {
    await assert.rejects(
      () => mutate({
        operations: [
          {
            entity: 'campaign',
            action: 'delete',
            id: '626735565838'
          }
        ]
      }),
      /Unsupported action: delete.*use archive/
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
              name: 'Campaign A',
              objective_type: 'AWARENESS'
            }
          },
          {
            entity: 'campaign',
            action: 'pause',
            id: '626735565838'
          }
        ],
        dry_run: false
      },
      {
        request: async (path, params, options) => {
          calls.push({ path, params, options });
          if (options.method === 'POST') {
            return MOCK_MUTATE_CREATE_RESPONSE;
          }
          return MOCK_MUTATE_UPDATE_RESPONSE;
        }
      }
    );

    const body = parseResult(result);
    assert.equal(body.success, true);
    assert.equal(body.metadata.dryRun, false);
    assert.equal(body.metadata.succeeded, 2);
    assert.equal(body.metadata.failed, 0);
    assert.equal(calls.length, 2);

    assert.equal(calls[0].path, '/ad_accounts/549755885175/campaigns');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(calls[0].options.body[0].name, 'Campaign A');
    assert.equal(calls[1].options.method, 'PATCH');
    assert.deepEqual(calls[1].options.body, [{ id: '626735565838', status: 'PAUSED' }]);

    assert.equal(body.data[0].id, '626744128982');
    assert.equal(body.data[1].id, '626735565838');
  });

  test('treats per-item exceptions in a 200 response as failures', async () => {
    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'create',
            params: {
              name: 'Campaign A',
              objective_type: 'AWARENESS'
            }
          },
          {
            entity: 'campaign',
            action: 'pause',
            id: '626735565838'
          }
        ],
        dry_run: false
      },
      {
        request: async (_path, _params, options) => (
          options.method === 'POST' ? MOCK_MUTATE_EXCEPTION_RESPONSE : MOCK_MUTATE_UPDATE_RESPONSE
        )
      }
    );

    const body = parseResult(result);
    assert.equal(body.metadata.succeeded, 1);
    assert.equal(body.metadata.failed, 1);
    assert.equal(body.data[0].success, false);
    assert.match(body.data[0].error.message, /\[code 2384\] Invalid objective type/);
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
            action: 'enable',
            id: '222'
          }
        ],
        dry_run: false,
        partial_failure: true
      },
      {
        request: async (_path, _params, options) => {
          if (options.body[0].id === '111') {
            throw new Error('Request failed for 111');
          }
          return MOCK_MUTATE_UPDATE_RESPONSE;
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
              action: 'pause',
              id: '111'
            },
            {
              entity: 'campaign',
              action: 'enable',
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
    process.env.PINTEREST_ADS_READ_ONLY = 'true';

    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'create',
              params: {
                name: 'Campaign A',
                objective_type: 'AWARENESS'
              }
            }
          ],
          dry_run: false
        },
        {
          request: async () => MOCK_MUTATE_CREATE_RESPONSE
        }
      ),
      /read-only/
    );
  });

  test('still allows dry_run preview in read-only mode', async () => {
    process.env.PINTEREST_ADS_READ_ONLY = 'true';

    const result = await mutate(
      {
        operations: [
          {
            entity: 'campaign',
            action: 'archive',
            id: '626735565838'
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
    assert.equal(body.metadata.dryRun, true);
  });

  test('throws when all live operations fail', async () => {
    await assert.rejects(
      () => mutate(
        {
          operations: [
            {
              entity: 'campaign',
              action: 'pause',
              id: '111'
            }
          ],
          dry_run: false
        },
        {
          request: async () => {
            throw new Error('Pinterest API down');
          }
        }
      ),
      /All 1 operation\(s\) failed/
    );
  });

  test('throws when ad account id is missing', async () => {
    delete process.env.PINTEREST_ADS_AD_ACCOUNT_ID;

    await assert.rejects(
      () => mutate({
        operations: [
          {
            entity: 'campaign',
            action: 'pause',
            id: '111'
          }
        ]
      }),
      /PINTEREST_ADS_AD_ACCOUNT_ID/
    );
  });
});
