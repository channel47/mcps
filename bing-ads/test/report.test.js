import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import { SAMPLE_REPORT_CSV } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

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

beforeEach(() => {
  process.env.BING_ADS_ACCOUNT_ID = '123123123';
  process.env.BING_ADS_CUSTOMER_ID = '456456456';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('report', () => {
  test('runs submit/poll/download flow and parses rows', async () => {
    const { report } = await import('../server/tools/report.js');
    const calls = [];

    const result = await report(
      { report_type: 'campaign', date_range: 'LastSevenDays', limit: 1 },
      {
        request: async (url, body, context) => {
          calls.push({ url, body, context });
          if (url.endsWith('/GenerateReport/Submit')) {
            return { ReportRequestId: 'request-1' };
          }
          return {
            ReportRequestStatus: {
              Status: 'Success',
              ReportDownloadUrl: 'https://download.example/report.zip'
            }
          };
        },
        downloadReport: async () => buildSingleFileZip('campaign.csv', SAMPLE_REPORT_CSV),
        sleepFn: async () => {}
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(
      calls[0].body.ReportRequest.Type,
      'CampaignPerformanceReportRequest'
    );
    assert.equal(payload.data.length, 1);
    assert.equal(payload.data[0].CampaignName, 'Search - Brand');
  });

  test('rejects invalid report_type', async () => {
    const { report } = await import('../server/tools/report.js');

    await assert.rejects(
      () => report({ report_type: 'not-real' }, { request: async () => ({}) }),
      /report_type/
    );
  });

  test('times out if poll does not reach success', async () => {
    const { report } = await import('../server/tools/report.js');

    await assert.rejects(
      () => report(
        { report_type: 'campaign' },
        {
          request: async (url) => {
            if (url.endsWith('/GenerateReport/Submit')) {
              return { ReportRequestId: 'request-2' };
            }
            return {
              ReportRequestStatus: {
                Status: 'InProgress'
              }
            };
          },
          sleepFn: async () => {},
          pollIntervalMs: 0,
          timeoutMs: 0
        }
      ),
      /timed out/
    );
  });
});
