import { getAccessToken } from './auth.js';
import { invalidParamsError } from './utils/errors.js';
import { buildQueryString } from './utils/restli.js';

/**
 * Base URL for all LinkedIn Marketing API (versioned REST) requests.
 */
export const LINKEDIN_BASE_URL = 'https://api.linkedin.com/rest';
/**
 * Default LinkedIn-Version header (YYYYMM). Override with LINKEDIN_ADS_API_VERSION.
 */
export const DEFAULT_API_VERSION = '202605';
/**
 * Rest.li protocol version required on every request.
 */
export const RESTLI_PROTOCOL_VERSION = '2.0.0';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_SLEEP_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolve the LinkedIn-Version header value (YYYYMM). Invalid overrides fall
 * back to the default version.
 * @returns {string}
 */
export function getApiVersion() {
  const configured = String(process.env.LINKEDIN_ADS_API_VERSION || '').trim();
  return /^\d{6}$/.test(configured) ? configured : DEFAULT_API_VERSION;
}

function normalizePath(path) {
  if (!path) {
    throw new Error('API path is required');
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function buildUrl(path, params = {}) {
  const queryString = buildQueryString(params);
  const base = `${LINKEDIN_BASE_URL}${normalizePath(path)}`;
  return queryString ? `${base}?${queryString}` : base;
}

async function parseResponse(response) {
  if (response.status === 204) {
    return {};
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

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

  if (payload?.error_description) {
    return payload.error_description;
  }

  if (typeof payload === 'string' && payload) {
    return payload;
  }

  return 'Unknown LinkedIn Ads API error';
}

function resolveTimeoutMs(timeoutMs) {
  const candidate = timeoutMs ?? process.env.LINKEDIN_ADS_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
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
 * Execute an authenticated LinkedIn Marketing API request with Rest.li 2.0
 * query encoding, versioned headers, timeout, and single-retry rate-limit
 * handling. Created-entity IDs from the x-restli-id response header are
 * surfaced on the returned payload as `restliId`.
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   headers?: Record<string, string>,
 *   timeoutMs?: number,
 *   retryThrottled?: boolean,
 *   sleep?: (ms: number) => Promise<void>
 * }} [options]
 * @returns {Promise<unknown>}
 */
export async function linkedinRequest(
  path,
  params = {},
  {
    method = 'GET',
    body,
    headers = {},
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
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': getApiVersion(),
      'X-Restli-Protocol-Version': RESTLI_PROTOCOL_VERSION,
      ...headers
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
      throw new Error(`LinkedIn Ads API request timed out after ${resolvedTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseResponse(response);

  if (response.ok) {
    const restliId = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id');
    if (restliId && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return { ...payload, restliId };
    }
    return payload;
  }

  if (response.status === 401) {
    const message = extractErrorMessage(payload);
    throw invalidParamsError(`LinkedIn Ads API request failed (${response.status}): ${message}`);
  }

  if (response.status === 429 && retryThrottled) {
    await sleepFn(getRateLimitSleepMs(response));

    return linkedinRequest(path, params, {
      method,
      body,
      headers,
      timeoutMs: resolvedTimeoutMs,
      retryThrottled: false,
      sleep: sleepFn
    });
  }

  const message = extractErrorMessage(payload);
  throw new Error(`LinkedIn Ads API request failed (${response.status}): ${message}`);
}
