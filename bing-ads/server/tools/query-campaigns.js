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
    editorial_status: keyword?.EditorialStatus ?? null,
    bid_amount: keyword?.Bid?.Amount ?? null
  };
}

function normalizeAd(ad) {
  const base = {
    id: String(ad?.Id ?? ''),
    type: ad?.Type ?? '',
    status: ad?.Status ?? '',
    editorial_status: ad?.EditorialStatus ?? null,
    final_urls: ad?.FinalUrls ?? []
  };

  if (ad?.Headlines) {
    base.headlines = ad.Headlines.map((h) => ({
      text: h?.Asset?.Text ?? h?.Text ?? '',
      editorial_status: h?.EditorialStatus ?? null
    }));
  }
  if (ad?.Descriptions) {
    base.descriptions = ad.Descriptions.map((d) => ({
      text: d?.Asset?.Text ?? d?.Text ?? '',
      editorial_status: d?.EditorialStatus ?? null
    }));
  }

  if (ad?.TitlePart1) base.title_part_1 = ad.TitlePart1;
  if (ad?.TitlePart2) base.title_part_2 = ad.TitlePart2;
  if (ad?.TitlePart3) base.title_part_3 = ad.TitlePart3;
  if (ad?.Text) base.text = ad.Text;
  if (ad?.TextPart2) base.text_part_2 = ad.TextPart2;

  if (ad?.Path1) base.path_1 = ad.Path1;
  if (ad?.Path2) base.path_2 = ad.Path2;
  if (ad?.Domain) base.domain = ad.Domain;

  return base;
}

function buildEntityRequest(entity, params, accountId) {
  if (entity === 'campaigns') {
    const campaignType = params.campaign_type || 'Search,Shopping,DynamicSearchAds,Audience,PerformanceMax';
    return {
      body: {
        AccountId: Number(accountId),
        CampaignType: campaignType,
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
      AdGroupId: Number(params.ad_group_id),
      AdTypes: [
        'AppInstall',
        'DynamicSearch',
        'ExpandedText',
        'Hotel',
        'Product',
        'ResponsiveAd',
        'ResponsiveSearch'
      ]
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
