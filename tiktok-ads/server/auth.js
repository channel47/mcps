const REQUIRED_ENV_VARS = ['TIKTOK_ADS_ACCESS_TOKEN'];

let cachedAccessToken = null;

/**
 * Validate required environment variables for TikTok Ads auth.
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Return the configured TikTok Ads access token with process-level caching.
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const { valid, missing } = validateEnvironment();
  if (!valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  cachedAccessToken = String(process.env.TIKTOK_ADS_ACCESS_TOKEN);
  return cachedAccessToken;
}

/**
 * Return optional developer app credentials used for advertiser discovery
 * via GET /oauth2/advertiser/get/, or null when not configured.
 * @returns {{ appId: string, appSecret: string } | null}
 */
export function getAppCredentials() {
  const appId = process.env.TIKTOK_ADS_APP_ID;
  const appSecret = process.env.TIKTOK_ADS_APP_SECRET;

  if (!appId || !appSecret) {
    return null;
  }

  return {
    appId: String(appId),
    appSecret: String(appSecret)
  };
}

/**
 * Clear the in-memory token cache (used by tests and local dev flows).
 */
export function clearAuthCache() {
  cachedAccessToken = null;
}
