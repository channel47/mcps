import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MOCK_AD_GROUPS_RESPONSE,
  MOCK_ADS_RESPONSE,
  MOCK_CAMPAIGNS_RESPONSE,
  MOCK_EDITORIAL_REASONS_RESPONSE,
  MOCK_KEYWORDS_RESPONSE
} from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('query', () => {
  test('routes campaigns query with required campaign_type', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let captured = null;

    const result = await query(
      { entity: 'campaigns', campaign_type: 'Search' },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return MOCK_CAMPAIGNS_RESPONSE;
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(captured.url.endsWith('/Campaigns/QueryByAccountId'), true);
    assert.equal(captured.body.AccountId, 123123123);
    assert.equal(captured.body.CampaignType, 'Search');
    assert.equal(payload.data[0].id, '333333333');
    assert.equal(payload.data[0].bidding_scheme_type, 'EnhancedCpcBiddingScheme');
  });

  test('defaults to all campaign types when campaign_type omitted', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let captured = null;

    await query(
      { entity: 'campaigns' },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return MOCK_CAMPAIGNS_RESPONSE;
        }
      }
    );

    assert.equal(captured.body.CampaignType, 'Search,Shopping,DynamicSearchAds,Audience,PerformanceMax');
  });

  test('requires campaign_id for ad_groups entity', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');

    await assert.rejects(
      () => query({ entity: 'ad_groups' }, { request: async () => MOCK_AD_GROUPS_RESPONSE }),
      /campaign_id/
    );
  });

  test('routes keywords query by ad_group_id', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let captured = null;

    const result = await query(
      {
        entity: 'keywords',
        ad_group_id: '444444444'
      },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return MOCK_KEYWORDS_RESPONSE;
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(captured.url.endsWith('/Keywords/QueryByAdGroupId'), true);
    assert.equal(captured.body.AdGroupId, 444444444);
    assert.equal(payload.data[0].text, 'channel 47');
    assert.equal(payload.data[0].editorial_status, 'Active');
    assert.equal(payload.data[0].bid_amount, 2.15);
  });

  test('routes ads query by ad_group_id', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let captured = null;

    const result = await query(
      {
        entity: 'ads',
        ad_group_id: '444444444'
      },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return MOCK_ADS_RESPONSE;
        }
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(captured.url.endsWith('/Ads/QueryByAdGroupId'), true);
    assert.equal(captured.body.AdGroupId, 444444444);
    assert.ok(Array.isArray(captured.body.AdTypes));
    assert.ok(captured.body.AdTypes.includes('ResponsiveSearch'));
    assert.equal(payload.data[0].type, 'ResponsiveSearchAd');
    assert.equal(payload.data[0].editorial_status, 'ActiveLimited');
    assert.deepEqual(payload.data[0].headlines, [
      { text: 'Official Channel 47', editorial_status: 'Active' }
    ]);
    assert.deepEqual(payload.data[0].descriptions, [
      { text: 'Shop direct from Channel 47.', editorial_status: 'Disapproved' }
    ]);
  });

  test('includes CampaignType when explicitly provided', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let captured = null;

    await query(
      { entity: 'campaigns', campaign_type: 'Search Shopping' },
      {
        request: async (url, body, context) => {
          captured = { url, body, context };
          return { Campaigns: [] };
        }
      }
    );

    assert.equal(captured.body.CampaignType, 'Search Shopping');
  });

  test('prefers account_id param over env default', async () => {
    const { query } = await import('../server/tools/query-campaigns.js');
    let capturedContext = null;

    await query(
      {
        entity: 'campaigns',
        campaign_type: 'Search',
        account_id: '888'
      },
      {
        request: async (_url, _body, context) => {
          capturedContext = context;
          return { Campaigns: [] };
        }
      }
    );

    assert.equal(capturedContext.accountId, '888');
  });
});
