import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  process.env.META_ADS_ACCESS_TOKEN = 'meta-token-1';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('validateEnvironment', () => {
  test('passes when META_ADS_ACCESS_TOKEN exists', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  test('fails when META_ADS_ACCESS_TOKEN is missing', async () => {
    delete process.env.META_ADS_ACCESS_TOKEN;

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['META_ADS_ACCESS_TOKEN']);
  });
});

describe('getAccessToken', () => {
  test('returns token from environment', async () => {
    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken();

    assert.equal(token, 'meta-token-1');
  });

  test('returns cached token until cache is cleared', async () => {
    const { getAccessToken, clearAuthCacheForTests } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    process.env.META_ADS_ACCESS_TOKEN = 'meta-token-2';
    const second = await getAccessToken();

    clearAuthCacheForTests();
    const third = await getAccessToken();

    assert.equal(first, 'meta-token-1');
    assert.equal(second, 'meta-token-1');
    assert.equal(third, 'meta-token-2');
  });

  test('throws when token is missing', async () => {
    delete process.env.META_ADS_ACCESS_TOKEN;

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /META_ADS_ACCESS_TOKEN/
    );
  });
});
