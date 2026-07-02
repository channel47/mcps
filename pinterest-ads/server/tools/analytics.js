import { pinterestRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';
import { getAdAccountId, toIdList, validateEnum, validateRequired } from '../utils/validation.js';
import {
  ANALYTICS_LEVELS,
  SUPPORTED_ANALYTICS_LEVELS,
  resolveColumns,
  resolveGranularity,
  validateDateRange
} from '../utils/analytics-params.js';

const CONVERSION_REPORT_TIMES = ['TIME_OF_AD_ACTION', 'TIME_OF_CONVERSION'];
const REPORTING_TIMEZONES = ['PINTEREST_TIME_ZONE', 'AD_ACCOUNT_TIME_ZONE'];
const WINDOW_DAYS = [0, 1, 7, 14, 30, 60];
const WINDOW_PARAMS = ['click_window_days', 'engagement_window_days', 'view_window_days'];

function applyOptionalParams(queryParams, params) {
  for (const windowParam of WINDOW_PARAMS) {
    const value = params[windowParam];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const parsed = Number(value);
    if (!WINDOW_DAYS.includes(parsed)) {
      throw invalidParamsError(`Invalid ${windowParam}: ${value}. Allowed values: ${WINDOW_DAYS.join(', ')}`);
    }
    queryParams[windowParam] = String(parsed);
  }

  if (params.conversion_report_time) {
    const value = String(params.conversion_report_time).toUpperCase();
    validateEnum(value, CONVERSION_REPORT_TIMES, 'conversion_report_time');
    queryParams.conversion_report_time = value;
  }

  if (params.reporting_timezone) {
    const value = String(params.reporting_timezone).toUpperCase();
    validateEnum(value, REPORTING_TIMEZONES, 'reporting_timezone');
    queryParams.reporting_timezone = value;
  }
}

/**
 * Pull Pinterest Ads analytics at account, campaign, ad_group, or ad level.
 * @param {Record<string, unknown>} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function analytics(params = {}, dependencies = {}) {
  const request = dependencies.request || pinterestRequest;

  try {
    const level = params.level === undefined || params.level === null || params.level === ''
      ? 'account'
      : String(params.level).toLowerCase();
    validateEnum(level, SUPPORTED_ANALYTICS_LEVELS, 'level');
    validateRequired(params, ['start_date', 'end_date']);

    const adAccountId = getAdAccountId(params);
    const { pathSuffix, idsParam } = ANALYTICS_LEVELS[level];
    const { startDate, endDate } = validateDateRange(params.start_date, params.end_date);
    const columns = resolveColumns(params.columns);
    const granularity = resolveGranularity(params.granularity);

    const queryParams = {
      start_date: startDate,
      end_date: endDate,
      columns,
      granularity
    };

    if (idsParam) {
      const ids = toIdList(params[idsParam]);
      if (ids.length === 0) {
        throw invalidParamsError(`${idsParam} is required for level "${level}"`);
      }
      queryParams[idsParam] = ids;
    }

    applyOptionalParams(queryParams, params);

    const response = await request(`/ad_accounts/${adAccountId}${pathSuffix}`, queryParams);
    const rows = Array.isArray(response) ? response : [];

    return formatSuccess({
      summary: `Returned ${rows.length} ${level}-level analytics row${rows.length === 1 ? '' : 's'} for ${startDate} to ${endDate}`,
      data: rows,
      metadata: {
        level,
        adAccountId,
        startDate,
        endDate,
        granularity,
        columns
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
