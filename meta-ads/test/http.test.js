import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function jsonResponse(data, init = {}) {
  const customHeaders = {};
  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers)) {
      customHeaders[String(key).toLowerCase()] = String(value);
    }
  }

  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get(name) {
        const normalized = String(name).toLowerCase();
        if (normalized === 'content-type') {
          return init.contentType ?? 'application/json';
        }
        return customHeaders[normalized] ?? null;
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

beforeEach(() => {
  process.env.META_ADS_ACCESS_TOKEN = 'meta-token-123';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

describe('metaRequest', () => {
  test('builds Graph API URL with query params and sends bearer auth header', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return jsonResponse({ data: [] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    await metaRequest('/me/adaccounts', { fields: 'id,name', limit: 10 });

    assert.match(capturedUrl, /^https:\/\/graph\.facebook\.com\/v25\.0\/me\/adaccounts\?/);
    assert.match(capturedUrl, /fields=id%2Cname/);
    assert.match(capturedUrl, /limit=10/);
    assert.doesNotMatch(capturedUrl, /access_token=/);
    assert.equal(capturedOptions.headers.Authorization, 'Bearer meta-token-123');
  });

  test('does not retry on 401 responses', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { error: { message: 'Invalid OAuth access token.' } },
          { ok: false, status: 401 }
        );
      }

      return jsonResponse({ data: [{ id: '1' }] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    await assert.rejects(
      () => metaRequest('/me/adaccounts'),
      /Invalid OAuth access token/
    );

    assert.equal(calls, 1);
  });

  test('retries once on Graph rate-limit error code 17', async () => {
    let calls = 0;
    let slept = false;

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { error: { code: 17, message: 'User request limit reached' } },
          { ok: false, status: 400 }
        );
      }

      return jsonResponse({ data: [{ id: '1' }] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    const result = await metaRequest(
      '/me/adaccounts',
      {},
      {
        sleep: async () => {
          slept = true;
        }
      }
    );

    assert.equal(calls, 2);
    assert.equal(slept, true);
    assert.equal(result.data.length, 1);
  });

  test('retries once on HTTP 429', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { error: { message: 'Too many requests' } },
          { ok: false, status: 429 }
        );
      }

      return jsonResponse({ data: [{ id: '1' }] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    const result = await metaRequest(
      '/me/adaccounts',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [60_000]);
    assert.equal(result.data.length, 1);
  });

  test('uses Retry-After header value for throttled retries', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { error: { message: 'Too many requests' } },
          {
            ok: false,
            status: 429,
            headers: { 'Retry-After': '7' }
          }
        );
      }

      return jsonResponse({ data: [{ id: '1' }] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    const result = await metaRequest(
      '/me/adaccounts',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [7_000]);
    assert.equal(result.data.length, 1);
  });

  test('aborts requests that exceed timeout', async () => {
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { metaRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => metaRequest('/me/adaccounts', {}, { timeoutMs: 5 }),
      /timed out/i
    );
  });

  test('uses META_ADS_REQUEST_TIMEOUT_MS when timeout option is omitted', async () => {
    process.env.META_ADS_REQUEST_TIMEOUT_MS = '4';

    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { metaRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => metaRequest('/me/adaccounts'),
      /timed out after 4ms/i
    );
  });

  test('throws extracted Graph API error message', async () => {
    global.fetch = async () => jsonResponse(
      { error: { message: 'Unsupported get request.' } },
      { ok: false, status: 400 }
    );

    const { metaRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => metaRequest('/me/adaccounts'),
      /Unsupported get request/
    );
  });

  test('throws immediately on 401 without retry side effects', async () => {
    let calls = 0;

    global.fetch = async () => {
      calls += 1;
      return jsonResponse(
        { error: { message: 'Invalid OAuth access token.' } },
        { ok: false, status: 401 }
      );
    };

    const { metaRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => metaRequest('/me/adaccounts'),
      /Invalid OAuth access token/
    );

    assert.equal(calls, 1);
  });
});
