import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearAuthCacheForTests } from '../server/auth.js';

const ORIGINAL_ENV = { ...process.env };
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function jsonResponse(data, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get(name) {
        if (init.contentType !== undefined) {
          return String(name).toLowerCase() === 'content-type' ? init.contentType : null;
        }
        return String(name).toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return data;
    },
    async text() {
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  };
}

function tokenThenApi(apiHandler) {
  return async (url, options) => {
    if (url === TOKEN_URL) {
      return jsonResponse({
        access_token: 'test-access-token',
        expires_in: 3600
      });
    }
    return apiHandler(url, options);
  };
}

beforeEach(() => {
  process.env.BING_ADS_CLIENT_ID = 'client-id';
  process.env.BING_ADS_CLIENT_SECRET = 'client-secret';
  process.env.BING_ADS_REFRESH_TOKEN = 'refresh-token-1';
  process.env.BING_ADS_DEVELOPER_TOKEN = 'dev-token';
  process.env.BING_ADS_CUSTOMER_ID = '123456';
  process.env.BING_ADS_ACCOUNT_ID = '999999';
  clearAuthCacheForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

// ── BING_BASE_URLS ───────────────────────────────────────────

describe('BING_BASE_URLS', () => {
  test('exports expected base URLs', async () => {
    const { BING_BASE_URLS } = await importFresh('../server/http.js');

    assert.equal(BING_BASE_URLS.campaignManagement, 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13');
    assert.equal(BING_BASE_URLS.reporting, 'https://reporting.api.bingads.microsoft.com/Reporting/v13');
    assert.equal(BING_BASE_URLS.customerManagement, 'https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13');
    assert.equal(BING_BASE_URLS.contentApi, 'https://content.api.bingads.microsoft.com/shopping/v9.1/bmc');
  });
});

// ── Request headers ──────────────────────────────────────────

describe('request headers', () => {
  test('includes Authorization, DeveloperToken, and Content-Type', async () => {
    let capturedHeaders = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHeaders = options.headers;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', { data: 1 });

    assert.equal(capturedHeaders.Authorization, 'Bearer test-access-token');
    assert.equal(capturedHeaders.DeveloperToken, 'dev-token');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
  });

  test('includes CustomerAccountId and CustomerId when provided', async () => {
    let capturedHeaders = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHeaders = options.headers;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', {}, {
      accountId: '111',
      customerId: '222'
    });

    assert.equal(capturedHeaders.CustomerAccountId, '111');
    assert.equal(capturedHeaders.CustomerId, '222');
  });

  test('omits context headers when includeContextHeaders is false', async () => {
    let capturedHeaders = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHeaders = options.headers;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', {}, {
      accountId: '111',
      customerId: '222',
      includeContextHeaders: false
    });

    assert.equal(capturedHeaders.CustomerAccountId, undefined);
    assert.equal(capturedHeaders.CustomerId, undefined);
    assert.ok(capturedHeaders.Authorization);
    assert.ok(capturedHeaders.DeveloperToken);
  });

  test('omits CustomerAccountId when accountId is not provided', async () => {
    let capturedHeaders = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHeaders = options.headers;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', {}, { customerId: '222' });

    assert.equal(capturedHeaders.CustomerAccountId, undefined);
    assert.equal(capturedHeaders.CustomerId, '222');
  });

  test('contentRequest uses AuthenticationToken instead of Authorization', async () => {
    let capturedHeaders = null;
    let capturedMethod = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHeaders = options.headers;
      capturedMethod = options.method;
      return jsonResponse({ resources: [] });
    });

    const { contentRequest } = await importFresh('../server/http.js');
    await contentRequest('https://content.api.bingads.microsoft.com/shopping/v9.1/bmc/123/products?max-results=250');

    assert.equal(capturedHeaders.AuthenticationToken, 'test-access-token');
    assert.equal(capturedHeaders.Authorization, undefined);
    assert.equal(capturedHeaders.DeveloperToken, 'dev-token');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
    assert.equal(capturedMethod, 'GET');
  });
});

