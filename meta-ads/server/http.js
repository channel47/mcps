import { clearAuthCacheForTests, getAccessToken } from './auth.js';

export const META_BASE_URL = 'https://graph.facebook.com/v25.0';
const RATE_LIMIT_ERROR_CODES = new Set([17, 32]);

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

function buildUrl(path, params = {}, token) {
  const url = new URL(`${META_BASE_URL}${normalizePath(path)}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  url.searchParams.set('access_token', token);
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

export async function metaRequest(
  path,
  params = {},
  {
    method = 'GET',
    body,
    retryUnauthorized = true,
    retryThrottled = true,
    sleep: sleepFn = sleep
  } = {}
) {
  const token = await getAccessToken();
  const url = buildUrl(path, params, token);

  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body !== undefined && body !== null) {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, requestOptions);
  const payload = await parseResponse(response);

  if (response.ok) {
    return payload;
  }

  if (response.status === 401 && retryUnauthorized) {
    clearAuthCacheForTests();

    return metaRequest(path, params, {
      method,
      body,
      retryUnauthorized: false,
      retryThrottled,
      sleep: sleepFn
    });
  }

  const errorCode = extractErrorCode(payload);
  const isRateLimited = response.status === 429 || RATE_LIMIT_ERROR_CODES.has(errorCode);
  if (isRateLimited && retryThrottled) {
    await sleepFn(60_000);

    return metaRequest(path, params, {
      method,
      body,
      retryUnauthorized,
      retryThrottled: false,
      sleep: sleepFn
    });
  }

  const message = extractErrorMessage(payload);
  throw new Error(`Meta Ads API request failed (${response.status}): ${message}`);
}
