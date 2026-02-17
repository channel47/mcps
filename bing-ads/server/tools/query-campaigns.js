import { BING_BASE_URLS, bingRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import {
  getAccountId,
  getCustomerId,
  validateEnum,
  validateRequired
} from '../utils/validation.js';

const ENTITY_OPTIONS = ['campaigns', 'ad_groups', 'keywords', 'ads'];

const ENTITY_ENDPOINTS = {
  campaigns: `${BING_BASE_URLS.campaignManagement}/Campaigns/QueryByAccountId`,
  ad_groups: `${BING_BASE_URLS.campaignManagement}/AdGroups/QueryByCampaignId`,
  keywords: `${BING_BASE_URLS.campaignManagement}/Keywords/QueryByAdGroupId`,
  ads: `${BING_BASE_URLS.campaignManagement}/Ads/QueryByAdGroupId`
};

const ENTITY_RESPONSE_KEYS = {
  campaigns: 'Campaigns',
  ad_groups: 'AdGroups',
  keywords: 'Keywords',
  ads: 'Ads'
};

function normalizeCampaign(campaign) {
  return {
    id: String(campaign?.Id ?? ''),
    name: campaign?.Name ?? '',
    status: campaign?.Status ?? '',
    campaign_type: campaign?.CampaignType ?? '',
    budget_type: campaign?.BudgetType ?? '',
    daily_budget: campaign?.DailyBudget ?? null,
    bidding_scheme_type: campaign?.BiddingScheme?.Type ?? null
  };
}

function normalizeAdGroup(adGroup) {
  return {
    id: String(adGroup?.Id ?? ''),
    campaign_id: adGroup?.CampaignId ? String(adGroup.CampaignId) : null,
    name: adGroup?.Name ?? '',
    status: adGroup?.Status ?? '',
    cpc_bid_amount: adGroup?.CpcBid?.Amount ?? null
  };
}

function normalizeKeyword(keyword) {
  return {
    id: String(keyword?.Id ?? ''),
    text: keyword?.Text ?? '',
    match_type: keyword?.MatchType ?? '',
    status: keyword?.Status ?? '',
    bid_amount: keyword?.Bid?.Amount ?? null
  };
}

function normalizeAd(ad) {
  return {
    id: String(ad?.Id ?? ''),
    type: ad?.Type ?? '',
    status: ad?.Status ?? '',
    headline_1: ad?.Headlines?.[0]?.Text ?? null,
    description_1: ad?.Descriptions?.[0]?.Text ?? null,
    final_urls: ad?.FinalUrls ?? []
  };
}

function buildEntityRequest(entity, params, accountId) {
  if (entity === 'campaigns') {
    return {
      body: {
        AccountId: Number(accountId),
        CampaignType: params.campaign_type || 'Search Shopping DynamicSearchAds Audience PerformanceMax',
        ReturnAdditionalFields: 'BidStrategyId'
      },
      normalize: normalizeCampaign
    };
  }

  if (entity === 'ad_groups') {
    validateRequired(params, ['campaign_id']);
    return {
      body: {
        CampaignId: Number(params.campaign_id)
      },
      normalize: normalizeAdGroup
    };
  }

  if (entity === 'keywords') {
    validateRequired(params, ['ad_group_id']);
    return {
      body: {
        AdGroupId: Number(params.ad_group_id)
      },
      normalize: normalizeKeyword
    };
  }

  validateRequired(params, ['ad_group_id']);
  return {
    body: {
      AdGroupId: Number(params.ad_group_id)
    },
    normalize: normalizeAd
  };
}

export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;

  try {
    validateRequired(params, ['entity']);
    validateEnum(params.entity, ENTITY_OPTIONS, 'entity');

    const accountId = getAccountId(params);
    const customerId = getCustomerId(params);
    const endpoint = ENTITY_ENDPOINTS[params.entity];
    const responseKey = ENTITY_RESPONSE_KEYS[params.entity];

    const { body, normalize } = buildEntityRequest(params.entity, params, accountId);
    const response = await request(endpoint, body, { accountId, customerId });
    const records = (response?.[responseKey] || []).map(normalize);

    return formatSuccess({
      summary: `Found ${records.length} ${params.entity.replace('_', ' ')} in account ${accountId}`,
      data: records,
      metadata: {
        entity: params.entity,
        accountId,
        customerId,
        totalRecords: records.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}

