const REQUIRED_ENV_VARS = ['META_ADS_ACCESS_TOKEN'];

let cachedAccessToken = null;

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  return {
    valid: missing.length === 0,
    missing
  };
}

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

export function clearAuthCacheForTests() {
  cachedAccessToken = null;
}
