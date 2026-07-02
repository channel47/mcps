import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function clearAuthEnv() {
  delete process.env.LINKEDIN_ADS_ACCESS_TOKEN;
  delete process.env.LINKEDIN_ADS_CLIENT_ID;
  delete process.env.LINKEDIN_ADS_CLIENT_SECRET;
  delete process.env.LINKEDIN_ADS_REFRESH_TOKEN;
}

function tokenResponse(payload, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    async json() {
      return payload;
    }
  };
}

beforeEach(() => {
  clearAuthEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

describe('validateEnvironment', () => {
  test('passes with static access token', async () => {
    process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'linkedin-token-1';

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  test('passes with complete refresh credential trio', async () => {
    process.env.LINKEDIN_ADS_CLIENT_ID = 'client-id';
    process.env.LINKEDIN_ADS_CLIENT_SECRET = 'client-secret';
    process.env.LINKEDIN_ADS_REFRESH_TOKEN = 'refresh-token';

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
  });

  test('fails with nothing configured, pointing at the access token', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['LINKEDIN_ADS_ACCESS_TOKEN']);
  });

  test('fails with a partial refresh trio, listing the missing refresh vars', async () => {
    process.env.LINKEDIN_ADS_CLIENT_ID = 'client-id';
    process.env.LINKEDIN_ADS_REFRESH_TOKEN = 'refresh-token';

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['LINKEDIN_ADS_CLIENT_SECRET']);
  });
});

describe('getAccessToken - static token', () => {
  test('returns token from environment', async () => {
    process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'linkedin-token-1';

    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken();

    assert.equal(token, 'linkedin-token-1');
  });

  test('returns cached token until cache is cleared', async () => {
    process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'linkedin-token-1';

    const { getAccessToken, clearAuthCache } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'linkedin-token-2';
    const second = await getAccessToken();

    clearAuthCache();
    const third = await getAccessToken();

    assert.equal(first, 'linkedin-token-1');
    assert.equal(second, 'linkedin-token-1');
    assert.equal(third, 'linkedin-token-2');
  });

  test('throws when no credentials are configured', async () => {
    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /LINKEDIN_ADS_ACCESS_TOKEN/
    );
  });
});

describe('getAccessToken - refresh flow', () => {
  function setRefreshEnv() {
    process.env.LINKEDIN_ADS_CLIENT_ID = 'client-id';
    process.env.LINKEDIN_ADS_CLIENT_SECRET = 'client-secret';
    process.env.LINKEDIN_ADS_REFRESH_TOKEN = 'refresh-token-1';
  }

  test('exchanges refresh token for access token via form-encoded POST', async () => {
    setRefreshEnv();

    let capturedUrl = null;
    let capturedOptions = null;
    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return tokenResponse({ access_token: 'refreshed-token', expires_in: 3600 });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken();

    assert.equal(token, 'refreshed-token');
    assert.equal(capturedUrl, 'https://www.linkedin.com/oauth/v2/accessToken');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/x-www-form-urlencoded');

    const body = capturedOptions.body.toString();
    assert.match(body, /grant_type=refresh_token/);
    assert.match(body, /refresh_token=refresh-token-1/);
    assert.match(body, /client_id=client-id/);
    assert.match(body, /client_secret=client-secret/);
  });

  test('caches the access token until near expiry', async () => {
    setRefreshEnv();

    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return tokenResponse({ access_token: `token-${calls}`, expires_in: 3600 });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    const second = await getAccessToken();

    assert.equal(first, 'token-1');
    assert.equal(second, 'token-1');
    assert.equal(calls, 1);
  });

  test('refreshes when the cached token is inside the expiry buffer', async () => {
    setRefreshEnv();

    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      // expires_in of 60s is within the 5-minute refresh buffer immediately
      return tokenResponse({ access_token: `token-${calls}`, expires_in: 60 });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    const second = await getAccessToken();

    assert.equal(first, 'token-1');
    assert.equal(second, 'token-2');
    assert.equal(calls, 2);
  });

  test('prefers refresh flow over a static token when both are configured', async () => {
    setRefreshEnv();
    process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'static-token';

    global.fetch = async () => tokenResponse({ access_token: 'refreshed-token', expires_in: 3600 });

    const { getAccessToken } = await importFresh('../server/auth.js');
    assert.equal(await getAccessToken(), 'refreshed-token');
  });

  test('surfaces OAuth errors with status and description', async () => {
    setRefreshEnv();

    global.fetch = async () => tokenResponse(
      { error: 'invalid_grant', error_description: 'The provided authorization grant is invalid' },
      { ok: false, status: 400 }
    );

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /LinkedIn OAuth token refresh failed \(400\): The provided authorization grant is invalid/
    );
  });

  test('rejects token responses without access_token', async () => {
    setRefreshEnv();

    global.fetch = async () => tokenResponse({ expires_in: 3600 });

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /missing access_token/
    );
  });
});
