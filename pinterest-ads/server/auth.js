const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const REFRESH_ENV_VARS = [
  'PINTEREST_ADS_CLIENT_ID',
  'PINTEREST_ADS_CLIENT_SECRET',
  'PINTEREST_ADS_REFRESH_TOKEN'
];
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cachedAccessToken = null;
let cachedTokenExpiresAt = null;

function hasStaticToken() {
  return Boolean(process.env.PINTEREST_ADS_ACCESS_TOKEN);
}

function missingRefreshVars() {
  return REFRESH_ENV_VARS.filter((name) => !process.env[name]);
}

function hasRefreshCredentials() {
  return missingRefreshVars().length === 0;
}

/**
 * Validate required environment variables for Pinterest Ads auth.
 * Valid when PINTEREST_ADS_ACCESS_TOKEN is set, or when all of
 * PINTEREST_ADS_CLIENT_ID + PINTEREST_ADS_CLIENT_SECRET + PINTEREST_ADS_REFRESH_TOKEN are set.
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnvironment() {
  if (hasStaticToken() || hasRefreshCredentials()) {
    return { valid: true, missing: [] };
  }

  const partialRefresh = missingRefreshVars().length < REFRESH_ENV_VARS.length;
  if (partialRefresh) {
    return { valid: false, missing: missingRefreshVars() };
  }

  return { valid: false, missing: ['PINTEREST_ADS_ACCESS_TOKEN'] };
}

function extractRefreshErrorMessage(payload) {
  if (payload && typeof payload === 'object') {
    return payload.message || payload.error_description || payload.error || 'Unknown OAuth error';
  }

  if (typeof payload === 'string' && payload) {
    return payload;
  }

  return 'Unknown OAuth error';
}

async function refreshAccessToken(fetchImpl) {
  const clientId = process.env.PINTEREST_ADS_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_ADS_CLIENT_SECRET;
  const refreshToken = process.env.PINTEREST_ADS_REFRESH_TOKEN;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.access_token) {
    const message = extractRefreshErrorMessage(payload);
    throw new Error(`Pinterest Ads token refresh failed (${response.status}): ${message}`);
  }

  if (payload.refresh_token && payload.refresh_token !== refreshToken) {
    console.error(
      'Warning: Pinterest rotated the refresh token (continuous refresh). '
      + 'Update PINTEREST_ADS_REFRESH_TOKEN with the new value or future refreshes may fail.'
    );
  }

  const expiresInMs = Number(payload.expires_in || 0) * 1000;
  cachedAccessToken = String(payload.access_token);
  cachedTokenExpiresAt = expiresInMs > 0 ? Date.now() + expiresInMs - REFRESH_MARGIN_MS : null;

  return cachedAccessToken;
}

/**
 * Return a Pinterest Ads access token with in-memory caching.
 * Prefers the refresh-token flow when full OAuth credentials are configured;
 * otherwise falls back to the static PINTEREST_ADS_ACCESS_TOKEN value.
 * @param {{ fetchImpl?: typeof fetch }} [dependencies]
 * @returns {Promise<string>}
 */
export async function getAccessToken(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;

  const { valid, missing } = validateEnvironment();
  if (!valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (hasRefreshCredentials()) {
    const cacheIsFresh = cachedAccessToken
      && (cachedTokenExpiresAt === null || Date.now() < cachedTokenExpiresAt);
    if (cacheIsFresh) {
      return cachedAccessToken;
    }

    return refreshAccessToken(fetchImpl);
  }

  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  cachedAccessToken = String(process.env.PINTEREST_ADS_ACCESS_TOKEN);
  cachedTokenExpiresAt = null;
  return cachedAccessToken;
}

/**
 * Clear the in-memory token cache (used by tests and local dev flows).
 */
export function clearAuthCache() {
  cachedAccessToken = null;
  cachedTokenExpiresAt = null;
}