// ── Request body ─────────────────────────────────────────────

describe('request body', () => {
  test('JSON-stringifies object bodies', async () => {
    let capturedBody = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedBody = options.body;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', { key: 'value' });

    assert.equal(capturedBody, JSON.stringify({ key: 'value' }));
  });

  test('passes string bodies as-is', async () => {
    let capturedBody = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedBody = options.body;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', '<xml>data</xml>');

    assert.equal(capturedBody, '<xml>data</xml>');
  });

  test('omits body when null', async () => {
    let capturedHasBody = true;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHasBody = 'body' in options;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', null);

    assert.equal(capturedHasBody, false);
  });

  test('omits body when undefined', async () => {
    let capturedHasBody = true;

    global.fetch = tokenThenApi((_url, options) => {
      capturedHasBody = 'body' in options;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', undefined);

    assert.equal(capturedHasBody, false);
  });

  test('uses POST method by default', async () => {
    let capturedMethod = null;

    global.fetch = tokenThenApi((_url, options) => {
      capturedMethod = options.method;
      return jsonResponse({ ok: true });
    });

    const { bingRequest } = await importFresh('../server/http.js');
    await bingRequest('https://api.test/endpoint', {});

    assert.equal(capturedMethod, 'POST');
  });
});

// ── Response parsing ─────────────────────────────────────────

describe('response parsing', () => {
  test('parses JSON response with application/json content-type', async () => {
    global.fetch = tokenThenApi(() => jsonResponse({ result: 42 }));

    const { bingRequest } = await importFresh('../server/http.js');
    const result = await bingRequest('https://api.test/endpoint', {});

    assert.deepEqual(result, { result: 42 });
  });

  test('parses text response that happens to be valid JSON', async () => {
    global.fetch = tokenThenApi(() => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      async json() {
        throw new Error('should not be called');
      },
      async text() {
        return '{"fallback":true}';
      }
    }));

    const { bingRequest } = await importFresh('../server/http.js');
    const result = await bingRequest('https://api.test/endpoint', {});

    assert.deepEqual(result, { fallback: true });
  });

  test('returns plain text when response is not JSON', async () => {
    global.fetch = tokenThenApi(() => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      async json() {
        throw new Error('should not be called');
      },
      async text() {
        return '<html>Hello</html>';
      }
    }));

    const { bingRequest } = await importFresh('../server/http.js');
    const result = await bingRequest('https://api.test/endpoint', {});

    assert.equal(result, '<html>Hello</html>');
  });

  test('handles application/zip content-type via arrayBuffer', async () => {
    const zipData = new ArrayBuffer(8);
    global.fetch = tokenThenApi(() => ({
      ok: true,
      status: 200,
      headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/zip' : null },
      async arrayBuffer() {
        return zipData;
      },
      async json() {
        throw new Error('should not be called');
      }
    }));

    const { bingRequest } = await importFresh('../server/http.js');
    const result = await bingRequest('https://api.test/endpoint', {});

    assert.ok(result instanceof ArrayBuffer);
  });
});

// ── 401 retry ────────────────────────────────────────────────

