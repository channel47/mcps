import { getAccessToken } from './auth.js';
import { invalidParamsError } from './utils/errors.js';

/**
 * Base URL for all TikTok for Business API requests used by this server.
 */
export const TIKTOK_BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';
const RATE_LIMIT_ERROR_CODES = new Set([40100]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_SLEEP_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizePath(path) {
  if (!path) {
    throw new Error('API path is required');
  }

  return path.startsWith('/') ? path : `/${path}`;
}

// TikTok GET endpoints expect complex params (arrays/objects such as
// filtering, fields, dimensions, metrics) as JSON-encoded strings.
function serializeParamValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }

  return String(value);
}

function buildUrl(path, params = {}) {
  const url = new URL(`${TIKTOK_BASE_URL}${normalizePath(path)}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    url.searchParams.set(key, serializeParamValue(value));
  }

  return url;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractEnvelopeCode(payload) {
  const code = Number(payload?.code);
  return Number.isFinite(code) ? code : 0;
}

function extractErrorMessage(payload) {
  if (payload?.message) {
    return payload.message;
  }

  if (typeof payload === 'string' && payload) {
    return payload;
  }

  return 'Unknown TikTok Ads API error';
}

function resolveTimeoutMs(timeoutMs) {
  const candidate = timeoutMs ?? process.env.TIKTOK_ADS_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function getRateLimitSleepMs(response) {
  const retryAfter = response?.headers?.get('retry-after');
  if (!retryAfter) {
    return DEFAULT_RATE_LIMIT_SLEEP_MS;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }

  const retryAtMs = Date.parse(retryAfter);
  if (Number.isFinite(retryAtMs)) {
    const delta = retryAtMs - Date.now();
    if (delta > 0) {
      return Math.floor(delta);
    }
  }

  return DEFAULT_RATE_LIMIT_SLEEP_MS;
}

/**
 * Execute an authenticated TikTok for Business API request with timeout and retry handling.
 *
 * TikTok returns HTTP 200 with an envelope `{ code, message, request_id, data }`;
 * any non-zero `code` is treated as an error. The full envelope is returned on
 * success so callers can read `data.list` and `data.page_info`.
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   timeoutMs?: number,
 *   retryThrottled?: boolean,
 *   sleep?: (ms: number) => Promise<void>
 * }} [options]
 * @returns {Promise<unknown>}
 */
export async function tiktokRequest(
  path,
  params = {},
  {
    method = 'GET',
    body,
    timeoutMs,
    retryThrottled = true,
    sleep: sleepFn = sleep
  } = {}
) {
  const token = await getAccessToken();
  const url = buildUrl(path, params);
  const resolvedTimeoutMs = resolveTimeoutMs(timeoutMs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, resolvedTimeoutMs);

  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': token
    },
    signal: controller.signal
  };

  if (body !== undefined && body !== null) {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`TikTok Ads API request timed out after ${resolvedTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseResponse(response);
  const envelopeCode = extractEnvelopeCode(payload);

  if (response.ok && envelopeCode === 0) {
    return payload;
  }

  if (response.status === 401) {
    const message = extractErrorMessage(payload);
    throw invalidParamsError(`TikTok Ads API request failed (${response.status}): ${message}`);
  }

  const isRateLimited = response.status === 429 || RATE_LIMIT_ERROR_CODES.has(envelopeCode);
  if (isRateLimited && retryThrottled) {
    await sleepFn(getRateLimitSleepMs(response));

    return tiktokRequest(path, params, {
      method,
      body,
      timeoutMs: resolvedTimeoutMs,
      retryThrottled: false,
      sleep: sleepFn
    });
  }

  const message = extractErrorMessage(payload);
  const codeSuffix = envelopeCode !== 0 ? ` (API error code ${envelopeCode})` : '';
  throw new Error(`TikTok Ads API request failed (${response.status}): ${message}${codeSuffix}`);
}
