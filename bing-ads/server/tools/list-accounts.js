import { bingRequest, BING_BASE_URLS } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { getCustomerId } from '../utils/validation.js';

const ACCOUNTS_INFO_URL = `${BING_BASE_URLS.customerManagement}/AccountsInfo/Query`;

function mapAccount(account) {
  return {
    id: String(account?.Id ?? ''),
    name: account?.Name ?? '',
    number: account?.Number ?? '',
    status: account?.AccountLifeCycleStatus ?? '',
    pause_reason: account?.PauseReason ?? null
  };
}

export async function listAccounts(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;

  try {
    const customerId = getCustomerId(params);
    const body = {
      CustomerId: Number(customerId),
      OnlyParentAccounts: false
    };

    const response = await request(
      ACCOUNTS_INFO_URL,
      body,
      {
        customerId,
        includeContextHeaders: false
      }
    );

    const accounts = (response?.AccountsInfo || []).map(mapAccount);

    return formatSuccess({
      summary: `Found ${accounts.length} accessible Microsoft Advertising account${accounts.length === 1 ? '' : 's'}`,
      data: accounts,
      metadata: {
        customerId,
        totalAccounts: accounts.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}

