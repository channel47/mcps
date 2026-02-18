#!/usr/bin/env node
/**
 * Debug script — makes raw API calls to compare working vs failing endpoints.
 * Run: node test/debug-api.js
 */

import { getAccessToken } from '../server/auth.js';

const DEVELOPER_TOKEN = process.env.BING_ADS_DEVELOPER_TOKEN;
const ACCOUNT_ID = process.env.BING_ADS_ACCOUNT_ID;
const CUSTOMER_ID = process.env.BING_ADS_CUSTOMER_ID;

async function rawRequest(label, url, body, { includeContextHeaders = true } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    DeveloperToken: DEVELOPER_TOKEN,
    'Content-Type': 'application/json'
  };
  if (includeContextHeaders) {
    headers.CustomerAccountId = String(ACCOUNT_ID);
    headers.CustomerId = String(CUSTOMER_ID);
  }

  const serialized = JSON.stringify(body);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`URL: ${url}`);
  console.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
  console.log(`Body: ${serialized}`);
  console.log(`Body length: ${serialized.length}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: serialized
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    console.log(`\nStatus: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Response: ${text.substring(0, 2000)}`);
  } catch (err) {
    console.log(`\nFetch error: ${err.message}`);
  }
}

async function main() {
  console.log('Account ID:', ACCOUNT_ID);
  console.log('Customer ID:', CUSTOMER_ID);

  // TEST 1: list_accounts (WORKS)
  await rawRequest(
    'GetAccountsInfo (works)',
    'https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/AccountsInfo/Query',
    { CustomerId: Number(CUSTOMER_ID), OnlyParentAccounts: false },
    { includeContextHeaders: false }
  );

  // TEST 2: AddCampaigns dry-run style — just to confirm it works
  // (skip actual create to avoid creating another campaign)

  // TEST 3: GetCampaignsByAccountId (FAILS)
  await rawRequest(
    'GetCampaignsByAccountId (fails)',
    'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Campaigns/QueryByAccountId',
    {
      AccountId: Number(ACCOUNT_ID),
      CampaignType: 'Search Shopping DynamicSearchAds Audience PerformanceMax',
      ReturnAdditionalFields: 'BidStrategyId'
    }
  );

  // TEST 4: Same as 3 but with AccountId as string
  await rawRequest(
    'GetCampaignsByAccountId (AccountId as string)',
    'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Campaigns/QueryByAccountId',
    {
      AccountId: String(ACCOUNT_ID),
      CampaignType: 'Search',
      ReturnAdditionalFields: 'BidStrategyId'
    }
  );

  // TEST 5: Minimal body — just AccountId
  await rawRequest(
    'GetCampaignsByAccountId (minimal body)',
    'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Campaigns/QueryByAccountId',
    {
      AccountId: String(ACCOUNT_ID)
    }
  );

  // TEST 6: SubmitGenerateReport (FAILS)
  await rawRequest(
    'SubmitGenerateReport (fails)',
    'https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Submit',
    {
      ReportRequest: {
        Type: 'AccountPerformanceReportRequest',
        ReportName: 'debug test',
        Format: 'Csv',
        FormatVersion: '2.0',
        ExcludeColumnHeaders: false,
        ExcludeReportHeader: true,
        ExcludeReportFooter: true,
        ReturnOnlyCompleteData: false,
        Aggregation: 'Summary',
        Columns: ['AccountName', 'Impressions', 'Clicks', 'Spend'],
        Scope: { AccountIds: [String(ACCOUNT_ID)] },
        Time: { PredefinedTime: 'LastSevenDays' }
      }
    }
  );
}

main().catch(console.error);
