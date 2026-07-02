import { metaRequest } from '../http.js';
import { fetchAllPages } from '../utils/paginate.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import {
  ENTITY_FIELDS,
  SUPPORTED_ENTITIES,
  resolveInsightsDateRange
} from '../utils/field-defaults.js';
import { getAccountId, validateEnum } from '../utils/validation.js';

const ENTITY_PATHS = {
  campaigns: 'campaigns',
  adsets: 'adsets',
  ads: 'ads',
  insights: 'insights',
  audiences: 'customaudiences',
  creatives: 'adcreatives'
};

function serializeField(field) {
  if (typeof field === 'string') {
    return field;
  }

  if (field && typeof field === 'object' && !Array.isArray(field)) {
    const [name, nested] = Object.entries(field)[0] || [];
    if (!name) {
      return '';
    }
    return `${name}{${serializeFields(nested)}}`;
  }

  return String(field);
}

// Supports both simple fields ("id") and nested projections ({ creative: [...] }).
function serializeFields(fields) {
  if (Array.isArray(fields)) {
    return fields.map(serializeField).filter(Boolean).join(',');
  }

  if (fields && typeof fields === 'object') {
    return serializeField(fields);
  }

  return String(fields || '');
}

function getRequestedFields(entity, fields) {
  return serializeFields(fields || ENTITY_FIELDS[entity]);
}

function getInlineInsightsFields(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((field) => String(field).trim()).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
}

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

function buildBaseParams(params, entity, limit) {
  let fields = getRequestedFields(entity, params.fields);

  if (entity !== 'insights') {
    const inlineInsightsFields = getInlineInsightsFields(params.inline_insights_fields);
    if (inlineInsightsFields.length > 0 && !fields.includes('insights{')) {
      fields = `${fields},insights{${inlineInsightsFields.join(',')}}`;
    }
  }

  const queryParams = {
    fields,
    limit: String(limit)
  };

  if (Array.isArray(params.filters) && params.filters.length > 0) {
    queryParams.filtering = JSON.stringify(params.filters);
  }

  if (params.sort) {
    queryParams.sort = String(params.sort);
  }

  if (entity === 'insights') {
    const timeRange = resolveInsightsDateRange(params.date_range);
    queryParams.time_range = JSON.stringify(timeRange);

    if (params.level) {
      queryParams.level = String(params.level);
    }

    if (params.time_increment !== undefined && params.time_increment !== null) {
      queryParams.time_increment = String(params.time_increment);
    }

    if (Array.isArray(params.breakdowns) && params.breakdowns.length > 0) {
      queryParams.breakdowns = params.breakdowns.join(',');
    }
  }

  return queryParams;
}

/**
 * Query Meta Ads entities with cursor pagination and entity-specific parameters.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || metaRequest;

  try {
    validateEnum(params.entity, SUPPORTED_ENTITIES, 'entity');

    const accountId = getAccountId(params);
    const entity = params.entity;
    const requestedLimit = getRequestedLimit(params.limit);
    const path = `/act_${accountId}/${ENTITY_PATHS[entity]}`;

    const queryParams = buildBaseParams(params, entity, requestedLimit);
    const rows = await fetchAllPages(request, path, queryParams, requestedLimit);

    return formatSuccess({
      summary: `Returned ${rows.length} ${entity} row${rows.length === 1 ? '' : 's'}`,
      data: rows,
      metadata: {
        entity,
        accountId,
        limit: requestedLimit,
        returned: rows.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
