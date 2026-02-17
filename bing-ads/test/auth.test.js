import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function jsonResponse(data, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    async json() {
      return data;
    },
    async text() {
      return JSON.stringify(data);
    }
  };
}

beforeEach(() => {
  process.env.BING_ADS_CLIENT_ID = 'client-id';
  process.env.BING_ADS_CLIENT_SECRET = 'client-secret';
  process.env.BING_ADS_REFRESH_TOKEN = 'refresh-token-1';
  process.env.BING_ADS_DEVELOPER_TOKEN = 'dev-token';
  process.env.BING_ADS_CUSTOMER_ID = '999999';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

// ── validateEnvironment ──────────────────────────────────────

describe('validateEnvironment', () => {
  test('passes when all required env vars are present', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.equal(result.missing.length, 0);
  });

  test('returns single missing var', async () => {
    delete process.env.BING_ADS_CLIENT_SECRET;

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.ok(result.missing.includes('BING_ADS_CLIENT_SECRET'));
    assert.equal(result.missing.length, 1);
  });

  test('returns all missing vars when none are set', async () => {
    delete process.env.BING_ADS_CLIENT_ID;
    delete process.env.BING_ADS_CLIENT_SECRET;
    delete process.env.BING_ADS_REFRESH_TOKEN;
    delete process.env.BING_ADS_DEVELOPER_TOKEN;

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.equal(result.missing.length, 4);
    assert.ok(result.missing.includes('BING_ADS_CLIENT_ID'));
    assert.ok(result.missing.includes('BING_ADS_CLIENT_SECRET'));
    assert.ok(result.missing.includes('BING_ADS_REFRESH_TOKEN'));
    assert.ok(result.missing.includes('BING_ADS_DEVELOPER_TOKEN'));
  });
});

// ── getAccessToken ───────────────────────────────────────────

describe('getAccessToken', () => {
  test('refreshes and then serves cached token', async () => {
    let fetchCallCount = 0;
    global.fetch = async () => {
      fetchCallCount += 1;
      return jsonResponse({
        access_token: 'access-token-1',
        expires_in: 3600,
        refresh_token: 'refresh-token-2'
      });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    const first = await getAccessToken();
    const second = await getAccessToken();

    assert.equal(first, 'access-token-1');
    assert.equal(second, 'access-token-1');
    assert.equal(fetchCallCount, 1);
  });

  test('uses rotated refresh token on subsequent refresh', async () => {
    const requestBodies = [];
    let fetchCallCount = 0;

    global.fetch = async (_url, options) => {
      fetchCallCount += 1;
      requestBodies.push(String(options.body));

      if (fetchCallCount === 1) {
        return jsonResponse({
          access_token: 'token-1',
          expires_in: 0,
          refresh_token: 'refresh-token-rotated'
        });
      }

      return jsonResponse({
        access_token: 'token-2',
        expires_in: 3600
      });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();
    await getAccessToken();

    assert.equal(fetchCallCount, 2);
    assert.match(requestBodies[0], /refresh_token=refresh-token-1/);
    assert.match(requestBodies[1], /refresh_token=refresh-token-rotated/);
  });

  test('throws if token endpoint does not return access_token', async () => {
    global.fetch = async () => jsonResponse({ token_type: 'Bearer' });

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /access_token/
    );
  });

  test('throws on non-ok response with error_description', async () => {
    global.fetch = async () => jsonResponse(
      { error: 'invalid_grant', error_description: 'Refresh token revoked' },
      { ok: false, status: 400 }
    );

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /Refresh token revoked/
    );
  });

  test('throws on non-ok response with generic error field', async () => {
    global.fetch = async () => jsonResponse(
      { error: 'server_error' },
      { ok: false, status: 500 }
    );

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /server_error/
    );
  });

  test('throws when response body is not valid JSON', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError('Unexpected token');
      },
      async text() {
        return '<html>Not JSON</html>';
      }
    });

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /Failed parsing/
    );
  });

  test('sends correct OAuth parameters to token endpoint', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    let capturedHeaders = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = String(options.body);
      capturedHeaders = options.headers;
      return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    assert.equal(capturedUrl, 'https://login.microsoftonline.com/common/oauth2/v2.0/token');
    assert.match(capturedBody, /client_id=client-id/);
    assert.match(capturedBody, /client_secret=client-secret/);
    assert.match(capturedBody, /refresh_token=refresh-token-1/);
    assert.match(capturedBody, /grant_type=refresh_token/);
    assert.match(capturedBody, /scope=/);
    assert.equal(capturedHeaders['Content-Type'], 'application/x-www-form-urlencoded');
  });

  test('defaults expires_in to 3600 when missing from response', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount += 1;
      return jsonResponse({ access_token: 'tok' });
    };

    const { getAccessToken } = await importFresh('../server/auth.js');
    const tok1 = await getAccessToken();
    const tok2 = await getAccessToken();

    assert.equal(tok1, 'tok');
    assert.equal(tok2, 'tok');
    assert.equal(fetchCount, 1);
  });
});

// ── refreshAccessToken ───────────────────────────────────────

describe('refreshAccessToken', () => {
  test('deduplicates concurrent refresh calls', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount += 1;
      return jsonResponse({ access_token: 'shared-token', expires_in: 3600 });
    };

    const { refreshAccessToken } = await importFresh('../server/auth.js');
    const [tok1, tok2, tok3] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken()
    ]);

    assert.equal(tok1, 'shared-token');
    assert.equal(tok2, 'shared-token');
    assert.equal(tok3, 'shared-token');
    assert.equal(fetchCount, 1);
  });

  test('clears dedup promise after resolution so next call refreshes', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount += 1;
      return jsonResponse({ access_token: `tok-${fetchCount}`, expires_in: 0 });
    };

    const { refreshAccessToken } = await importFresh('../server/auth.js');
    const tok1 = await refreshAccessToken();
    const tok2 = await refreshAccessToken();

    assert.equal(tok1, 'tok-1');
    assert.equal(tok2, 'tok-2');
    assert.equal(fetchCount, 2);
  });

  test('clears dedup promise after rejection so recovery is possible', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return jsonResponse(
          { error: 'temporary_error' },
          { ok: false, status: 503 }
        );
      }
      return jsonResponse({ access_token: 'recovered', expires_in: 3600 });
    };

    const { refreshAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(() => refreshAccessToken());

    const tok = await refreshAccessToken();
    assert.equal(tok, 'recovered');
    assert.equal(fetchCount, 2);
  });

  test('throws when required env vars are missing', async () => {
    delete process.env.BING_ADS_CLIENT_ID;

    const { refreshAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => refreshAccessToken(),
      /Missing required environment variables.*BING_ADS_CLIENT_ID/
    );
  });
});

// ── clearAuthCacheForTests ───────────────────────────────────

describe('clearAuthCacheForTests', () => {
  test('forces re-fetch after clearing cache', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount += 1;
      return jsonResponse({ access_token: `tok-${fetchCount}`, expires_in: 3600 });
    };

    const { getAccessToken, clearAuthCacheForTests } = await importFresh('../server/auth.js');

    await getAccessToken();
    assert.equal(fetchCount, 1);

    await getAccessToken();
    assert.equal(fetchCount, 1);

    clearAuthCacheForTests();
    await getAccessToken();
    assert.equal(fetchCount, 2);
  });
});
