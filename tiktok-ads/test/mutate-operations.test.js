import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateOperations,
  buildApiRequest,
  buildRequestPreview
} from '../server/utils/mutate-operations.js';

const ADVERTISER_ID = '7000000000000000001';

describe('validateOperations', () => {
  test('returns no errors for valid create operation', () => {
    const ops = [
      {
        entity: 'campaign',
        action: 'create',
        params: {
          campaign_name: 'Test Campaign',
          objective_type: 'TRAFFIC'
        }
      }
    ];

    const errors = validateOperations(ops);
    assert.equal(errors.length, 0);
  });

  test('returns errors for unsupported entity and missing id', () => {
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
          budget: 500
        }
      },
      {
        entity: 'adgroup',
        action: 'pause'
      }
    ];

    const errors = validateOperations(ops);
    assert.equal(errors.length, 3);
    assert.match(errors[0].message, /Unsupported entity/);
    assert.match(errors[1].message, /requires id/);
    assert.match(errors[2].message, /requires id/);
  });

  test('allows ad update without id (targets live in creatives params)', () => {
    const ops = [
      {
        entity: 'ad',
        action: 'update',
        params: {
          adgroup_id: '456',
          creatives: [{ ad_id: '789', ad_name: 'Updated Ad' }]
        }
      }
    ];

    const errors = validateOperations(ops);
    assert.equal(errors.length, 0);
  });

  test('rejects unsupported action and missing params', () => {
    const errors = validateOperations([
      { entity: 'campaign', action: 'archive', id: '1' },
      { entity: 'campaign', action: 'create' }
    ]);

    assert.equal(errors.length, 2);
    assert.match(errors[0].message, /Unsupported action/);
    assert.match(errors[1].message, /requires params object/);
  });

  test('throws on empty operations array', () => {
    assert.throws(
      () => validateOperations([]),
      /operations must be a non-empty array/
    );
  });
});

describe('buildApiRequest', () => {
  test('builds campaign create request with DISABLE default', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'create',
        params: {
          campaign_name: 'Campaign A',
          objective_type: 'TRAFFIC'
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/campaign/create/');
    assert.equal(request.body.advertiser_id, ADVERTISER_ID);
    assert.equal(request.body.operation_status, 'DISABLE');
    assert.equal(request.body.campaign_name, 'Campaign A');
  });

  test('explicit operation_status overrides DISABLE default on create', () => {
    const request = buildApiRequest(
      {
        entity: 'adgroup',
        action: 'create',
        params: {
          adgroup_name: 'Ad Group A',
          operation_status: 'ENABLE'
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/adgroup/create/');
    assert.equal(request.body.operation_status, 'ENABLE');
  });

  test('ad create has no operation_status default (not supported by /ad/create/)', () => {
    const request = buildApiRequest(
      {
        entity: 'ad',
        action: 'create',
        params: {
          adgroup_id: '456',
          creatives: [{ ad_name: 'Ad A' }]
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/ad/create/');
    assert.equal(request.body.operation_status, undefined);
    assert.deepEqual(request.body.creatives, [{ ad_name: 'Ad A' }]);
  });

  test('builds campaign update with singular id field', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'update',
        id: '9001',
        params: {
          budget: 500
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/campaign/update/');
    assert.equal(request.body.campaign_id, '9001');
    assert.equal(request.body.budget, 500);
  });

  test('builds adgroup update with adgroup_id field', () => {
    const request = buildApiRequest(
      {
        entity: 'adgroup',
        action: 'update',
        id: '8001',
        params: {
          adgroup_name: 'Renamed'
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/adgroup/update/');
    assert.equal(request.body.adgroup_id, '8001');
  });

  test('ad update passes params through without top-level ad_id injection', () => {
    const request = buildApiRequest(
      {
        entity: 'ad',
        action: 'update',
        params: {
          adgroup_id: '456',
          creatives: [{ ad_id: '789', ad_name: 'Updated' }]
        }
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/ad/update/');
    assert.equal(request.body.ad_id, undefined);
    assert.equal(request.body.creatives[0].ad_id, '789');
  });

  test('builds pause action as status update with DISABLE', () => {
    const request = buildApiRequest(
      {
        entity: 'adgroup',
        action: 'pause',
        id: '98765'
      },
      ADVERTISER_ID
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/adgroup/status/update/');
    assert.deepEqual(request.body.adgroup_ids, ['98765']);
    assert.equal(request.body.operation_status, 'DISABLE');
  });

  test('builds enable action as status update with ENABLE', () => {
    const request = buildApiRequest(
      {
        entity: 'ad',
        action: 'enable',
        id: '55555'
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/ad/status/update/');
    assert.deepEqual(request.body.ad_ids, ['55555']);
    assert.equal(request.body.operation_status, 'ENABLE');
  });

  test('builds delete action as status update with DELETE', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'delete',
        id: '22222'
      },
      ADVERTISER_ID
    );

    assert.equal(request.path, '/campaign/status/update/');
    assert.deepEqual(request.body.campaign_ids, ['22222']);
    assert.equal(request.body.operation_status, 'DELETE');
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
            campaign_name: 'Campaign A',
            objective_type: 'TRAFFIC'
          }
        },
        {
          entity: 'campaign',
          action: 'update',
          id: '9001',
          params: {
            budget: 500
          }
        }
      ],
      ADVERTISER_ID
    );

    assert.equal(preview.requests.length, 2);
    assert.equal(preview.requests[0].path, '/campaign/create/');
    assert.equal(preview.requests[0].method, 'POST');
    assert.equal(preview.requests[1].path, '/campaign/update/');
    assert.equal(preview.requests[1].body.campaign_id, '9001');
  });
});
