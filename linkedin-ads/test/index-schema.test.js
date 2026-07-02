import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '../server/index.js');

describe('tool schema descriptions', () => {
  test('account_id descriptions document URN format support', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /Supports either 123\.\.\. or urn:li:sponsoredAccount:123/);
  });

  test('analytics description documents the 20-metric limit and missing pagination', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /20 metric fields/);
    assert.match(source, /No pagination/);
  });

  test('mutate description documents DRAFT create default and dry-run preview behavior', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /DRAFT status/);
    assert.match(source, /no server-side validate-only mode/);
    assert.match(source, /PARTIAL_UPDATE/);
  });

  test('read-only gate uses LINKEDIN_ADS_READ_ONLY', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /LINKEDIN_ADS_READ_ONLY === 'true'/);
    assert.match(source, /filter\(\(tool\) => tool\.name !== 'mutate'\)/);
  });

  test('response-format uses dynamic SDK import with try/catch fallback', () => {
    const responseFormatPath = join(__dirname, '../server/utils/response-format.js');
    const source = readFileSync(responseFormatPath, 'utf8');

    assert.match(source, /await import\('@modelcontextprotocol\/sdk\/types\.js'\)/);
    assert.match(source, /catch/);
  });
});
