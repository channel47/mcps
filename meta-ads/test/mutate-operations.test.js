import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateOperations,
  buildApiRequest,
  buildRequestPreview
} from '../server/utils/mutate-operations.js';

describe('validateOperations', () => {
  test('returns no errors for valid create operation', () => {
    const ops = [
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Test Campaign',
          objective: 'OUTCOME_TRAFFIC'
        }
      }
    ];

    const errors = validateOperations(ops);
    assert.equal(errors.length, 0);
  });

  test('returns errors for unsupported entity and missing params', () => {
    const ops = [
      {
        entity: 'keyword',
        action: 'create',
        params: {}
      },
      {
        entity: 'campaign',
        action: 'update',
        params: {
          status: 'PAUSED'
        }
      }
    ];

    const errors = validateOperations(ops);
    assert.equal(errors.length, 2);
    assert.match(errors[0].message, /Unsupported entity/);
    assert.match(errors[1].message, /requires id/);
  });
});

describe('buildApiRequest', () => {
  test('builds campaign create request on account endpoint', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Campaign A'
        }
      },
      '12345'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/act_12345/campaigns');
    assert.equal(request.params.name, 'Campaign A');
  });

  test('builds pause action as update with PAUSED status', () => {
    const request = buildApiRequest(
      {
        entity: 'adset',
        action: 'pause',
        id: '98765'
      },
      '12345'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/98765');
    assert.equal(request.params.status, 'PAUSED');
  });

  test('builds enable action as update with ACTIVE status', () => {
    const request = buildApiRequest(
      {
        entity: 'ad',
        action: 'enable',
        id: '55555'
      },
      '12345'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/55555');
    assert.equal(request.params.status, 'ACTIVE');
  });

  test('builds delete action request', () => {
    const request = buildApiRequest(
      {
        entity: 'audience',
        action: 'delete',
        id: '22222'
      },
      '12345'
    );

    assert.equal(request.method, 'DELETE');
    assert.equal(request.path, '/22222');
    assert.deepEqual(request.params, {});
  });
});

describe('buildRequestPreview', () => {
  test('returns human-readable preview for all operations', () => {
    const preview = buildRequestPreview(
      [
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
            daily_budget: '5000'
          }
        }
      ],
      '12345'
    );

    assert.equal(preview.requests.length, 2);
    assert.equal(preview.requests[0].path, '/act_12345/campaigns');
    assert.equal(preview.requests[1].path, '/9001');
    assert.equal(preview.requests[1].method, 'POST');
  });
});
