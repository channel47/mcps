import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '../server/index.js');

describe('tool schema descriptions', () => {
  test('account_id descriptions document format support', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(
      source,
      /Supports either 123\.\.\. or act_123/
    );
  });

  test('response-format uses dynamic SDK import with try/catch fallback', () => {
    const responseFormatPath = join(__dirname, '../server/utils/response-format.js');
    const source = readFileSync(responseFormatPath, 'utf8');

    assert.match(source, /await import\('@modelcontextprotocol\/sdk\/types\.js'\)/);
    assert.match(source, /catch/);
  });

  test('query schema includes inline insights fields support', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /inline_insights_fields/);
  });

  test('mutate description includes creative and archive support', () => {
    const source = readFileSync(indexPath, 'utf8');

    assert.match(source, /archive/);
    assert.match(source, /creative entities/);
  });
});
