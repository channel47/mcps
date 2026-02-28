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
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'content-type') {
          return init.contentType ?? 'application/json';
        }
        return null;
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
  test('builds Graph API URL with query params and access token', async () => {
    let capturedUrl = null;

    global.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ data: [] });
    };

    const { metaRequest } = await importFresh('../server/http.js');
    await metaRequest('/me/adaccounts', { fields: 'id,name', limit: 10 });

    assert.match(capturedUrl, /^https:\/\/graph\.facebook\.com\/v25\.0\/me\/adaccounts\?/);
    assert.match(capturedUrl, /fields=id%2Cname/);
    assert.match(capturedUrl, /limit=10/);
    assert.match(capturedUrl, /access_token=meta-token-123/);
  });

  test('retries once on 401 and succeeds on second attempt', async () => {
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
    const result = await metaRequest('/me/adaccounts');

    assert.equal(calls, 2);
    assert.equal(result.data.length, 1);
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
    let slept = false;

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
        sleep: async () => {
          slept = true;
        }
      }
    );

    assert.equal(calls, 2);
    assert.equal(slept, true);
    assert.equal(result.data.length, 1);
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

  test('throws after repeated 401 failures (single retry only)', async () => {
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

    assert.equal(calls, 2);
  });
});
