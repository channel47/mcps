import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_MUTATE_ACTIONS,
  SUPPORTED_MUTATE_ENTITIES,
  buildApiRequest,
  buildRequestPreview,
  validateOperations
} from '../server/utils/mutate-operations.js';

describe('supported entities and actions', () => {
  test('supports campaign, ad_group, and ad entities', () => {
    assert.deepEqual(SUPPORTED_MUTATE_ENTITIES, ['campaign', 'ad_group', 'ad']);
  });

  test('does not offer a delete action (Pinterest is archive-only)', () => {
    assert.deepEqual(SUPPORTED_MUTATE_ACTIONS, ['create', 'update', 'pause', 'enable', 'archive']);
    assert.equal(SUPPORTED_MUTATE_ACTIONS.includes('delete'), false);
  });
});

describe('validateOperations', () => {
  test('returns no errors for valid create operations', () => {
    const errors = validateOperations([
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Test Campaign',
          objective_type: 'WEB_CONVERSION'
        }
      },
      {
        entity: 'ad_group',
        action: 'create',
        params: {
          name: 'Test Ad Group',
          campaign_id: '626735565838',
          billable_event: 'CLICKTHROUGH'
        }
      },
      {
        entity: 'ad',
        action: 'create',
        params: {
          ad_group_id: '2680059592705',
          pin_id: '123456789',
          creative_type: 'REGULAR'
        }
      }
    ]);

    assert.equal(errors.length, 0);
  });

  test('flags missing create required fields per entity', () => {
    const errors = validateOperations([
      {
        entity: 'campaign',
        action: 'create',
        params: { name: 'No objective' }
      },
      {
        entity: 'ad_group',
        action: 'create',
        params: { name: 'No campaign or billable event' }
      },
      {
        entity: 'ad',
        action: 'create',
        params: { pin_id: '1' }
      }
    ]);

    assert.equal(errors.length, 3);
    assert.match(errors[0].message, /campaign create requires params: objective_type/);
    assert.match(errors[1].message, /ad_group create requires params: campaign_id, billable_event/);
    assert.match(errors[2].message, /ad create requires params: ad_group_id, creative_type/);
  });

  test('flags unsupported entity, unsupported action, and missing id', () => {
    const errors = validateOperations([
      { entity: 'keyword', action: 'create', params: {} },
      { entity: 'campaign', action: 'delete', id: '1' },
      { entity: 'campaign', action: 'update', params: { status: 'PAUSED' } }
    ]);

    assert.equal(errors.length, 3);
    assert.match(errors[0].message, /Unsupported entity/);
    assert.match(errors[1].message, /Unsupported action.*use archive/);
    assert.match(errors[2].message, /requires id/);
  });

  test('throws when operations is not a non-empty array', () => {
    assert.throws(() => validateOperations([]), /non-empty array/);
    assert.throws(() => validateOperations(undefined), /non-empty array/);
  });
});

describe('buildApiRequest', () => {
  test('builds campaign create as POST with one-element array body', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Campaign A',
          objective_type: 'AWARENESS'
        }
      },
      '549755885175'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/ad_accounts/549755885175/campaigns');
    assert.equal(Array.isArray(request.body), true);
    assert.equal(request.body.length, 1);
    assert.equal(request.body[0].name, 'Campaign A');
  });

  test('defaults status to PAUSED on create', () => {
    const request = buildApiRequest(
      {
        entity: 'ad_group',
        action: 'create',
        params: {
          name: 'Ad Group A',
          campaign_id: '1',
          billable_event: 'IMPRESSION'
        }
      },
      '549755885175'
    );

    assert.equal(request.body[0].status, 'PAUSED');
  });

  test('explicit status overrides PAUSED default on create', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Campaign B',
          objective_type: 'AWARENESS',
          status: 'ACTIVE'
        }
      },
      '549755885175'
    );

    assert.equal(request.body[0].status, 'ACTIVE');
  });

  test('builds update as PATCH with id merged into body', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'update',
        id: '626735565838',
        params: {
          daily_spend_cap: 25000000
        }
      },
      '549755885175'
    );

    assert.equal(request.method, 'PATCH');
    assert.equal(request.path, '/ad_accounts/549755885175/campaigns');
    assert.deepEqual(request.body, [{ daily_spend_cap: 25000000, id: '626735565838' }]);
  });

  test('builds pause, enable, and archive as PATCH status changes', () => {
    const pause = buildApiRequest({ entity: 'ad', action: 'pause', id: '11' }, '549755885175');
    const enable = buildApiRequest({ entity: 'ad_group', action: 'enable', id: '22' }, '549755885175');
    const archive = buildApiRequest({ entity: 'campaign', action: 'archive', id: '33' }, '549755885175');

    assert.equal(pause.method, 'PATCH');
    assert.equal(pause.path, '/ad_accounts/549755885175/ads');
    assert.deepEqual(pause.body, [{ id: '11', status: 'PAUSED' }]);

    assert.equal(enable.path, '/ad_accounts/549755885175/ad_groups');
    assert.deepEqual(enable.body, [{ id: '22', status: 'ACTIVE' }]);

    assert.equal(archive.path, '/ad_accounts/549755885175/campaigns');
    assert.deepEqual(archive.body, [{ id: '33', status: 'ARCHIVED' }]);
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
            name: 'Campaign A',
            objective_type: 'AWARENESS'
          }
        },
        {
          entity: 'campaign',
          action: 'update',
          id: '626735565838',
          params: {
            lifetime_spend_cap: 100000000
          }
        }
      ],
      '549755885175'
    );

    assert.equal(preview.requests.length, 2);
    assert.equal(preview.requests[0].method, 'POST');
    assert.equal(preview.requests[0].path, '/ad_accounts/549755885175/campaigns');
    assert.equal(preview.requests[1].method, 'PATCH');
    assert.equal(preview.requests[1].body[0].id, '626735565838');
  });
});
