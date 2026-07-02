import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_ENV = { ...process.env };

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  process.env.TIKTOK_ADS_ACCESS_TOKEN = 'tiktok-token-1';
  delete process.env.TIKTOK_ADS_APP_ID;
  delete process.env.TIKTOK_ADS_APP_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('validateEnvironment', () => {
  test('passes when TIKTOK_ADS_ACCESS_TOKEN exists', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });

  test('fails when TIKTOK_ADS_ACCESS_TOKEN is missing', async () => {
    delete process.env.TIKTOK_ADS_ACCESS_TOKEN;

    const { validateEnvironment } = await importFresh('../server/auth.js');
    const result = validateEnvironment();

    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['TIKTOK_ADS_ACCESS_TOKEN']);
  });
});

describe('getAccessToken', () => {
  test('returns token from environment', async () => {
    const { getAccessToken } = await importFresh('../server/auth.js');
    const token = await getAccessToken();

    assert.equal(token, 'tiktok-token-1');
  });

  test('returns cached token until cache is cleared', async () => {
    const { getAccessToken, clearAuthCache } = await importFresh('../server/auth.js');

    const first = await getAccessToken();
    process.env.TIKTOK_ADS_ACCESS_TOKEN = 'tiktok-token-2';
    const second = await getAccessToken();

    clearAuthCache();
    const third = await getAccessToken();

    assert.equal(first, 'tiktok-token-1');
    assert.equal(second, 'tiktok-token-1');
    assert.equal(third, 'tiktok-token-2');
  });

  test('throws when token is missing', async () => {
    delete process.env.TIKTOK_ADS_ACCESS_TOKEN;

    const { getAccessToken } = await importFresh('../server/auth.js');

    await assert.rejects(
      () => getAccessToken(),
      /TIKTOK_ADS_ACCESS_TOKEN/
    );
  });
});

describe('getAppCredentials', () => {
  test('returns null when app credentials are not configured', async () => {
    const { getAppCredentials } = await importFresh('../server/auth.js');
    assert.equal(getAppCredentials(), null);
  });

  test('returns null when only app id is configured', async () => {
    process.env.TIKTOK_ADS_APP_ID = 'app-1';

    const { getAppCredentials } = await importFresh('../server/auth.js');
    assert.equal(getAppCredentials(), null);
  });

  test('returns credentials when both app id and secret are configured', async () => {
    process.env.TIKTOK_ADS_APP_ID = 'app-1';
    process.env.TIKTOK_ADS_APP_SECRET = 'secret-1';

    const { getAppCredentials } = await importFresh('../server/auth.js');
    assert.deepEqual(getAppCredentials(), { appId: 'app-1', appSecret: 'secret-1' });
  });
});
