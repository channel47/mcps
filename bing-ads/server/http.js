import { getAccessToken, refreshAccessToken } from './auth.js';

export const BING_BASE_URLS = {
  campaignManagement: 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13',
  reporting: 'https://reporting.api.bingads.microsoft.com/Reporting/v13',
  customerManagement: 'https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13'
};

function buildHeaders({ token, accountId, customerId, includeContextHeaders = true }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    DeveloperToken: process.env.BING_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json'
  };

  if (includeContextHeaders) {
    if (accountId) {
      headers.CustomerAccountId = String(accountId);
    }
    if (customerId) {
      headers.CustomerId = String(customerId);
    }
  }

  return headers;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
    return response.arrayBuffer();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorCode(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const firstBatchError = payload?.Errors?.[0] || payload?.OperationErrors?.[0];
  if (firstBatchError?.Code) {
    return Number(firstBatchError.Code);
  }

  return null;
}

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return String(payload || 'Unknown Bing Ads API error');
  }

  const firstBatchError = payload?.Errors?.[0] || payload?.OperationErrors?.[0];
  if (firstBatchError?.Message) {
    return firstBatchError.Message;
  }

  return payload?.error?.message || payload?.message || 'Unknown Bing Ads API error';
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function bingRequest(
  url,
  body,
  {
    method = 'POST',
    accountId,
    customerId,
    includeContextHeaders = true,
    retryUnauthorized = true,
    retryThrottled = true
  } = {}
) {
  const token = await getAccessToken();
  const headers = buildHeaders({
    token,
    accountId,
    customerId,
    includeContextHeaders
  });

  const requestOptions = {
    method,
    headers
  };

  if (body !== undefined && body !== null) {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, requestOptions);
  const payload = await parseResponse(response);

  if (response.ok) {
    return payload;
  }

  if (response.status === 401 && retryUnauthorized) {
    await refreshAccessToken();
    return bingRequest(url, body, {
      method,
      accountId,
      customerId,
      includeContextHeaders,
      retryUnauthorized: false,
      retryThrottled
    });
  }

  const errorCode = extractErrorCode(payload);
  if (errorCode === 117 && retryThrottled) {
    await sleep(60_000);
    return bingRequest(url, body, {
      method,
      accountId,
      customerId,
      includeContextHeaders,
      retryUnauthorized,
      retryThrottled: false
    });
  }

  const errorMessage = extractErrorMessage(payload);
  throw new Error(`Bing Ads API request failed (${response.status}): ${errorMessage}`);
}

