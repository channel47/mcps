import { tiktokRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import {
  getAdvertiserId,
  getRequestedLimit,
  validateDate,
  validateEnum
} from '../utils/validation.js';

export const SUPPORTED_REPORT_TYPES = ['BASIC', 'AUDIENCE'];
export const SUPPORTED_DATA_LEVELS = [
  'AUCTION_ADVERTISER',
  'AUCTION_CAMPAIGN',
  'AUCTION_ADGROUP',
  'AUCTION_AD'
];

const LEVEL_ID_DIMENSIONS = {
  AUCTION_ADVERTISER: 'advertiser_id',
  AUCTION_CAMPAIGN: 'campaign_id',
  AUCTION_ADGROUP: 'adgroup_id',
  AUCTION_AD: 'ad_id'
};

/**
 * Default metric selection for integrated reports.
 */
export const DEFAULT_METRICS = [
  'spend',
  'impressions',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'conversion',
  'cost_per_conversion',
  'conversion_rate'
];

function toIsoDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function offsetUtcDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function normalizeStringArray(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');
  return values.map((entry) => String(entry).trim()).filter(Boolean);
}

// query_lifetime=true cannot be combined with time dimensions or explicit dates.
function resolveDateWindow(params, lifetime, now) {
  if (lifetime) {
    if (params.start_date || params.end_date) {
      throw invalidParamsError('start_date/end_date cannot be combined with lifetime=true');
    }
    return null;
  }

  if ((params.start_date && !params.end_date) || (!params.start_date && params.end_date)) {
    throw invalidParamsError('start_date and end_date must be provided together');
  }

  if (params.start_date && params.end_date) {
    validateDate(params.start_date, 'start_date');
    validateDate(params.end_date, 'end_date');
    return { start_date: String(params.start_date), end_date: String(params.end_date) };
  }

  return {
    start_date: toIsoDateUtc(offsetUtcDays(now, -6)),
    end_date: toIsoDateUtc(now)
  };
}

function resolveDimensions(params, dataLevel, lifetime) {
  const requested = normalizeStringArray(params.dimensions);
  if (requested.length > 0) {
    return requested;
  }

  const idDimension = LEVEL_ID_DIMENSIONS[dataLevel];
  return lifetime ? [idDimension] : [idDimension, 'stat_time_day'];
}

function flattenRow(row) {
  return {
    ...(row?.dimensions || {}),
    ...(row?.metrics || {})
  };
}

async function fetchAllPages(baseParams, requestedLimit, request) {
  const rows = [];
  let page = 1;

  while (rows.length < requestedLimit) {
    const response = await request('/report/integrated/get/', {
      ...baseParams,
      page,
      page_size: Math.min(requestedLimit, 1000)
    });

    const list = Array.isArray(response?.data?.list) ? response.data.list : [];
    rows.push(...list.map(flattenRow));

    const totalPage = Number(response?.data?.page_info?.total_page || 0);
    if (list.length === 0 || !totalPage || page >= totalPage) {
      break;
    }

    page += 1;
  }

  return rows.slice(0, requestedLimit);
}

/**
 * Run a synchronous TikTok integrated report (GET /report/integrated/get/).
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @param {Date} [now]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function report(params = {}, dependencies = {}, now = new Date()) {
  const request = dependencies.request || tiktokRequest;

  try {
    const advertiserId = getAdvertiserId(params);
    const reportType = params.report_type ? String(params.report_type).toUpperCase() : 'BASIC';
    validateEnum(reportType, SUPPORTED_REPORT_TYPES, 'report_type');

    const dataLevel = params.data_level ? String(params.data_level).toUpperCase() : 'AUCTION_CAMPAIGN';
    validateEnum(dataLevel, SUPPORTED_DATA_LEVELS, 'data_level');

    const lifetime = params.lifetime === true || params.lifetime === 'true';
    const requestedLimit = getRequestedLimit(params.limit);
    const dateWindow = resolveDateWindow(params, lifetime, now);
    const dimensions = resolveDimensions(params, dataLevel, lifetime);
    const requestedMetrics = normalizeStringArray(params.metrics);
    const metrics = requestedMetrics.length > 0 ? requestedMetrics : DEFAULT_METRICS;

    const baseParams = {
      advertiser_id: advertiserId,
      report_type: reportType,
      data_level: dataLevel,
      dimensions,
      metrics
    };

    if (lifetime) {
      baseParams.query_lifetime = true;
    } else {
      baseParams.start_date = dateWindow.start_date;
      baseParams.end_date = dateWindow.end_date;
    }

    if (Array.isArray(params.filtering) && params.filtering.length > 0) {
      baseParams.filtering = params.filtering;
    }

    if (params.order_field) {
      baseParams.order_field = String(params.order_field);
      baseParams.order_type = params.order_type ? String(params.order_type).toUpperCase() : 'DESC';
    }

    const rows = await fetchAllPages(baseParams, requestedLimit, request);

    return formatSuccess({
      summary: `Returned ${rows.length} ${reportType} report row${rows.length === 1 ? '' : 's'} at ${dataLevel}`,
      data: rows,
      metadata: {
        advertiserId,
        reportType,
        dataLevel,
        dimensions,
        metrics,
        dateRange: lifetime ? 'lifetime' : dateWindow,
        limit: requestedLimit,
        returned: rows.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
