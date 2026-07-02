import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '../server/index.js');

describe('tool schema descriptions', () => {
  test('mutate description documents archive-only semantics and dry_run default', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /NO delete/);
    assert.match(source, /archive/);
    assert.match(source, /dry_run defaults to true/);
  });

  test('analytics schema documents 90-day constraints and defaults', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /90 days back/);
    assert.match(source, /SPEND_IN_DOLLAR, IMPRESSION_2, CLICKTHROUGH_2, CTR_2, TOTAL_CONVERSIONS/);
  });

  test('query schema documents default entity status behavior', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /only ACTIVE and PAUSED entities by default/);
  });

  test('read-only gate filters mutate tool and blocks calls', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /PINTEREST_ADS_READ_ONLY === 'true'/);
    assert.match(source, /filter\(\(tool\) => tool\.name !== 'mutate'\)/);
    assert.match(source, /mutate is disabled in read-only mode/);
  });

  test('response-format uses dynamic SDK import with try/catch fallback', () => {
    const responseFormatPath = join(__dirname, '../server/utils/response-format.js');
    const source = readFileSync(responseFormatPath, 'utf8');

    assert.match(source, /await import\('@modelcontextprotocol\/sdk\/types\.js'\)/);
    assert.match(source, /catch/);
  });
});
