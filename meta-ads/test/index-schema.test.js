import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '../server/index.js');

describe('tool schema descriptions', () => {
  test('account_id descriptions mention META_ADS_ACCOUNT_ID fallback', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(
      source,
      /Required if META_ADS_ACCOUNT_ID env var is not set/
    );
  });

  test('response-format uses static SDK import', () => {
    const responseFormatPath = join(__dirname, '../server/utils/response-format.js');
    const source = readFileSync(responseFormatPath, 'utf8');

    assert.doesNotMatch(source, /await import\('@modelcontextprotocol\/sdk\/types\.js'\)/);
    assert.match(source, /from '@modelcontextprotocol\/sdk\/types\.js'/);
  });
});
