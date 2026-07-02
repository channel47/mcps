import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildApiRequest,
  buildRequestPreview,
  validateOperations,
  DEFAULT_CREATE_STATUS
} from '../server/utils/mutate-operations.js';

describe('validateOperations', () => {
  test('returns no errors for valid operations', () => {
    const errors = validateOperations([
      {
        entity: 'campaign',
        action: 'create',
        params: {
          name: 'Test Campaign',
          campaignGroup: 'urn:li:sponsoredCampaignGroup:601',
          costType: 'CPC'
        }
      },
      {
        entity: 'campaign_group',
        action: 'pause',
        id: '601'
      },
      {
        entity: 'creative',
        action: 'create',
        params: {
          campaign: '1001',
          content: { reference: 'urn:li:share:123' }
        }
      }
    ]);

    assert.equal(errors.length, 0);
  });

  test('flags unsupported entity and action', () => {
    const errors = validateOperations([
      { entity: 'adset', action: 'create', params: {} },
      { entity: 'campaign', action: 'delete', id: '1' }
    ]);

    assert.equal(errors.length, 2);
    assert.match(errors[0].message, /Unsupported entity: adset/);
    assert.match(errors[1].message, /Unsupported action: delete/);
  });

  test('flags missing params for create/update and missing id for item actions', () => {
    const errors = validateOperations([
      { entity: 'campaign', action: 'create' },
      { entity: 'campaign', action: 'update', params: { name: 'x' } },
      { entity: 'campaign', action: 'archive' }
    ]);

    assert.equal(errors.length, 3);
    assert.match(errors[0].message, /create requires params object/);
    assert.match(errors[1].message, /update requires id/);
    assert.match(errors[2].message, /archive requires id/);
  });

  test('requires campaign reference for creative creates', () => {
    const errors = validateOperations([
      { entity: 'creative', action: 'create', params: { content: {} } }
    ]);

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /creative create requires params\.campaign/);
  });

  test('throws when operations is not a non-empty array', () => {
    assert.throws(() => validateOperations([]), /operations must be a non-empty array/);
    assert.throws(() => validateOperations(undefined), /operations must be a non-empty array/);
  });
});

describe('buildApiRequest', () => {
  test('campaign create posts to the account collection with DRAFT default and account URN', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'create',
        params: { name: 'Campaign A', costType: 'CPC' }
      },
      '512345678'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/adAccounts/512345678/adCampaigns');
    assert.deepEqual(request.headers, {});
    assert.equal(request.body.status, DEFAULT_CREATE_STATUS);
    assert.equal(request.body.account, 'urn:li:sponsoredAccount:512345678');
    assert.equal(request.body.name, 'Campaign A');
  });

  test('explicit status overrides the create default', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign_group',
        action: 'create',
        params: { name: 'Group A', status: 'ACTIVE' }
      },
      '512345678'
    );

    assert.equal(request.path, '/adAccounts/512345678/adCampaignGroups');
    assert.equal(request.body.status, 'ACTIVE');
  });

  test('creative create defaults intendedStatus and normalizes campaign URN', () => {
    const request = buildApiRequest(
      {
        entity: 'creative',
        action: 'create',
        params: { campaign: '1001', content: { reference: 'urn:li:share:123' } }
      },
      '512345678'
    );

    assert.equal(request.path, '/adAccounts/512345678/creatives');
    assert.equal(request.body.intendedStatus, DEFAULT_CREATE_STATUS);
    assert.equal(request.body.campaign, 'urn:li:sponsoredCampaign:1001');
    assert.equal(request.body.account, undefined);
  });

  test('update builds a Rest.li partial update with patch $set body', () => {
    const request = buildApiRequest(
      {
        entity: 'campaign',
        action: 'update',
        id: '1001',
        params: { dailyBudget: { amount: '75', currencyCode: 'USD' } }
      },
      '512345678'
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/adAccounts/512345678/adCampaigns/1001');
    assert.equal(request.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.deepEqual(request.body, {
      patch: {
        $set: {
          dailyBudget: { amount: '75', currencyCode: 'USD' }
        }
      }
    });
  });

  test('pause/enable/archive set campaign status via partial update', () => {
    const pause = buildApiRequest({ entity: 'campaign', action: 'pause', id: '1001' }, '512345678');
    const enable = buildApiRequest({ entity: 'campaign', action: 'enable', id: '1001' }, '512345678');
    const archive = buildApiRequest({ entity: 'campaign', action: 'archive', id: '1001' }, '512345678');

    assert.equal(pause.body.patch.$set.status, 'PAUSED');
    assert.equal(enable.body.patch.$set.status, 'ACTIVE');
    assert.equal(archive.body.patch.$set.status, 'ARCHIVED');
  });

  test('creative status changes target intendedStatus with percent-encoded URN path', () => {
    const request = buildApiRequest(
      { entity: 'creative', action: 'pause', id: '301' },
      '512345678'
    );

    assert.equal(request.path, '/adAccounts/512345678/creatives/urn%3Ali%3AsponsoredCreative%3A301');
    assert.equal(request.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.deepEqual(request.body.patch.$set, { intendedStatus: 'PAUSED' });
  });

  test('accepts full URN ids for campaigns and creatives', () => {
    const campaign = buildApiRequest(
      { entity: 'campaign', action: 'pause', id: 'urn:li:sponsoredCampaign:1001' },
      '512345678'
    );
    const creative = buildApiRequest(
      { entity: 'creative', action: 'enable', id: 'urn:li:sponsoredCreative:301' },
      '512345678'
    );

    assert.equal(campaign.path, '/adAccounts/512345678/adCampaigns/1001');
    assert.equal(creative.path, '/adAccounts/512345678/creatives/urn%3Ali%3AsponsoredCreative%3A301');
  });
});

describe('buildRequestPreview', () => {
  test('previews method, path, headers, and body per operation', () => {
    const preview = buildRequestPreview(
      [
        { entity: 'campaign', action: 'create', params: { name: 'Campaign A' } },
        { entity: 'campaign', action: 'pause', id: '1001' }
      ],
      '512345678'
    );

    assert.equal(preview.requests.length, 2);

    const [create, pause] = preview.requests;
    assert.equal(create.index, 0);
    assert.equal(create.method, 'POST');
    assert.equal(create.path, '/adAccounts/512345678/adCampaigns');
    assert.match(create.headers['LinkedIn-Version'], /^\d{6}$/);
    assert.equal(create.headers['X-Restli-Protocol-Version'], '2.0.0');
    assert.equal(create.headers.Authorization, undefined);

    assert.equal(pause.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.deepEqual(pause.body.patch.$set, { status: 'PAUSED' });
  });
});
