import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import { SAMPLE_REPORT_CSV } from './fixtures.js';

function buildSingleFileZip(filename, text) {
  const filenameBuffer = Buffer.from(filename, 'utf8');
  const uncompressed = Buffer.from(text, 'utf8');
  const compressed = deflateRawSync(uncompressed);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(uncompressed.length, 22);
  localHeader.writeUInt16LE(filenameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(8, 10);
  centralDirectory.writeUInt16LE(0, 12);
  centralDirectory.writeUInt16LE(0, 14);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(compressed.length, 20);
  centralDirectory.writeUInt32LE(uncompressed.length, 24);
  centralDirectory.writeUInt16LE(filenameBuffer.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);

  const centralDirectoryOffset = localHeader.length + filenameBuffer.length + compressed.length;
  const centralDirectorySize = centralDirectory.length + filenameBuffer.length;

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    localHeader,
    filenameBuffer,
    compressed,
    centralDirectory,
    filenameBuffer,
    endOfCentralDirectory
  ]);
}

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
