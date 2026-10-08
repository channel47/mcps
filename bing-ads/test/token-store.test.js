import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_CONSOLE_ERROR = console.error;

let tempDir;
let storePath;
let logged;

function importFresh(modulePath) {
  return import(`${modulePath}?v=${Date.now()}-${Math.random()}`);
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    async json() {
      return data;
    }
  };
}

function mockTokenEndpoint(responses) {
  const requestBodies = [];
  global.fetch = async (_url, options) => {
    requestBodies.push(String(options.body));
    return jsonResponse(responses[Math.min(requestBodies.length, responses.length) - 1]);
  };
  return requestBodies;
}

function readStore() {
  return JSON.parse(readFileSync(storePath, 'utf8'));
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'bing-ads-token-store-'));
  storePath = join(tempDir, 'bing-ads-token.json');

  process.env.BING_ADS_CLIENT_ID = 'client-id';
  process.env.BING_ADS_DEVELOPER_TOKEN = 'dev-token';
  process.env.BING_ADS_TOKEN_STORE = storePath;
  delete process.env.BING_ADS_REFRESH_TOKEN;
  delete process.env.BING_ADS_CLIENT_SECRET;

  logged = [];
  console.error = (...args) => logged.push(args.join(' '));
});

afterEach(() => {
  console.error = ORIGINAL_CONSOLE_ERROR;
  process.env = { ...ORIGINAL_ENV };
  delete global.fetch;
  chmodSync(tempDir, 0o700);
  rmSync(tempDir, { recursive: true, force: true });
});

describe('BING_ADS_TOKEN_STORE', () => {
  test('reads the refresh token from the store when BING_ADS_REFRESH_TOKEN is unset', async () => {
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token' }));
    const requestBodies = mockTokenEndpoint([{ access_token: 'access-1', expires_in: 3600 }]);

    const { getAccessToken, validateEnvironment } = await importFresh('../server/auth.js');

    assert.deepEqual(validateEnvironment(), { valid: true, missing: [] });
    assert.equal(await getAccessToken(), 'access-1');
    assert.match(requestBodies[0], /refresh_token=stored-token/);
  });

  test('BING_ADS_REFRESH_TOKEN takes precedence over the store', async () => {
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token' }));
    process.env.BING_ADS_REFRESH_TOKEN = 'env-token';
    const requestBodies = mockTokenEndpoint([{ access_token: 'access-1', expires_in: 3600 }]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    assert.match(requestBodies[0], /refresh_token=env-token/);
  });

  test('reports the refresh token as missing when neither env nor store has one', async () => {
    const { validateEnvironment } = await importFresh('../server/auth.js');

    assert.deepEqual(validateEnvironment(), { valid: false, missing: ['BING_ADS_REFRESH_TOKEN'] });
  });

  test('writes a rotated token atomically with mode 0600 and keeps other fields', async () => {
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token', note: 'keep me' }), { mode: 0o644 });
    const requestBodies = mockTokenEndpoint([
      { access_token: 'access-1', expires_in: 0, refresh_token: 'rotated-token' },
      { access_token: 'access-2', expires_in: 3600 }
    ]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    const store = readStore();
    assert.equal(store.refresh_token, 'rotated-token');
    assert.equal(store.source, 'bing-ads-mcp');
    assert.equal(store.note, 'keep me');
    assert.ok(!Number.isNaN(Date.parse(store.updated_at)));
    assert.equal(statSync(storePath).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(tempDir), ['bing-ads-token.json']);

    await getAccessToken();
    assert.match(requestBodies[1], /refresh_token=rotated-token/);

    // A fresh process picks up the rotated token from the store.
    const requestBodiesAfterRestart = mockTokenEndpoint([{ access_token: 'access-3', expires_in: 3600 }]);
    const restarted = await importFresh('../server/auth.js');
    await restarted.getAccessToken();
    assert.match(requestBodiesAfterRestart[0], /refresh_token=rotated-token/);
  });

  test('creates the store file when it does not exist yet', async () => {
    process.env.BING_ADS_REFRESH_TOKEN = 'env-token';
    mockTokenEndpoint([{ access_token: 'access-1', expires_in: 3600, refresh_token: 'rotated-token' }]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    assert.equal(readStore().refresh_token, 'rotated-token');
    assert.equal(statSync(storePath).mode & 0o777, 0o600);
  });

  test('does not write the store when the token is not rotated', async () => {
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token', updated_at: 'original' }));
    mockTokenEndpoint([{ access_token: 'access-1', expires_in: 3600, refresh_token: 'stored-token' }]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    assert.equal(readStore().updated_at, 'original');
  });

  test('keeps the rotated token in memory when the store cannot be written', async () => {
    const readOnlyDir = join(tempDir, 'read-only');
    mkdirSync(readOnlyDir);
    storePath = join(readOnlyDir, 'bing-ads-token.json');
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token' }));
    chmodSync(readOnlyDir, 0o500);
    process.env.BING_ADS_TOKEN_STORE = storePath;

    const requestBodies = mockTokenEndpoint([
      { access_token: 'access-1', expires_in: 0, refresh_token: 'rotated-token' },
      { access_token: 'access-2', expires_in: 3600 }
    ]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    assert.equal(await getAccessToken(), 'access-1');
    await getAccessToken();

    assert.match(requestBodies[1], /refresh_token=rotated-token/);
    assert.equal(readStore().refresh_token, 'stored-token');
    assert.ok(logged.some((line) => line.includes('Failed to write BING_ADS_TOKEN_STORE')));
    chmodSync(readOnlyDir, 0o700);
  });

  test('ignores an invalid store file without logging its contents', async () => {
    writeFileSync(storePath, '{"refresh_token": "secret-partial');

    const { validateEnvironment } = await importFresh('../server/auth.js');

    assert.equal(validateEnvironment().valid, false);
    assert.ok(logged.some((line) => line.includes('invalid JSON')));
    assert.ok(logged.every((line) => !line.includes('secret-partial')));
  });

  test('never logs token values', async () => {
    writeFileSync(storePath, JSON.stringify({ refresh_token: 'stored-token' }));
    mockTokenEndpoint([{ access_token: 'access-1', expires_in: 3600, refresh_token: 'rotated-token' }]);

    const { getAccessToken } = await importFresh('../server/auth.js');
    await getAccessToken();

    assert.ok(logged.length > 0);
    for (const line of logged) {
      assert.doesNotMatch(line, /stored-token|rotated-token|access-1/);
    }
  });
});
