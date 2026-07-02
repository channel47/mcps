import { invalidParamsError } from './errors.js';
import { toIdList, validateEnum } from './validation.js';

/**
 * Default analytics columns returned when the caller does not request specific columns.
 * All names are valid `columns` values on Pinterest v5 analytics endpoints.
 */
export const DEFAULT_ANALYTICS_COLUMNS = [
  'SPEND_IN_DOLLAR',
  'IMPRESSION_2',
  'CLICKTHROUGH_2',
  'CTR_2',
  'TOTAL_CONVERSIONS'
];

/**
 * Supported analytics granularity values.
 */
export const GRANULARITIES = ['TOTAL', 'DAY', 'HOUR', 'WEEK', 'MONTH'];

/**
 * Supported analytics levels mapped to endpoint paths and required id params.
 */
export const ANALYTICS_LEVELS = {
  account: { pathSuffix: '/analytics', idsParam: null },
  campaign: { pathSuffix: '/campaigns/analytics', idsParam: 'campaign_ids' },
  ad_group: { pathSuffix: '/ad_groups/analytics', idsParam: 'ad_group_ids' },
  ad: { pathSuffix: '/ads/analytics', idsParam: 'ad_ids' }
};

export const SUPPORTED_ANALYTICS_LEVELS = Object.keys(ANALYTICS_LEVELS);

const MAX_LOOKBACK_DAYS = 90;
const MAX_RANGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw invalidParamsError(`Invalid ${label} date format: ${value}. Expected YYYY-MM-DD`);
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw invalidParamsError(`Invalid ${label} date: ${value}`);
  }

  return parsed;
}

/**
 * Validate an analytics date range against Pinterest API constraints:
 * YYYY-MM-DD format, start_date <= end_date, start_date no more than 90 days
 * back from today, and end_date no more than 90 days past start_date.
 * @param {string} startDate
 * @param {string} endDate
 * @param {Date} [now]
 * @returns {{ startDate: string, endDate: string }}
 */
export function validateDateRange(startDate, endDate, now = new Date()) {
  const startMs = parseIsoDate(startDate, 'start_date');
  const endMs = parseIsoDate(endDate, 'end_date');

  if (startMs > endMs) {
    throw invalidParamsError(`start_date (${startDate}) must not be after end_date (${endDate})`);
  }

  const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (todayMs - startMs > MAX_LOOKBACK_DAYS * DAY_MS) {
    throw invalidParamsError(`start_date (${startDate}) cannot be more than ${MAX_LOOKBACK_DAYS} days back from today`);
  }

  if (endMs - startMs > MAX_RANGE_DAYS * DAY_MS) {
    throw invalidParamsError(`Date range exceeds ${MAX_RANGE_DAYS} days: ${startDate} to ${endDate}`);
  }

  return { startDate, endDate };
}

/**
 * Resolve requested analytics columns to a validated non-empty string array.
 * @param {string | string[] | undefined} columns
 * @returns {string[]}
 */
export function resolveColumns(columns) {
  const resolved = toIdList(columns);
  if (resolved.length === 0) {
    return [...DEFAULT_ANALYTICS_COLUMNS];
  }

  return resolved.map((column) => column.toUpperCase());
}

/**
 * Resolve and validate the requested granularity (default TOTAL).
 * @param {string | undefined} granularity
 * @returns {string}
 */
export function resolveGranularity(granularity) {
  if (granularity === undefined || granularity === null || granularity === '') {
    return 'TOTAL';
  }

  const normalized = String(granularity).toUpperCase();
  validateEnum(normalized, GRANULARITIES, 'granularity');
  return normalized;
}
