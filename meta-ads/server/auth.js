const REQUIRED_ENV_VARS = ['META_ADS_ACCESS_TOKEN'];

let cachedAccessToken = null;

/**
 * Validate required environment variables for Meta Ads auth.
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
 * Return the configured Meta Ads access token with process-level caching.
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

  cachedAccessToken = String(process.env.META_ADS_ACCESS_TOKEN);
  return cachedAccessToken;
}

/**
 * Clear the in-memory token cache (used by tests and local dev flows).
 */
export function clearAuthCache() {
  cachedAccessToken = null;
}
