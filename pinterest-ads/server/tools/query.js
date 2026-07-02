import { pinterestRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAdAccountId, toIdList, validateEnum } from '../utils/validation.js';

const ENTITY_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT', 'DELETED_DRAFT'];
const ORDERS = ['ASCENDING', 'DESCENDING'];
const MAX_PAGE_SIZE = 250;

/**
 * Supported query entities mapped to their id-filter query parameters.
 */
export const QUERY_ENTITIES = {
  campaigns: ['campaign_ids'],
  ad_groups: ['campaign_ids', 'ad_group_ids'],
  ads: ['campaign_ids', 'ad_group_ids', 'ad_ids']
};

export const SUPPORTED_QUERY_ENTITIES = Object.keys(QUERY_ENTITIES);

const ALL_ID_FILTERS = ['campaign_ids', 'ad_group_ids', 'ad_ids'];

function getRequestedLimit(limitValue) {
  if (limitValue === undefined || limitValue === null || limitValue === '') {
    return 100;
  }

  const parsed = Number(limitValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.min(Math.floor(parsed), 1000);
}

function buildBaseParams(params, entity) {
  const queryParams = {};
  const supportedFilters = QUERY_ENTITIES[entity];

  for (const filterName of ALL_ID_FILTERS) {
    const ids = toIdList(params[filterName]);
    if (ids.length === 0) {
      continue;
    }

    if (!supportedFilters.includes(filterName)) {
      throw invalidParamsError(`${filterName} is not supported for entity "${entity}". Supported filters: ${supportedFilters.join(', ')}`);
    }

    queryParams[filterName] = ids;
  }

  const entityStatuses = toIdList(params.entity_statuses).map((status) => status.toUpperCase());
  for (const status of entityStatuses) {
    validateEnum(status, ENTITY_STATUSES, 'entity_statuses');
  }
  if (entityStatuses.length > 0) {
    queryParams.entity_statuses = entityStatuses;
  }

  if (params.order) {
    const order = String(params.order).toUpperCase();
    validateEnum(order, ORDERS, 'order');
    queryParams.order = order;
  }

  return queryParams;
}

async function fetchAllPages(path, initialParams, requestedLimit, request) {
  let bookmark = null;
  const results = [];

  while (results.length < requestedLimit) {
    const pageParams = {
      ...initialParams,
      page_size: String(Math.min(requestedLimit - results.length, MAX_PAGE_SIZE))
    };

    if (bookmark) {
      pageParams.bookmark = bookmark;
    }

    const response = await request(path, pageParams);
    const items = Array.isArray(response?.items) ? response.items : [];
    results.push(...items);

    bookmark = response?.bookmark || null;
    if (!bookmark) {
      break;
    }
  }

  return results.slice(0, requestedLimit);
}

/**
 * Query Pinterest Ads entities (campaigns, ad_groups, ads) with bookmark pagination.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || pinterestRequest;

  try {
    validateEnum(params.entity, SUPPORTED_QUERY_ENTITIES, 'entity');

    const adAccountId = getAdAccountId(params);
    const entity = params.entity;
    const requestedLimit = getRequestedLimit(params.limit);
    const path = `/ad_accounts/${adAccountId}/${entity}`;

    const queryParams = buildBaseParams(params, entity);
    const rows = await fetchAllPages(path, queryParams, requestedLimit, request);

    return formatSuccess({
      summary: `Returned ${rows.length} ${entity} row${rows.length === 1 ? '' : 's'}`,
      data: rows,
      metadata: {
        entity,
        adAccountId,
        limit: requestedLimit,
        returned: rows.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
