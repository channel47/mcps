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
  delete process.env.PINTEREST_ADS_CLIENT_ID;
  delete process.env.PINTEREST_ADS_CLIENT_SECRET;
  delete process.env.PINTEREST_ADS_REFRESH_TOKEN;
  process.env.PINTEREST_ADS_ACCESS_TOKEN = 'pinterest-token-123';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

describe('pinterestRequest', () => {
  test('builds v5 URL with query params and sends bearer auth header', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return jsonResponse({ items: [] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    await pinterestRequest('/ad_accounts', { page_size: 250, bookmark: 'abc' });

    assert.match(capturedUrl, /^https:\/\/api\.pinterest\.com\/v5\/ad_accounts\?/);
    assert.match(capturedUrl, /page_size=250/);
    assert.match(capturedUrl, /bookmark=abc/);
    assert.equal(capturedOptions.headers.Authorization, 'Bearer pinterest-token-123');
  });

  test('serializes array params as comma-separated strings', async () => {
    let capturedUrl = null;

    global.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ items: [] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    await pinterestRequest('/ad_accounts/1/campaigns', {
      campaign_ids: ['111', '222'],
      entity_statuses: ['ACTIVE', 'PAUSED']
    });

    assert.match(capturedUrl, /campaign_ids=111%2C222/);
    assert.match(capturedUrl, /entity_statuses=ACTIVE%2CPAUSED/);
  });

  test('skips null, undefined, and empty params', async () => {
    let capturedUrl = null;

    global.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ items: [] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    await pinterestRequest('/ad_accounts', {
      page_size: 25,
      bookmark: null,
      order: undefined,
      campaign_ids: []
    });

    assert.match(capturedUrl, /page_size=25/);
    assert.doesNotMatch(capturedUrl, /bookmark=/);
    assert.doesNotMatch(capturedUrl, /order=/);
    assert.doesNotMatch(capturedUrl, /campaign_ids=/);
  });

  test('sends JSON body for mutation requests', async () => {
    let capturedOptions = null;

    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return jsonResponse({ items: [] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    await pinterestRequest('/ad_accounts/1/campaigns', {}, {
      method: 'POST',
      body: [{ name: 'Campaign A', objective_type: 'AWARENESS' }]
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.body, JSON.stringify([{ name: 'Campaign A', objective_type: 'AWARENESS' }]));
  });

  test('does not retry on 401 responses', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { code: 2, message: 'Authentication failed.' },
          { ok: false, status: 401 }
        );
      }

      return jsonResponse({ items: [{ id: '1' }] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    await assert.rejects(
      () => pinterestRequest('/ad_accounts'),
      /Authentication failed/
    );

    assert.equal(calls, 1);
  });

  test('retries once on HTTP 429 with default 60s sleep', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { code: 8, message: 'Too many requests' },
          { ok: false, status: 429 }
        );
      }

      return jsonResponse({ items: [{ id: '1' }] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    const result = await pinterestRequest(
      '/ad_accounts',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [60_000]);
    assert.equal(result.items.length, 1);
  });

  test('uses Retry-After header value for throttled retries', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { code: 8, message: 'Too many requests' },
          {
            ok: false,
            status: 429,
            headers: { 'Retry-After': '7' }
          }
        );
      }

      return jsonResponse({ items: [{ id: '1' }] });
    };

    const { pinterestRequest } = await importFresh('../server/http.js');
    const result = await pinterestRequest(
      '/ad_accounts',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [7_000]);
    assert.equal(result.items.length, 1);
  });

  test('fails after a second 429 (retries only once)', async () => {
    let calls = 0;

    global.fetch = async () => {
      calls += 1;
      return jsonResponse(
        { code: 8, message: 'Too many requests' },
        { ok: false, status: 429 }
      );
    };

    const { pinterestRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => pinterestRequest('/ad_accounts', {}, { sleep: async () => {} }),
      /Pinterest Ads API request failed \(429\)/
    );

    assert.equal(calls, 2);
  });

  test('aborts requests that exceed timeout', async () => {
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { pinterestRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => pinterestRequest('/ad_accounts', {}, { timeoutMs: 5 }),
      /timed out/i
    );
  });

  test('uses PINTEREST_ADS_REQUEST_TIMEOUT_MS when timeout option is omitted', async () => {
    process.env.PINTEREST_ADS_REQUEST_TIMEOUT_MS = '4';

    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { pinterestRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => pinterestRequest('/ad_accounts'),
      /timed out after 4ms/i
    );
  });

  test('throws extracted API error message with code suffix', async () => {
    global.fetch = async () => jsonResponse(
      { code: 2, message: 'AdAccount not found.' },
      { ok: false, status: 404 }
    );

    const { pinterestRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => pinterestRequest('/ad_accounts/999'),
      /Pinterest Ads API request failed \(404\): AdAccount not found\. \[code 2\]/
    );
  });
});
