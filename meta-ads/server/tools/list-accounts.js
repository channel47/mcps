import { metaRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { normalizeAccountId } from '../utils/validation.js';

const ACCOUNT_STATUS_MAP = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_REVIEW',
  8: 'PENDING_CLOSURE',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_RISK_REVIEW'
};

function normalizeStatus(code) {
  return ACCOUNT_STATUS_MAP[Number(code)] || 'UNKNOWN';
}

function mapAccount(account) {
  return {
    id: normalizeAccountId(account?.id),
    name: account?.name || '',
    account_status: Number(account?.account_status || 0),
    status: normalizeStatus(account?.account_status),
    currency: account?.currency || null,
    timezone_name: account?.timezone_name || null,
    business_name: account?.business?.name || null
  };
}

async function fetchAllPages(request, path, initialParams = {}) {
  const rows = [];
  let after = null;

  while (true) {
    const pageParams = { ...initialParams };
    if (after) {
      pageParams.after = after;
    }

    const response = await request(path, pageParams);
    const data = Array.isArray(response?.data) ? response.data : [];
    rows.push(...data);

    after = response?.paging?.cursors?.after;
    if (!after) {
      break;
    }
  }

  return rows;
}

/**
 * List all accessible ad accounts for the authenticated user token.
 * @param {{ status?: string }} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function listAccounts(params = {}, dependencies = {}) {
  const request = dependencies.request || metaRequest;

  try {
    const allPages = await fetchAllPages(request, '/me/adaccounts', {
      fields: 'id,name,account_status,currency,timezone_name,business{name}'
    });
    const allAccounts = allPages.map(mapAccount);
    const statusFilter = params.status ? String(params.status).toUpperCase() : null;

    const filteredAccounts = statusFilter
      ? allAccounts.filter((account) => account.status === statusFilter)
      : allAccounts;

    return formatSuccess({
      summary: `Found ${filteredAccounts.length} accessible Meta ad account${filteredAccounts.length === 1 ? '' : 's'}`,
      data: filteredAccounts,
      metadata: {
        totalAccounts: filteredAccounts.length,
        appliedStatusFilter: statusFilter
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
