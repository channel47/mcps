import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSingleFileZip, SAMPLE_REPORT_CSV } from './fixtures.js';

const ORIGINAL_ENV = { ...process.env };

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

  test('returns empty data when report has no results', async () => {
    const { report } = await import('../server/tools/report.js');

    const result = await report(
      { report_type: 'campaign' },
      {
        request: async (url) => {
          if (url.endsWith('/GenerateReport/Submit')) {
            return { ReportRequestId: 'request-empty' };
          }
          return {
            ReportRequestStatus: {
              Status: 'Success',
              ReportDownloadUrl: null
            }
          };
        },
        sleepFn: async () => {}
      }
    );

    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data, []);
    assert.equal(payload.metadata.rowCount, 0);
    assert.match(payload.summary, /no data/);
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
