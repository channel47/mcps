import { linkedinRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { rawParam, restliSearchFilter } from '../utils/restli.js';
import { getAccountId, toEntityUrn, validateEnum } from '../utils/validation.js';

const ENTITY_CONFIG = {
  campaigns: {
    collection: 'adCampaigns',
    finder: 'search',
    maxPageSize: 1000,
    statuses: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'COMPLETED', 'CANCELED', 'DRAFT', 'PENDING_DELETION', 'REMOVED']
  },
  campaign_groups: {
    collection: 'adCampaignGroups',
    finder: 'search',
    maxPageSize: 1000,
    statuses: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'CANCELED', 'DRAFT', 'PENDING_DELETION', 'REMOVED']
  },
  creatives: {
    collection: 'creatives',
    finder: 'criteria',
    maxPageSize: 100,
    statuses: ['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED', 'CANCELED', 'PENDING_DELETION', 'REMOVED']
  }
};

export const SUPPORTED_QUERY_ENTITIES = Object.keys(ENTITY_CONFIG);

const DEFAULT_LIMIT = 100;

function normalizeStatusValues(value, config) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const values = (Array.isArray(value) ? value : String(value).split(','))
    .map((entry) => String(entry).trim().toUpperCase())
    .filter(Boolean);

  for (const entry of values) {
    validateEnum(entry, config.statuses, 'status');
  }

  return values;
}

function getRequestedLimit(limitValue) {
  const parsed = Number(limitValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.floor(parsed);
}

function buildBaseParams(entity, statusValues, params) {
  const config = ENTITY_CONFIG[entity];
  const queryParams = {
    q: config.finder
  };

  if (config.finder === 'search') {
    const searchFilter = restliSearchFilter({ status: statusValues });
    if (searchFilter) {
      queryParams.search = rawParam(searchFilter);
    }
    return queryParams;
  }

  // creatives use the criteria finder with top-level List params
  if (statusValues.length > 0) {
    queryParams.intendedStatuses = statusValues;
  }

  if (Array.isArray(params.campaign_ids) && params.campaign_ids.length > 0) {
    queryParams.campaigns = params.campaign_ids.map((id) => toEntityUrn('campaign', id));
  }

  return queryParams;
}

async function fetchAllPages(request, path, baseParams, requestedLimit, maxPageSize) {
  const rows = [];
  let pageToken = null;

  while (rows.length < requestedLimit) {
    const pageParams = {
      ...baseParams,
      pageSize: Math.min(requestedLimit - rows.length, maxPageSize)
    };

    if (pageToken) {
      pageParams.pageToken = pageToken;
    }

    const response = await request(path, pageParams);
    const elements = Array.isArray(response?.elements) ? response.elements : [];
    rows.push(...elements);

    pageToken = response?.metadata?.nextPageToken;
    if (!pageToken || elements.length === 0) {
      break;
    }
  }

  return rows.slice(0, requestedLimit);
}

/**
 * Query campaigns, campaign groups, or creatives for a LinkedIn ad account
 * using the entity finder appropriate for each collection (q=search for
 * campaigns/campaign groups, q=criteria for creatives) with cursor pagination.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || linkedinRequest;

  try {
    validateEnum(params.entity, SUPPORTED_QUERY_ENTITIES, 'entity');

    const entity = params.entity;
    const config = ENTITY_CONFIG[entity];
    const accountId = getAccountId(params);
    const statusValues = normalizeStatusValues(params.status, config);
    const requestedLimit = getRequestedLimit(params.limit);
    const path = `/adAccounts/${accountId}/${config.collection}`;

    const baseParams = buildBaseParams(entity, statusValues, params);
    const rows = await fetchAllPages(request, path, baseParams, requestedLimit, config.maxPageSize);

    return formatSuccess({
      summary: `Returned ${rows.length} ${entity} row${rows.length === 1 ? '' : 's'}`,
      data: rows,
      metadata: {
        entity,
        accountId,
        limit: requestedLimit,
        returned: rows.length,
        appliedStatusFilter: statusValues.length > 0 ? statusValues : null
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
