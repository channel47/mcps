import { randomBytes } from 'node:crypto';
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const TOKEN_SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const REQUIRED_ENV_VARS = [
  'BING_ADS_CLIENT_ID',
  'BING_ADS_REFRESH_TOKEN',
  'BING_ADS_DEVELOPER_TOKEN'
];

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;
let refreshPromise = null;
let currentRefreshToken = loadInitialRefreshToken();

function readTokenStore(storePath) {
  try {
    const data = JSON.parse(readFileSync(storePath, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch (error) {
    // Report only the error code: JSON parse messages can echo file contents.
    if (error.code !== 'ENOENT') {
      console.error(`Ignoring unreadable BING_ADS_TOKEN_STORE (${error.code || 'invalid JSON'}).`);
    }
    return null;
  }
}

function loadInitialRefreshToken() {
  if (process.env.BING_ADS_REFRESH_TOKEN) {
    return process.env.BING_ADS_REFRESH_TOKEN;
  }

  const storePath = process.env.BING_ADS_TOKEN_STORE;
  const storedToken = storePath ? readTokenStore(storePath)?.refresh_token : null;
  return typeof storedToken === 'string' && storedToken ? storedToken : null;
}

// Atomically replace the store (temp file + rename) so a crash never leaves a partial token.
function persistRefreshToken(storePath, refreshToken) {
  const tmpPath = join(dirname(storePath), `.${basename(storePath)}.${randomBytes(6).toString('hex')}.tmp`);
  const data = {
    ...readTokenStore(storePath),
    refresh_token: refreshToken,
    updated_at: new Date().toISOString(),
    source: 'bing-ads-mcp'
  };

  try {
    writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    renameSync(tmpPath, storePath);
    return true;
  } catch (error) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Temp file was never created.
    }
    console.error(`Failed to write BING_ADS_TOKEN_STORE (${error.code || 'unknown error'}); rotated token kept in memory only.`);
    return false;
  }
}

export function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    if (name === 'BING_ADS_REFRESH_TOKEN') {
      return !currentRefreshToken && !loadInitialRefreshToken();
    }
    return !process.env[name];
  });
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
    const errorCode = payload?.error || 'unknown_error';
    throw new Error(`OAuth token refresh failed (${response.status}): ${errorCode}`);
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
    currentRefreshToken = loadInitialRefreshToken();
  }

  if (!currentRefreshToken) {
    throw new Error('Missing refresh token for Microsoft Advertising OAuth flow');
  }

  const params = {
    client_id: process.env.BING_ADS_CLIENT_ID,
    refresh_token: currentRefreshToken,
    grant_type: 'refresh_token',
    scope: TOKEN_SCOPE
  };

  if (process.env.BING_ADS_CLIENT_SECRET) {
    params.client_secret = process.env.BING_ADS_CLIENT_SECRET;
  }

  const body = new URLSearchParams(params);

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
    // Rotation is expected; persist it when a token store is configured, otherwise warn.
    const storePath = process.env.BING_ADS_TOKEN_STORE;
    if (storePath && persistRefreshToken(storePath, currentRefreshToken)) {
      console.error('BING_ADS_REFRESH_TOKEN rotated during refresh; saved to BING_ADS_TOKEN_STORE.');
    } else if (!storePath) {
      console.error('BING_ADS_REFRESH_TOKEN rotated during refresh; update your stored token for future sessions (or set BING_ADS_TOKEN_STORE).');
    }
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
  currentRefreshToken = loadInitialRefreshToken();
}
