import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSingleFileZip, SAMPLE_REPORT_CSV } from './fixtures.js';

describe('parseCsv', () => {
  test('parses rows into objects', async () => {
    const { parseCsv } = await import('../server/utils/csv-parser.js');
    const rows = parseCsv(SAMPLE_REPORT_CSV);

    assert.equal(rows.length, 2);
    assert.equal(rows[0].CampaignName, 'Search - Brand');
    assert.equal(rows[1].CampaignId, '444444444');
  });

  test('handles quoted commas and escaped quotes', async () => {
    const { parseCsv } = await import('../server/utils/csv-parser.js');
    const csv = 'Name,Comment\n"ACME, Inc.","He said ""hello"""';
    const rows = parseCsv(csv);

    assert.equal(rows[0].Name, 'ACME, Inc.');
    assert.equal(rows[0].Comment, 'He said "hello"');
  });

  test('applies result limits', async () => {
    const { parseCsv } = await import('../server/utils/csv-parser.js');
    const rows = parseCsv(SAMPLE_REPORT_CSV, { limit: 1 });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].CampaignName, 'Search - Brand');
  });

  test('supports short-circuit parsing with maxRows', async () => {
    const { parseCsvRows } = await import('../server/utils/csv-parser.js');
    const csv = [
      'CampaignName,Clicks',
      'Search - Brand,120',
      'Shopping,180',
      'Extra Campaign,33'
    ].join('\n');

    const rows = parseCsvRows(csv, { maxRows: 2 });

    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['CampaignName', 'Clicks']);
    assert.deepEqual(rows[1], ['Search - Brand', '120']);
  });
});

describe('extractCsvFromZip', () => {
  test('extracts csv text from single file zip', async () => {
    const { extractCsvFromZip } = await import('../server/utils/csv-parser.js');
    const zip = buildSingleFileZip('report.csv', SAMPLE_REPORT_CSV);
    const csv = extractCsvFromZip(zip);

    assert.ok(csv.includes('CampaignName'));
    assert.ok(csv.includes('Shopping (US)'));
  });
});
