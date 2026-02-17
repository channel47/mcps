const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const TOKEN_SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const REQUIRED_ENV_VARS = [
  'BING_ADS_CLIENT_ID',
  'BING_ADS_CLIENT_SECRET',
  'BING_ADS_REFRESH_TOKEN',
  'BING_ADS_DEVELOPER_TOKEN'
];

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;
let refreshPromise = null;
let currentRefreshToken = process.env.BING_ADS_REFRESH_TOKEN || null;

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  return {
    valid: missing.length === 0,
    missing
  };
}

function isTokenValid() {
  return Boolean(cachedAccessToken) && Date.now() < accessTokenExpiresAt - REFRESH_BUFFER_MS;
}

async function parseTokenResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Failed parsing OAuth token response: ${error.message}`);
  }

  if (!response.ok) {
    const description = payload?.error_description || payload?.error || 'unknown_error';
    throw new Error(`OAuth token refresh failed (${response.status}): ${description}`);
  }

  if (!payload?.access_token) {
    throw new Error('OAuth token response missing access_token');
  }

  return payload;
}

async function performAccessTokenRefresh() {
  const { valid, missing } = validateEnvironment();
  if (!valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!currentRefreshToken) {
    currentRefreshToken = process.env.BING_ADS_REFRESH_TOKEN;
  }

  if (!currentRefreshToken) {
    throw new Error('Missing refresh token for Microsoft Advertising OAuth flow');
  }

  const body = new URLSearchParams({
    client_id: process.env.BING_ADS_CLIENT_ID,
    client_secret: process.env.BING_ADS_CLIENT_SECRET,
    refresh_token: currentRefreshToken,
    grant_type: 'refresh_token',
    scope: TOKEN_SCOPE
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await parseTokenResponse(response);
  const expiresInMs = Number(payload.expires_in ?? 3600) * 1000;

  cachedAccessToken = payload.access_token;
  accessTokenExpiresAt = Date.now() + expiresInMs;

  if (payload.refresh_token && payload.refresh_token !== currentRefreshToken) {
    currentRefreshToken = payload.refresh_token;
    // Rotation is expected; warn so operators can persist the new token out-of-band.
    console.error('BING_ADS_REFRESH_TOKEN rotated during refresh; update your stored token for future sessions.');
  }

  return cachedAccessToken;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performAccessTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function getAccessToken() {
  if (isTokenValid()) {
    return cachedAccessToken;
  }

  return refreshAccessToken();
}

export function clearAuthCacheForTests() {
  cachedAccessToken = null;
  accessTokenExpiresAt = 0;
  refreshPromise = null;
  currentRefreshToken = process.env.BING_ADS_REFRESH_TOKEN || null;
}
