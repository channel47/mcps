import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rawParam } from '../server/utils/restli.js';

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
        if (normalized === 'content-type' && customHeaders[normalized] === undefined) {
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
  delete process.env.LINKEDIN_ADS_CLIENT_ID;
  delete process.env.LINKEDIN_ADS_CLIENT_SECRET;
  delete process.env.LINKEDIN_ADS_REFRESH_TOKEN;
  delete process.env.LINKEDIN_ADS_API_VERSION;
  process.env.LINKEDIN_ADS_ACCESS_TOKEN = 'linkedin-token-123';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
});

describe('linkedinRequest', () => {
  test('builds versioned REST URL with Rest.li query encoding and required headers', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return jsonResponse({ elements: [] });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');

    await linkedinRequest('/adAnalytics', {
      q: 'analytics',
      dateRange: rawParam('(start:(year:2026,month:6,day:1))'),
      campaigns: ['urn:li:sponsoredCampaign:123']
    });

    assert.match(capturedUrl, /^https:\/\/api\.linkedin\.com\/rest\/adAnalytics\?/);
    assert.match(capturedUrl, /q=analytics/);
    // Structured params keep literal parens/colons/commas
    assert.ok(capturedUrl.includes('dateRange=(start:(year:2026,month:6,day:1))'));
    assert.ok(capturedUrl.includes('campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123)'));

    assert.equal(capturedOptions.headers.Authorization, 'Bearer linkedin-token-123');
    assert.equal(capturedOptions.headers['LinkedIn-Version'], '202605');
    assert.equal(capturedOptions.headers['X-Restli-Protocol-Version'], '2.0.0');
  });

  test('honors LINKEDIN_ADS_API_VERSION override', async () => {
    process.env.LINKEDIN_ADS_API_VERSION = '202609';

    let capturedOptions = null;
    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return jsonResponse({ elements: [] });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');
    await linkedinRequest('/adAccounts', { q: 'search' });

    assert.equal(capturedOptions.headers['LinkedIn-Version'], '202609');
  });

  test('falls back to default version for malformed overrides', async () => {
    process.env.LINKEDIN_ADS_API_VERSION = 'not-a-version';

    const { getApiVersion, DEFAULT_API_VERSION } = await importFresh('../server/http.js');
    assert.equal(getApiVersion(), DEFAULT_API_VERSION);
  });

  test('merges custom headers such as X-RestLi-Method', async () => {
    let capturedOptions = null;
    global.fetch = async (_url, options) => {
      capturedOptions = options;
      return jsonResponse({}, { status: 204 });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');
    await linkedinRequest('/adAccounts/1/adCampaigns/2', {}, {
      method: 'POST',
      headers: { 'X-RestLi-Method': 'PARTIAL_UPDATE' },
      body: { patch: { $set: { status: 'PAUSED' } } }
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['X-RestLi-Method'], 'PARTIAL_UPDATE');
    assert.equal(capturedOptions.body, JSON.stringify({ patch: { $set: { status: 'PAUSED' } } }));
  });

  test('surfaces x-restli-id header on created entities', async () => {
    global.fetch = async () => jsonResponse('', {
      status: 201,
      contentType: 'text/plain',
      headers: { 'x-restli-id': '123456789' }
    });

    const { linkedinRequest } = await importFresh('../server/http.js');
    const result = await linkedinRequest('/adAccounts/1/adCampaigns', {}, {
      method: 'POST',
      body: { name: 'Campaign A' }
    });

    assert.equal(result.restliId, '123456789');
  });

  test('returns empty object for 204 responses', async () => {
    global.fetch = async () => jsonResponse(null, { status: 204 });

    const { linkedinRequest } = await importFresh('../server/http.js');
    const result = await linkedinRequest('/adAccounts/1/adCampaigns/2', {}, { method: 'POST', body: {} });

    assert.deepEqual(result, {});
  });

  test('does not retry on 401 responses', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return jsonResponse(
        { message: 'Invalid access token', serviceErrorCode: 65600, status: 401 },
        { ok: false, status: 401 }
      );
    };

    const { linkedinRequest } = await importFresh('../server/http.js');
    await assert.rejects(
      () => linkedinRequest('/adAccounts', { q: 'search' }),
      /LinkedIn Ads API request failed \(401\): Invalid access token/
    );

    assert.equal(calls, 1);
  });

  test('retries once on HTTP 429 with default sleep', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { message: 'Resource level throttle limit exceeded', status: 429 },
          { ok: false, status: 429 }
        );
      }

      return jsonResponse({ elements: [{ id: 1 }] });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');
    const result = await linkedinRequest(
      '/adAccounts',
      { q: 'search' },
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [60_000]);
    assert.equal(result.elements.length, 1);
  });

  test('uses Retry-After header value for throttled retries', async () => {
    let calls = 0;
    const sleepCalls = [];

    global.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return jsonResponse(
          { message: 'Throttled' },
          {
            ok: false,
            status: 429,
            headers: { 'Retry-After': '7' }
          }
        );
      }

      return jsonResponse({ elements: [{ id: 1 }] });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');
    const result = await linkedinRequest(
      '/adAccounts',
      { q: 'search' },
      {
        sleep: async (ms) => {
          sleepCalls.push(ms);
        }
      }
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [7_000]);
    assert.equal(result.elements.length, 1);
  });

  test('gives up after a second 429', async () => {
    let calls = 0;

    global.fetch = async () => {
      calls += 1;
      return jsonResponse({ message: 'Throttled' }, { ok: false, status: 429 });
    };

    const { linkedinRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => linkedinRequest('/adAccounts', { q: 'search' }, { sleep: async () => {} }),
      /LinkedIn Ads API request failed \(429\): Throttled/
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

    const { linkedinRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => linkedinRequest('/adAccounts', {}, { timeoutMs: 5 }),
      /timed out/i
    );
  });

  test('uses LINKEDIN_ADS_REQUEST_TIMEOUT_MS when timeout option is omitted', async () => {
    process.env.LINKEDIN_ADS_REQUEST_TIMEOUT_MS = '4';

    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const { linkedinRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => linkedinRequest('/adAccounts'),
      /timed out after 4ms/i
    );
  });

  test('throws extracted API error message on non-throttle failures', async () => {
    global.fetch = async () => jsonResponse(
      { message: 'Field value is required', serviceErrorCode: 100, status: 400 },
      { ok: false, status: 400 }
    );

    const { linkedinRequest } = await importFresh('../server/http.js');

    await assert.rejects(
      () => linkedinRequest('/adAccounts/1/adCampaigns', {}, { method: 'POST', body: {} }),
      /LinkedIn Ads API request failed \(400\): Field value is required/
    );
  });
});
