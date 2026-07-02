import { linkedinRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { rawParam, restliSearchFilter } from '../utils/restli.js';
import { validateEnum } from '../utils/validation.js';

const ACCOUNT_STATUSES = ['ACTIVE', 'CANCELED', 'DRAFT', 'PENDING_DELETION', 'REMOVED'];
const ACCOUNT_TYPES = ['BUSINESS', 'ENTERPRISE'];
const MAX_PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 1000;

function normalizeFilterValues(value, allowed, paramName) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const values = (Array.isArray(value) ? value : String(value).split(','))
    .map((entry) => String(entry).trim().toUpperCase())
    .filter(Boolean);

  for (const entry of values) {
    validateEnum(entry, allowed, paramName);
  }

  return values;
}

function getRequestedLimit(limitValue) {
  const parsed = Number(limitValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.floor(parsed);
}

function mapAccount(account) {
  return {
    id: account?.id ?? null,
    name: account?.name || '',
    status: account?.status || 'UNKNOWN',
    currency: account?.currency || null,
    type: account?.type || null,
    test: Boolean(account?.test),
    reference: account?.reference || null,
    serving_statuses: Array.isArray(account?.servingStatuses) ? account.servingStatuses : []
  };
}

async function fetchAllPages(request, path, baseParams, requestedLimit) {
  const rows = [];
  let pageToken = null;

  while (rows.length < requestedLimit) {
    const pageParams = {
      ...baseParams,
      pageSize: Math.min(requestedLimit - rows.length, MAX_PAGE_SIZE)
    };

    if (pageToken) {
      pageParams.pageToken = pageToken;
    }

    const response = await request(path, pageParams);
    const elements = Array.isArray(response?.elements) ? response.elements : [];
    rows.push(...elements);

    pageToken = response?.metadata?.nextPageToken;
    if (!pageToken || elements.length === 0) {
      break;
    }
  }

  return rows.slice(0, requestedLimit);
}

/**
 * List accessible LinkedIn ad accounts via the adAccounts search finder with
 * cursor (pageToken/pageSize) pagination.
 * @param {{ status?: string | string[], type?: string | string[], limit?: number }} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function listAccounts(params = {}, dependencies = {}) {
  const request = dependencies.request || linkedinRequest;

  try {
    const statusValues = normalizeFilterValues(params.status, ACCOUNT_STATUSES, 'status');
    const typeValues = normalizeFilterValues(params.type, ACCOUNT_TYPES, 'type');
    const requestedLimit = getRequestedLimit(params.limit);

    const queryParams = {
      q: 'search'
    };

    const searchFilter = restliSearchFilter({
      status: statusValues,
      type: typeValues
    });
    if (searchFilter) {
      queryParams.search = rawParam(searchFilter);
    }

    const accounts = (await fetchAllPages(request, '/adAccounts', queryParams, requestedLimit)).map(mapAccount);

    return formatSuccess({
      summary: `Found ${accounts.length} accessible LinkedIn ad account${accounts.length === 1 ? '' : 's'}`,
      data: accounts,
      metadata: {
        totalAccounts: accounts.length,
        appliedStatusFilter: statusValues.length > 0 ? statusValues : null,
        appliedTypeFilter: typeValues.length > 0 ? typeValues : null
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
