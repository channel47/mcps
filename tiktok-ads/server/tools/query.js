import { tiktokRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAdvertiserId, getRequestedLimit, validateEnum } from '../utils/validation.js';

/**
 * Default field projections per query entity (TikTok Business API v1.3 field names).
 */
export const ENTITY_FIELDS = {
  campaigns: [
    'campaign_id',
    'campaign_name',
    'objective_type',
    'campaign_type',
    'budget',
    'budget_mode',
    'operation_status',
    'secondary_status',
    'create_time',
    'modify_time'
  ],
  adgroups: [
    'adgroup_id',
    'adgroup_name',
    'campaign_id',
    'operation_status',
    'secondary_status',
    'budget',
    'budget_mode',
    'optimization_goal',
    'billing_event',
    'bid_type',
    'bid_price',
    'schedule_type',
    'schedule_start_time',
    'schedule_end_time'
  ],
  ads: [
    'ad_id',
    'ad_name',
    'adgroup_id',
    'campaign_id',
    'operation_status',
    'secondary_status',
    'ad_format',
    'ad_text',
    'landing_page_url',
    'create_time',
    'modify_time'
  ]
};

export const SUPPORTED_ENTITIES = Object.keys(ENTITY_FIELDS);

const ENTITY_PATHS = {
  campaigns: '/campaign/get/',
  adgroups: '/adgroup/get/',
  ads: '/ad/get/'
};

function getRequestedFields(entity, fields) {
  if (fields === undefined || fields === null || fields === '') {
    return ENTITY_FIELDS[entity];
  }

  const values = Array.isArray(fields) ? fields : String(fields).split(',');
  const cleaned = values.map((field) => String(field).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : ENTITY_FIELDS[entity];
}

function getFiltering(filtering) {
  if (filtering === undefined || filtering === null) {
    return null;
  }

  if (typeof filtering !== 'object' || Array.isArray(filtering)) {
    throw invalidParamsError('filtering must be an object (e.g. { "primary_status": "STATUS_DELIVERY_OK" })');
  }

  return filtering;
}

async function fetchAllPages(path, baseParams, requestedLimit, request) {
  const rows = [];
  let page = 1;

  while (rows.length < requestedLimit) {
    const response = await request(path, {
      ...baseParams,
      page,
      page_size: Math.min(requestedLimit, 1000)
    });

    const list = Array.isArray(response?.data?.list) ? response.data.list : [];
    rows.push(...list);

    const totalPage = Number(response?.data?.page_info?.total_page || 0);
    if (list.length === 0 || !totalPage || page >= totalPage) {
      break;
    }

    page += 1;
  }

  return rows.slice(0, requestedLimit);
}

/**
 * Query TikTok Ads campaigns, ad groups, or ads with page-based pagination.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || tiktokRequest;

  try {
    validateEnum(params.entity, SUPPORTED_ENTITIES, 'entity');

    const advertiserId = getAdvertiserId(params);
    const entity = params.entity;
    const requestedLimit = getRequestedLimit(params.limit);
    const filtering = getFiltering(params.filtering);

    const baseParams = {
      advertiser_id: advertiserId,
      fields: getRequestedFields(entity, params.fields)
    };

    if (filtering) {
      baseParams.filtering = filtering;
    }

    const rows = await fetchAllPages(ENTITY_PATHS[entity], baseParams, requestedLimit, request);

    return formatSuccess({
      summary: `Returned ${rows.length} ${entity} row${rows.length === 1 ? '' : 's'}`,
      data: rows,
      metadata: {
        entity,
        advertiserId,
        limit: requestedLimit,
        returned: rows.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
