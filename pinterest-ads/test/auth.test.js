import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function clearPinterestEnv() {
  delete process.env.PINTEREST_ADS_ACCESS_TOKEN;
  delete process.env.PINTEREST_ADS_CLIENT_ID;
  delete process.env.PINTEREST_ADS_CLIENT_SECRET;
  delete process.env.PINTEREST_ADS_REFRESH_TOKEN;
}

beforeEach(() => {
  clearPinterestEnv();
  process.env.PINTEREST_ADS_ACCESS_TOKEN = 'pinterest-token-1';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('validateEnvironment', () => {
  test('passes when PINTEREST_ADS_ACCESS_TOKEN exists', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  test('passes when full refresh credential set exists without access token', async () => {
    clearPinterestEnv();
    process.env.PINTEREST_ADS_CLIENT_ID = 'client-1';
    process.env.PINTEREST_ADS_CLIENT_SECRET = 'secret-1';
    process.env.PINTEREST_ADS_REFRESH_TOKEN = 'refresh-1';

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  test('fails when no credentials exist', async () => {
    clearPinterestEnv();

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['PINTEREST_ADS_ACCESS_TOKEN']);
  });

  test('reports missing refresh vars when refresh set is partial', async () => {
    clearPinterestEnv();
    process.env.PINTEREST_ADS_CLIENT_ID = 'client-1';

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['PINTEREST_ADS_CLIENT_SECRET', 'PINTEREST_ADS_REFRESH_TOKEN']);
  });
});

describe('getAccessToken - static token', () => {
  test('returns token from environment', async () => {
    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken();

    assert.equal(token, 'pinterest-token-1');
  });

  test('returns cached token until cache is cleared', async () => {
    const { getAccessToken, clearAuthCache } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    process.env.PINTEREST_ADS_ACCESS_TOKEN = 'pinterest-token-2';
    const second = await getAccessToken();

    clearAuthCache();
    const third = await getAccessToken();

    assert.equal(first, 'pinterest-token-1');
    assert.equal(second, 'pinterest-token-1');
    assert.equal(third, 'pinterest-token-2');
  });

  test('throws when token is missing', async () => {
    clearPinterestEnv();

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /PINTEREST_ADS_ACCESS_TOKEN/
    );
  });
});

describe('getAccessToken - refresh flow', () => {
  beforeEach(() => {
    clearPinterestEnv();
    process.env.PINTEREST_ADS_CLIENT_ID = 'client-1';
    process.env.PINTEREST_ADS_CLIENT_SECRET = 'secret-1';
    process.env.PINTEREST_ADS_REFRESH_TOKEN = 'refresh-1';
  });

  test('exchanges refresh token via basic auth form POST', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const fetchImpl = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'refreshed-token', expires_in: 3600, token_type: 'bearer' };
        }
      };
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken({ fetchImpl });

    assert.equal(token, 'refreshed-token');
    assert.equal(capturedUrl, 'https://api.pinterest.com/v5/oauth/token');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(
      capturedOptions.headers.Authorization,
      `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`
    );
    assert.equal(capturedOptions.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(capturedOptions.body, 'grant_type=refresh_token&refresh_token=refresh-1');
  });

  test('prefers refresh flow over static token when both configured', async () => {
    process.env.PINTEREST_ADS_ACCESS_TOKEN = 'static-token';

    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { access_token: 'refreshed-token', expires_in: 3600, token_type: 'bearer' };
      }
    });

    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken({ fetchImpl });

    assert.equal(token, 'refreshed-token');
  });

  test('caches refreshed token until near expiry', async () => {
    let calls = 0;

    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: `refreshed-token-${calls}`, expires_in: 3600, token_type: 'bearer' };
        }
      };
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    const first = await getAccessToken({ fetchImpl });
    const second = await getAccessToken({ fetchImpl });

    assert.equal(first, 'refreshed-token-1');
    assert.equal(second, 'refreshed-token-1');
    assert.equal(calls, 1);
  });

  test('refreshes again after cache is cleared', async () => {
    let calls = 0;

    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: `refreshed-token-${calls}`, expires_in: 3600, token_type: 'bearer' };
        }
      };
    };

    const { getAccessToken, clearAuthCache } = await importFresh('../server/auth.js');
    await getAccessToken({ fetchImpl });
    clearAuthCache();
    const second = await getAccessToken({ fetchImpl });

    assert.equal(second, 'refreshed-token-2');
    assert.equal(calls, 2);
  });

  test('warns on stderr when the refresh token is rotated', async () => {
    const warnings = [];
    const originalConsoleError = console.error;
    console.error = (message) => warnings.push(String(message));

    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          access_token: 'refreshed-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
          token_type: 'bearer'
        };
      }
    });

    try {
      const { getAccessToken } = await importFresh('../server/auth.js');
      await getAccessToken({ fetchImpl });
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /rotated the refresh token/);
    assert.match(warnings[0], /PINTEREST_ADS_REFRESH_TOKEN/);
  });

  test('throws with status and message when refresh fails', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      async json() {
        return { code: 1, message: 'Invalid refresh token' };
      }
    });

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken({ fetchImpl }),
      /Pinterest Ads token refresh failed \(400\): Invalid refresh token/
    );
  });
});
