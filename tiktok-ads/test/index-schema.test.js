import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '../server/index.js');

describe('tool schema descriptions', () => {
  test('advertiser_id descriptions document the env default', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /defaults to TIKTOK_ADS_ADVERTISER_ID/);
  });

  test('query schema exposes campaigns, adgroups, and ads entities', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /enum: \['campaigns', 'adgroups', 'ads'\]/);
  });

  test('report schema exposes BASIC and AUDIENCE report types', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /enum: \['BASIC', 'AUDIENCE'\]/);
    assert.match(source, /AUCTION_ADVERTISER/);
    assert.match(source, /AUCTION_AD/);
  });

  test('mutate description warns about local-only dry run and permanent delete', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /no server-side validate-only mode/);
    assert.match(source, /DELETE is permanent/);
    assert.match(source, /DISABLE \(paused\)/);
  });

  test('read-only mode filters out the mutate tool', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /TIKTOK_ADS_READ_ONLY === 'true'/);
    assert.match(source, /ALL_TOOLS\.filter\(\(tool\) => tool\.name !== 'mutate'\)/);
  });

  test('response-format uses dynamic SDK import with try/catch fallback', () => {
    const responseFormatPath = join(__dirname, '../server/utils/response-format.js');
    const source = readFileSync(responseFormatPath, 'utf8');

    assert.match(source, /await import\('@modelcontextprotocol\/sdk\/types\.js'\)/);
    assert.match(source, /catch/);
  });
});