describe('401 retry', () => {
  test('retries once on 401 then succeeds', async () => {
    let apiCallCount = 0;
    let tokenCount = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        tokenCount += 1;
        return jsonResponse({
          access_token: `token-${tokenCount}`,
          expires_in: 3600
        });
      }

      apiCallCount += 1;
      if (apiCallCount === 1) {
        return jsonResponse(
          { error: { message: 'Unauthorized' } },
          { ok: false, status: 401 }
        );
      }

      return jsonResponse({ success: true });
    };

    const { bingRequest } = await importFresh('../server/http.js');
    const result = await bingRequest('https://api.test/endpoint', {});

    assert.deepEqual(result, { success: true });
    assert.equal(apiCallCount, 2);
    assert.equal(tokenCount, 2);
  });

  test('throws after second 401 (does not loop infinitely)', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { error: { message: 'Still unauthorized' } },
        { ok: false, status: 401 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}),
      /Still unauthorized/
    );
  });

  test('does not retry 401 when retryUnauthorized is false', async () => {
    let apiCallCount = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      apiCallCount += 1;
      return jsonResponse(
        { error: { message: 'Unauthorized' } },
        { ok: false, status: 401 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}, { retryUnauthorized: false }),
      /Unauthorized/
    );

    assert.equal(apiCallCount, 1);
  });

  test('shares refresh across concurrent 401 retries', async () => {
    let tokenRequests = 0;
    let apiRequests = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        tokenRequests += 1;
        return jsonResponse({
          access_token: `token-${tokenRequests}`,
          expires_in: 3600,
          refresh_token: `refresh-${tokenRequests}`
        });
      }

      apiRequests += 1;
      if (apiRequests <= 2) {
        return jsonResponse(
          { error: { message: 'Unauthorized' } },
          { ok: false, status: 401 }
        );
      }

      return jsonResponse({ ok: true });
    };

    const { bingRequest } = await importFresh('../server/http.js');

    const [first, second] = await Promise.all([
      bingRequest('https://example.test/report', { ping: true }, { accountId: '1', customerId: '2' }),
      bingRequest('https://example.test/report', { ping: true }, { accountId: '1', customerId: '2' })
    ]);

    assert.deepEqual(first, { ok: true });
    assert.deepEqual(second, { ok: true });
    assert.equal(tokenRequests, 2);
  });
});

// ── Throttle retry ───────────────────────────────────────────

describe('throttle retry (error code 117)', () => {
  test('retries on error code 117 after delay', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);

    let apiCallCount = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      apiCallCount += 1;
      if (apiCallCount === 1) {
        return jsonResponse(
          { Errors: [{ Code: 117, Message: 'Rate limit exceeded' }] },
          { ok: false, status: 400 }
        );
      }

      return jsonResponse({ throttle_cleared: true });
    };

    try {
      const { bingRequest } = await importFresh('../server/http.js');
      const result = await bingRequest('https://api.test/endpoint', {});

      assert.deepEqual(result, { throttle_cleared: true });
      assert.equal(apiCallCount, 2);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  test('does not retry throttle when retryThrottled is false', async () => {
    let apiCallCount = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      apiCallCount += 1;
      return jsonResponse(
        { Errors: [{ Code: 117, Message: 'Rate limit exceeded' }] },
        { ok: false, status: 400 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}, { retryThrottled: false }),
      /Rate limit exceeded/
    );

    assert.equal(apiCallCount, 1);
  });

  test('does not throttle-retry for non-117 error codes', async () => {
    let apiCallCount = 0;

    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      apiCallCount += 1;
      return jsonResponse(
        { Errors: [{ Code: 500, Message: 'Internal server error' }] },
        { ok: false, status: 500 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}),
      /Internal server error/
    );

    assert.equal(apiCallCount, 1);
  });
});

// ── Error message extraction ─────────────────────────────────

describe('error message extraction', () => {
  test('extracts message from Errors array', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { Errors: [{ Code: 100, Message: 'First batch error' }] },
        { ok: false, status: 400 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}, { retryThrottled: false }),
      /First batch error/
    );
  });

  test('extracts message from OperationErrors array', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { OperationErrors: [{ Code: 200, Message: 'Operation failed' }] },
        { ok: false, status: 400 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}, { retryThrottled: false }),
      /Operation failed/
    );
  });

  test('extracts message from nested error.message', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { error: { message: 'Nested error message' } },
        { ok: false, status: 403 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}),
      /Nested error message/
    );
  });

  test('falls back to generic message for unstructured error', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { unexpected: 'payload' },
        { ok: false, status: 400 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}),
      /Unknown Bing Ads API error/
    );
  });

  test('includes HTTP status code in error message', async () => {
    global.fetch = async (url) => {
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }

      return jsonResponse(
        { message: 'Server down' },
        { ok: false, status: 503 }
      );
    };

    const { bingRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => bingRequest('https://api.test/endpoint', {}),
      /503/
    );
  });
});
