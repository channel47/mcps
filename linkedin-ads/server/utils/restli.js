import { invalidParamsError } from './errors.js';

class RestliRaw {
  constructor(value) {
    this.value = String(value);
    this.__restliRaw = true;
  }
}

/**
 * Wrap a pre-built Rest.li expression so buildQueryString inserts it verbatim.
 * Use for structured params like dateRange/search whose parens, colons, and
 * commas must stay literal in the query string.
 * @param {string} value
 * @returns {RestliRaw}
 */
export function rawParam(value) {
  return new RestliRaw(value);
}

/**
 * Check whether a value was produced by rawParam(). Duck-typed rather than
 * instanceof so values survive module re-imports (e.g. cache-busted test loads).
 */
export function isRawParam(value) {
  return Boolean(value)
    && typeof value === 'object'
    && value.__restliRaw === true
    && typeof value.value === 'string';
}

/**
 * Percent-encode a single Rest.li value. Extends encodeURIComponent to also
 * encode characters Rest.li treats as structural but JS leaves bare: ! ' ( ) *
 * URNs become e.g. urn%3Ali%3AsponsoredCampaign%3A123.
 * @param {unknown} value
 * @returns {string}
 */
export function encodeRestliValue(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Build a Rest.li List(...) expression with each item percent-encoded and
 * item separators kept as literal commas.
 * @param {unknown[] | unknown} values
 * @returns {string}
 */
export function restliList(values) {
  const items = Array.isArray(values) ? values : [values];
  return `List(${items.map(encodeRestliValue).join(',')})`;
}

function parseIsoDate(value, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) {
    throw invalidParamsError(`Invalid ${label} date format: ${value}. Expected YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw invalidParamsError(`Invalid ${label} date value: ${value}`);
  }

  return { year, month, day };
}

/**
 * Convert YYYY-MM-DD to a Rest.li date expression: (year:2026,month:6,day:1).
 * Month and day are emitted without leading zeros as LinkedIn expects.
 * @param {string} value
 * @param {string} [label]
 * @returns {string}
 */
export function restliDate(value, label = 'date') {
  const { year, month, day } = parseIsoDate(value, label);
  return `(year:${year},month:${month},day:${day})`;
}

/**
 * Build the adAnalytics dateRange expression from ISO dates. End is optional
 * (LinkedIn treats a missing end as "through today").
 * @param {string} start
 * @param {string} [end]
 * @returns {string}
 */
export function restliDateRange(start, end) {
  const parts = [`start:${restliDate(start, 'start')}`];
  if (end !== undefined && end !== null && end !== '') {
    parts.push(`end:${restliDate(end, 'end')}`);
  }
  return `(${parts.join(',')})`;
}

/**
 * Build a finder search expression: (status:(values:List(ACTIVE,PAUSED)),...).
 * Fields with empty value arrays are omitted; returns null when no clause
 * remains so callers can skip the param entirely.
 * @param {Record<string, unknown[]>} filters
 * @returns {string | null}
 */
export function restliSearchFilter(filters = {}) {
  const clauses = Object.entries(filters)
    .filter(([, values]) => Array.isArray(values) && values.length > 0)
    .map(([field, values]) => `${field}:(values:${restliList(values)})`);

  if (clauses.length === 0) {
    return null;
  }

  return `(${clauses.join(',')})`;
}

/**
 * Build a Rest.li 2.0-safe query string. Never uses URLSearchParams because
 * that would percent-encode the structural parens/colons/commas of List(...)
 * and dateRange expressions. Handling by value type:
 * - rawParam(...) values are inserted verbatim
 * - arrays become List(...) with percent-encoded items
 * - everything else is percent-encoded as a single value
 * Null/undefined/empty-string values are skipped.
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function buildQueryString(params = {}) {
  const parts = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (isRawParam(value)) {
      parts.push(`${key}=${value.value}`);
      continue;
    }

    if (Array.isArray(value)) {
      parts.push(`${key}=${restliList(value)}`);
      continue;
    }

    parts.push(`${key}=${encodeRestliValue(value)}`);
  }

  return parts.join('&');
}
