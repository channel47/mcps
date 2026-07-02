const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

const REFRESH_FLOW_ENV_VARS = [
  'LINKEDIN_ADS_CLIENT_ID',
  'LINKEDIN_ADS_CLIENT_SECRET',
  'LINKEDIN_ADS_REFRESH_TOKEN'
];

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;
let refreshPromise = null;

/**
 * Check whether the full OAuth refresh-token credential set is configured.
 * @returns {boolean}
 */
export function hasRefreshFlowCredentials() {
  return REFRESH_FLOW_ENV_VARS.every((name) => Boolean(process.env[name]));
}

/**
 * Validate environment variables for LinkedIn Ads auth. Auth is valid with
 * either a static LINKEDIN_ADS_ACCESS_TOKEN or the complete refresh trio
 * (LINKEDIN_ADS_CLIENT_ID + LINKEDIN_ADS_CLIENT_SECRET + LINKEDIN_ADS_REFRESH_TOKEN).
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnvironment() {
  if (process.env.LINKEDIN_ADS_ACCESS_TOKEN || hasRefreshFlowCredentials()) {
    return { valid: true, missing: [] };
  }

  const partialRefreshConfig = REFRESH_FLOW_ENV_VARS.some((name) => Boolean(process.env[name]));
  const missing = partialRefreshConfig
    ? REFRESH_FLOW_ENV_VARS.filter((name) => !process.env[name])
    : ['LINKEDIN_ADS_ACCESS_TOKEN'];

  return {
    valid: false,
    missing
  };
}

function isCachedTokenValid() {
  return Boolean(cachedAccessToken) && Date.now() < accessTokenExpiresAt - REFRESH_BUFFER_MS;
}

async function parseTokenResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Failed parsing LinkedIn OAuth token response: ${error.message}`);
  }

  if (!response.ok) {
    const detail = payload?.error_description || payload?.error || 'unknown_error';
    throw new Error(`LinkedIn OAuth token refresh failed (${response.status}): ${detail}`);
  }

  if (!payload?.access_token) {
    throw new Error('LinkedIn OAuth token response missing access_token');
  }

  return payload;
}

async function performAccessTokenRefresh() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.LINKEDIN_ADS_REFRESH_TOKEN,
    client_id: process.env.LINKEDIN_ADS_CLIENT_ID,
    client_secret: process.env.LINKEDIN_ADS_CLIENT_SECRET
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await parseTokenResponse(response);
  const expiresInMs = Number(payload.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS) * 1000;

  cachedAccessToken = payload.access_token;
  accessTokenExpiresAt = Date.now() + expiresInMs;

  return cachedAccessToken;
}

/**
 * Force a token refresh via the LinkedIn OAuth refresh_token grant.
 * Concurrent callers share a single in-flight refresh.
 * @returns {Promise<string>}
 */
export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performAccessTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

/**
 * Return a valid LinkedIn access token. Prefers the OAuth refresh flow when
 * the full credential trio is configured (tokens are cached in memory and
 * refreshed ~5 minutes before expiry); otherwise the static
 * LINKEDIN_ADS_ACCESS_TOKEN is used directly.
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  if (hasRefreshFlowCredentials()) {
    if (isCachedTokenValid()) {
      return cachedAccessToken;
    }

    return refreshAccessToken();
  }

  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const { valid, missing } = validateEnvironment();
  if (!valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  cachedAccessToken = String(process.env.LINKEDIN_ADS_ACCESS_TOKEN);
  accessTokenExpiresAt = Number.MAX_SAFE_INTEGER;
  return cachedAccessToken;
}

/**
 * Clear the in-memory token cache (used by tests and local dev flows).
 */
export function clearAuthCache() {
  cachedAccessToken = null;
  accessTokenExpiresAt = 0;
  refreshPromise = null;
}
