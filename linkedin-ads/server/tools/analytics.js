import { linkedinRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { rawParam, restliDateRange } from '../utils/restli.js';
import { getAccountId, toEntityUrn, validateEnum, validateRequired } from '../utils/validation.js';

export const SUPPORTED_PIVOTS = ['ACCOUNT', 'CAMPAIGN_GROUP', 'CAMPAIGN', 'CREATIVE'];
export const SUPPORTED_TIME_GRANULARITIES = ['ALL', 'DAILY', 'MONTHLY'];
export const SUPPORTED_ANALYTICS_ENTITY_TYPES = ['account', 'campaign_group', 'campaign', 'creative'];

/**
 * Default adAnalytics fields projection. dateRange and pivotValues are
 * dimensional fields; the rest are metrics.
 */
export const DEFAULT_ANALYTICS_FIELDS = [
  'impressions',
  'clicks',
  'costInLocalCurrency',
  'externalWebsiteConversions',
  'dateRange',
  'pivotValues'
];

const NON_METRIC_FIELDS = new Set(['dateRange', 'pivotValues']);
const MAX_METRIC_FIELDS = 20;
const MAX_ELEMENTS_NOTE = 'adAnalytics does not support pagination; LinkedIn caps responses at 15,000 elements';

const FACET_PARAM_BY_ENTITY_TYPE = {
  account: 'accounts',
  campaign_group: 'campaignGroups',
  campaign: 'campaigns',
  creative: 'creatives'
};

function resolveFields(fieldsValue) {
  if (fieldsValue === undefined || fieldsValue === null || fieldsValue === '') {
    return [...DEFAULT_ANALYTICS_FIELDS];
  }

  const fields = (Array.isArray(fieldsValue) ? fieldsValue : String(fieldsValue).split(','))
    .map((field) => String(field).trim())
    .filter(Boolean);

  if (fields.length === 0) {
    return [...DEFAULT_ANALYTICS_FIELDS];
  }

  for (const field of fields) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(field)) {
      throw invalidParamsError(`Invalid analytics field name: ${field}`);
    }
  }

  const metricCount = fields.filter((field) => !NON_METRIC_FIELDS.has(field)).length;
  if (metricCount > MAX_METRIC_FIELDS) {
    throw invalidParamsError(`Too many metric fields: ${metricCount}. LinkedIn adAnalytics allows at most ${MAX_METRIC_FIELDS} metrics per call`);
  }

  return fields;
}

function resolveEntityUrns(params) {
  const entityType = params.entity_type ? String(params.entity_type).toLowerCase() : 'account';
  validateEnum(entityType, SUPPORTED_ANALYTICS_ENTITY_TYPES, 'entity_type');

  const facetParam = FACET_PARAM_BY_ENTITY_TYPE[entityType];

  if (Array.isArray(params.entity_ids) && params.entity_ids.length > 0) {
    return {
      entityType,
      facetParam,
      urns: params.entity_ids.map((id) => toEntityUrn(entityType, id))
    };
  }

  if (entityType !== 'account') {
    throw invalidParamsError(`entity_ids is required when entity_type is ${entityType}`);
  }

  const accountId = getAccountId(params);
  return {
    entityType,
    facetParam,
    urns: [toEntityUrn('account', accountId)]
  };
}

/**
 * Fetch adAnalytics metrics with a pivot, date range, and time granularity.
 * Entity scope is built from plain IDs plus entity_type (defaults to the
 * configured account). The endpoint has no pagination.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function analytics(params = {}, dependencies = {}) {
  const request = dependencies.request || linkedinRequest;

  try {
    validateRequired(params, ['pivot', 'start']);

    const pivot = String(params.pivot).toUpperCase();
    validateEnum(pivot, SUPPORTED_PIVOTS, 'pivot');

    const timeGranularity = params.time_granularity
      ? String(params.time_granularity).toUpperCase()
      : 'ALL';
    validateEnum(timeGranularity, SUPPORTED_TIME_GRANULARITIES, 'time_granularity');

    const dateRange = restliDateRange(params.start, params.end);
    const fields = resolveFields(params.fields);
    const { entityType, facetParam, urns } = resolveEntityUrns(params);

    const queryParams = {
      q: 'analytics',
      pivot,
      dateRange: rawParam(dateRange),
      timeGranularity,
      [facetParam]: urns,
      fields: rawParam(fields.join(','))
    };

    const response = await request('/adAnalytics', queryParams);
    const rows = Array.isArray(response?.elements) ? response.elements : [];

    return formatSuccess({
      summary: `Returned ${rows.length} analytics row${rows.length === 1 ? '' : 's'} pivoted by ${pivot} (${timeGranularity})`,
      data: rows,
      metadata: {
        pivot,
        timeGranularity,
        dateRange: {
          start: params.start,
          end: params.end || null
        },
        entityType,
        entityCount: urns.length,
        fields,
        paginationNote: MAX_ELEMENTS_NOTE
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
