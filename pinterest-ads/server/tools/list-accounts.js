import { pinterestRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';

const PAGE_SIZE = 250;

function mapAccount(account) {
  return {
    id: account?.id || '',
    name: account?.name || '',
    currency: account?.currency || null,
    country: account?.country || null,
    owner_username: account?.owner?.username || null,
    time_zone: account?.time_zone || null,
    permissions: Array.isArray(account?.permissions) ? account.permissions : []
  };
}

async function fetchAllPages(request, path, initialParams = {}) {
  const rows = [];
  let bookmark = null;

  while (true) {
    const pageParams = { ...initialParams };
    if (bookmark) {
      pageParams.bookmark = bookmark;
    }

    const response = await request(path, pageParams);
    const items = Array.isArray(response?.items) ? response.items : [];
    rows.push(...items);

    bookmark = response?.bookmark || null;
    if (!bookmark) {
      break;
    }
  }

  return rows;
}

/**
 * List all accessible Pinterest ad accounts for the authenticated token.
 * @param {{ include_shared_accounts?: boolean }} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function listAccounts(params = {}, dependencies = {}) {
  const request = dependencies.request || pinterestRequest;

  try {
    const queryParams = { page_size: String(PAGE_SIZE) };
    if (params.include_shared_accounts !== undefined) {
      queryParams.include_shared_accounts = String(Boolean(params.include_shared_accounts));
    }

    const allAccounts = (await fetchAllPages(request, '/ad_accounts', queryParams)).map(mapAccount);

    return formatSuccess({
      summary: `Found ${allAccounts.length} accessible Pinterest ad account${allAccounts.length === 1 ? '' : 's'}`,
      data: allAccounts,
      metadata: {
        totalAccounts: allAccounts.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
