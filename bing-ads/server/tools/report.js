import { BING_BASE_URLS, bingRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import {
  getAccountId,
  getCustomerId,
  validateDateRange,
  validateEnum,
  validateRequired
} from '../utils/validation.js';
import { extractCsvFromZip, parseCsv } from '../utils/csv-parser.js';

const SUBMIT_REPORT_URL = `${BING_BASE_URLS.reporting}/GenerateReport/Submit`;
const POLL_REPORT_URL = `${BING_BASE_URLS.reporting}/GenerateReport/Poll`;

const REPORT_TYPE_MAP = {
  campaign: 'CampaignPerformanceReportRequest',
  ad_group: 'AdGroupPerformanceReportRequest',
  keyword: 'KeywordPerformanceReportRequest',
  ad: 'AdPerformanceReportRequest',
  search_query: 'SearchQueryPerformanceReportRequest',
  account: 'AccountPerformanceReportRequest',
  asset_group: 'AssetGroupPerformanceReportRequest'
};

const AGGREGATION_OPTIONS = ['Summary', 'Daily', 'Weekly', 'Monthly', 'Hourly'];

const DEFAULT_COLUMNS = {
  campaign: [
    'AccountName',
    'CampaignName',
    'CampaignId',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'Conversions',
    'Revenue'
  ],
  ad_group: [
    'CampaignName',
    'AdGroupName',
    'AdGroupId',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'Conversions'
  ],
  keyword: [
    'CampaignName',
    'AdGroupName',
    'Keyword',
    'KeywordId',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'QualityScore'
  ],
  ad: [
    'CampaignName',
    'AdGroupName',
    'AdTitle',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'Conversions'
  ],
  search_query: [
    'CampaignName',
    'AdGroupName',
    'SearchQuery',
    'Keyword',
    'Impressions',
    'Clicks',
    'Spend'
  ],
  account: [
    'AccountName',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'Conversions',
    'Revenue'
  ],
  asset_group: [
    'CampaignName',
    'AssetGroupName',
    'Impressions',
    'Clicks',
    'Ctr',
    'AverageCpc',
    'Spend',
    'Conversions'
  ]
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildReportRequest(params, accountId) {
  validateRequired(params, ['report_type']);
  validateEnum(params.report_type, Object.keys(REPORT_TYPE_MAP), 'report_type');

  const dateRange = validateDateRange(params.date_range || 'LastSevenDays');
  const aggregation = params.aggregation || 'Daily';
  validateEnum(aggregation, AGGREGATION_OPTIONS, 'aggregation');

  const columns = Array.isArray(params.columns) && params.columns.length > 0
    ? params.columns
    : DEFAULT_COLUMNS[params.report_type];

  return {
    ReportRequest: {
      Type: REPORT_TYPE_MAP[params.report_type],
      ReportName: `${params.report_type} performance report`,
      Format: 'Csv',
      FormatVersion: '2.0',
      ExcludeColumnHeaders: false,
      ExcludeReportHeader: true,
      ExcludeReportFooter: true,
      ReturnOnlyCompleteData: false,
      Aggregation: aggregation,
      Columns: columns,
      Scope: {
        AccountIds: [String(accountId)]
      },
      Time: {
        PredefinedTime: dateRange
      }
    }
  };
}

async function pollForCompletion(
  request,
  reportRequestId,
  context,
  {
    sleepFn,
    pollIntervalMs,
    timeoutMs
  }
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const pollResult = await request(
      POLL_REPORT_URL,
      { ReportRequestId: reportRequestId },
      context
    );

    const status = pollResult?.ReportRequestStatus?.Status;
    if (status === 'Success') {
      const downloadUrl = pollResult?.ReportRequestStatus?.ReportDownloadUrl;
      if (!downloadUrl) {
        throw new Error(`Report ${reportRequestId} completed without ReportDownloadUrl`);
      }
      return downloadUrl;
    }

    if (status === 'Error') {
      throw new Error(`Report generation failed for request ${reportRequestId}`);
    }

    if (status !== 'Pending' && status !== 'InProgress') {
      throw new Error(`Unexpected report status for request ${reportRequestId}: ${status}`);
    }

    await sleepFn(pollIntervalMs);
  }

  throw new Error(`Report generation timed out for request ${reportRequestId}`);
}

async function defaultDownloadReport(downloadUrl) {
  const response = await fetch(downloadUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Report download failed (${response.status})`);
  }

  const data = await response.arrayBuffer();
  return Buffer.from(data);
}

export async function report(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;
  const downloadReport = dependencies.downloadReport || defaultDownloadReport;
  const sleepFn = dependencies.sleepFn || sleep;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 5000;
  const timeoutMs = dependencies.timeoutMs ?? 120000;

  try {
    const accountId = getAccountId(params);
    const customerId = getCustomerId(params);
    const reportRequest = buildReportRequest(params, accountId);
    const context = { accountId, customerId };

    const submitResult = await request(SUBMIT_REPORT_URL, reportRequest, context);
    const reportRequestId = submitResult?.ReportRequestId;
    if (!reportRequestId) {
      throw new Error('Report submit response missing ReportRequestId');
    }

    const downloadUrl = await pollForCompletion(
      request,
      reportRequestId,
      context,
      { sleepFn, pollIntervalMs, timeoutMs }
    );

    const zipBuffer = await downloadReport(downloadUrl);
    const csv = extractCsvFromZip(zipBuffer);
    const limit = typeof params.limit === 'number' ? params.limit : 100;
    const rows = parseCsv(csv, { limit });

    return formatSuccess({
      summary: `Generated ${params.report_type} report with ${rows.length} rows`,
      data: rows,
      metadata: {
        reportType: params.report_type,
        reportRequestId,
        accountId,
        customerId,
        rowCount: rows.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
