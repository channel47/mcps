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

function okEnvelope(data = {}) {
  return { code: 0, message: 'OK', request_id: 'req-1', data };
}

beforeEach(() => {
  process.env.TIKTOK_ADS_ACCESS_TOKEN = 'tiktok-token-123';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

describe('tiktokRequest', () => {
  test('builds Business API URL with query params and sends Access-Token header', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return jsonResponse(okEnvelope({ list: [] }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    await tiktokRequest('/campaign/get/', { advertiser_id: '123', page_size: 10 });

    assert.match(capturedUrl, /^https:\/\/business-api\.tiktok\.com\/open_api\/v1\.3\/campaign\/get\/\?/);
    assert.match(capturedUrl, /advertiser_id=123/);
    assert.match(capturedUrl, /page_size=10/);
    assert.equal(capturedOptions.headers['Access-Token'], 'tiktok-token-123');
    assert.equal(capturedOptions.headers.Authorization, undefined);
  });

  test('JSON-encodes array and object params into the query string', async () => {
    let capturedUrl = null;

    global.fetch = async (url) => {
      capturedUrl = new URL(String(url));
      return jsonResponse(okEnvelope({ list: [] }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    await tiktokRequest('/campaign/get/', {
      advertiser_id: '123',
      fields: ['campaign_id', 'campaign_name'],
      filtering: { primary_status: 'STATUS_DELIVERY_OK' }
    });

    assert.equal(capturedUrl.searchParams.get('fields'), '["campaign_id","campaign_name"]');
    assert.equal(capturedUrl.searchParams.get('filtering'), '{"primary_status":"STATUS_DELIVERY_OK"}');
  });

  test('serializes POST bodies as JSON', async () => {
    let capturedOptions = null;

    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return jsonResponse(okEnvelope({ campaign_id: '1' }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    await tiktokRequest('/campaign/create/', {}, {
      method: 'POST',
      body: { advertiser_id: '123', campaign_name: 'Test' }
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.body, JSON.stringify({ advertiser_id: '123', campaign_name: 'Test' }));
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
  });

  test('treats non-zero envelope code as error even on HTTP 200', async () => {
    global.fetch = async () => jsonResponse({
      code: 40001,
      message: 'Invalid advertiser_id',
      request_id: 'req-err',
      data: {}
    });

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/', { advertiser_id: 'bad' }),
      /TikTok Ads API request failed \(200\): Invalid advertiser_id \(API error code 40001\)/
    );
  });

  test('retries once on envelope rate-limit code 40100', async () => {
    let calls = 0;
    let slept = false;

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse({ code: 40100, message: 'Too many requests', data: {} });
      }

      return jsonResponse(okEnvelope({ list: [{ campaign_id: '1' }] }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    const result = await tiktokRequest(
      '/campaign/get/',
      {},
      {
        sleep: async () => {
          slept = true;
        }
      }
    );

    assert.equal(calls, 2);
    assert.equal(slept, true);
    assert.equal(result.data.list.length, 1);
  });

  test('retries once on HTTP 429 with default sleep', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { code: 40100, message: 'Too many requests', data: {} },
          { ok: false, status: 429 }
        );
      }

      return jsonResponse(okEnvelope({ list: [{ campaign_id: '1' }] }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    const result = await tiktokRequest(
      '/campaign/get/',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [60_000]);
    assert.equal(result.data.list.length, 1);
  });

  test('does not retry twice when throttled repeatedly', async () => {
    let calls = 0;

    global.fetch = async () => {
      calls += 1;
      return jsonResponse({ code: 40100, message: 'Too many requests', data: {} });
    };

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/', {}, { sleep: async () => {} }),
      /Too many requests \(API error code 40100\)/
    );

    assert.equal(calls, 2);
  });

  test('uses Retry-After header value for throttled retries', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { code: 40100, message: 'Too many requests', data: {} },
          {
            ok: false,
            status: 429,
            headers: { 'Retry-After': '7' }
          }
        );
      }

      return jsonResponse(okEnvelope({ list: [{ campaign_id: '1' }] }));
    };

    const { tiktokRequest } = await importFresh('../server/http.js');
    const result = await tiktokRequest(
      '/campaign/get/',
      {},
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [7_000]);
    assert.equal(result.data.list.length, 1);
  });

  test('does not retry on 401 responses', async () => {
    let calls = 0;

    global.fetch = async () => {
      calls += 1;
      return jsonResponse(
        { code: 40105, message: 'Access token is invalid', data: {} },
        { ok: false, status: 401 }
      );
    };

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/'),
      /Access token is invalid/
    );

    assert.equal(calls, 1);
  });

  test('aborts requests that exceed timeout', async () => {
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/', {}, { timeoutMs: 5 }),
      /timed out/i
    );
  });

  test('uses TIKTOK_ADS_REQUEST_TIMEOUT_MS when timeout option is omitted', async () => {
    process.env.TIKTOK_ADS_REQUEST_TIMEOUT_MS = '4';

    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/'),
      /timed out after 4ms/i
    );
  });

  test('falls back to default timeout for invalid env values', async () => {
    process.env.TIKTOK_ADS_REQUEST_TIMEOUT_MS = 'not-a-number';

    global.fetch = async () => jsonResponse(okEnvelope({ list: [] }));

    const { tiktokRequest } = await importFresh('../server/http.js');
    const result = await tiktokRequest('/campaign/get/');

    assert.equal(result.code, 0);
  });

  test('throws extracted API error message for HTTP-level failures', async () => {
    global.fetch = async () => jsonResponse(
      { code: 40002, message: 'Endpoint not found', data: {} },
      { ok: false, status: 404 }
    );

    const { tiktokRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => tiktokRequest('/campaign/get/'),
      /TikTok Ads API request failed \(404\): Endpoint not found/
    );
  });
});
