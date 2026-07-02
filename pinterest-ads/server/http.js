import { getAccessToken } from './auth.js';
import { invalidParamsError } from './utils/errors.js';

/**
 * Base URL for all Pinterest REST API v5 requests used by this server.
 */
export const PINTEREST_BASE_URL = 'https://api.pinterest.com/v5';
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

function serializeParamValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean).join(',');
  }

  return String(value);
}

function buildUrl(path, params = {}) {
  const url = new URL(`${PINTEREST_BASE_URL}${normalizePath(path)}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const serialized = serializeParamValue(value);
    if (serialized === '') {
      continue;
    }
    url.searchParams.set(key, serialized);
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

function extractErrorMessage(payload) {
  if (payload?.message) {
    return payload.message;
  }

  if (typeof payload === 'string' && payload) {
    return payload;
  }

  return 'Unknown Pinterest Ads API error';
}

function extractErrorCode(payload) {
  return Number(payload?.code || 0);
}

function resolveTimeoutMs(timeoutMs) {
  const candidate = timeoutMs ?? process.env.PINTEREST_ADS_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
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
 * Execute an authenticated Pinterest REST API v5 request with timeout and retry handling.
 * Array query parameter values are serialized as comma-separated strings per Pinterest conventions.
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
export async function pinterestRequest(
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
      throw new Error(`Pinterest Ads API request timed out after ${resolvedTimeoutMs}ms`);
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
    throw invalidParamsError(`Pinterest Ads API request failed (${response.status}): ${message}`);
  }

  if (response.status === 429 && retryThrottled) {
    await sleepFn(getRateLimitSleepMs(response));

    return pinterestRequest(path, params, {
      method,
      body,
      timeoutMs: resolvedTimeoutMs,
      retryThrottled: false,
      sleep: sleepFn
    });
  }

  const message = extractErrorMessage(payload);
  const code = extractErrorCode(payload);
  const codeSuffix = code ? ` [code ${code}]` : '';
  throw new Error(`Pinterest Ads API request failed (${response.status}): ${message}${codeSuffix}`);
}
