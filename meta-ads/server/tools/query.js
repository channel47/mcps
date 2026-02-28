import { metaRequest } from '../http.js';
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

function getRequestedFields(entity, fields) {
  if (!fields) {
    return ENTITY_FIELDS[entity].join(',');
  }

  if (Array.isArray(fields)) {
    return fields.join(',');
  }

  return String(fields);
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

function buildBaseParams(params, entity) {
  const limit = getRequestedLimit(params.limit);
  const queryParams = {
    fields: getRequestedFields(entity, params.fields),
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
  }

  return queryParams;
}

async function fetchAllPages(path, initialParams, requestedLimit, request) {
  let after = null;
  const results = [];

  while (results.length < requestedLimit) {
    const pageParams = {
      ...initialParams,
      limit: String(Math.min(requestedLimit, 1000))
    };

    if (after) {
      pageParams.after = after;
    }

    const response = await request(path, pageParams);
    const data = Array.isArray(response?.data) ? response.data : [];
    results.push(...data);

    if (results.length >= requestedLimit) {
      break;
    }

    after = response?.paging?.cursors?.after;
    if (!after) {
      break;
    }
  }

  return results.slice(0, requestedLimit);
}

export async function query(params = {}, dependencies = {}) {
  const request = dependencies.request || metaRequest;

  try {
    validateEnum(params.entity, SUPPORTED_ENTITIES, 'entity');

    const accountId = getAccountId(params);
    const entity = params.entity;
    const requestedLimit = getRequestedLimit(params.limit);
    const path = `/act_${accountId}/${ENTITY_PATHS[entity]}`;

    const queryParams = buildBaseParams(params, entity);
    const rows = await fetchAllPages(path, queryParams, requestedLimit, request);

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
