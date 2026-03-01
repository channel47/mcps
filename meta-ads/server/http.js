import { getAccessToken } from './auth.js';
import { invalidParamsError } from './utils/errors.js';

/**
 * Base URL for all Meta Graph API requests used by this server.
 */
export const META_BASE_URL = 'https://graph.facebook.com/v25.0';
const RATE_LIMIT_ERROR_CODES = new Set([17, 32]);
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

function buildUrl(path, params = {}) {
  const url = new URL(`${META_BASE_URL}${normalizePath(path)}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    url.searchParams.set(key, String(value));
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

function extractErrorCode(payload) {
  return Number(payload?.error?.code || 0);
}

function extractErrorMessage(payload) {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (payload?.message) {
    return payload.message;
  }

  if (typeof payload === 'string' && payload) {
    return payload;
  }

  return 'Unknown Meta Ads API error';
}

function resolveTimeoutMs(timeoutMs) {
  const candidate = timeoutMs ?? process.env.META_ADS_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
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
 * Execute an authenticated Meta Graph API request with timeout and retry handling.
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
export async function metaRequest(
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
      Authorization: `Bearer ${token}`
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
      throw new Error(`Meta Ads API request timed out after ${resolvedTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseResponse(response);

  if (response.ok) {
    return payload;
  }

  if (response.status === 401) {
    const message = extractErrorMessage(payload);
    throw invalidParamsError(`Meta Ads API request failed (${response.status}): ${message}`);
  }

  const errorCode = extractErrorCode(payload);
  const isRateLimited = response.status === 429 || RATE_LIMIT_ERROR_CODES.has(errorCode);
  if (isRateLimited && retryThrottled) {
    await sleepFn(getRateLimitSleepMs(response));

    return metaRequest(path, params, {
      method,
      body,
      timeoutMs: resolvedTimeoutMs,
      retryThrottled: false,
      sleep: sleepFn
    });
  }

  const message = extractErrorMessage(payload);
  throw new Error(`Meta Ads API request failed (${response.status}): ${message}`);
}
