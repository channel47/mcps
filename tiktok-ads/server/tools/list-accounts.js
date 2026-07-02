import { tiktokRequest } from '../http.js';
import { getAppCredentials } from '../auth.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { invalidParamsError } from '../utils/errors.js';

// GET /advertiser/info/ accepts at most 100 advertiser ids per request.
const INFO_BATCH_SIZE = 100;
const INFO_FIELDS = [
  'advertiser_id',
  'name',
  'status',
  'currency',
  'timezone',
  'company',
  'country',
  'create_time'
];

function normalizeAdvertiserIds(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');
  return values.map((id) => String(id).trim()).filter(Boolean);
}

function mapAccount(account) {
  return {
    advertiser_id: String(account?.advertiser_id || ''),
    name: account?.name || '',
    status: account?.status || 'UNKNOWN',
    currency: account?.currency || null,
    timezone: account?.timezone || null,
    company: account?.company || null,
    country: account?.country || null
  };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * List accessible TikTok ad accounts (advertisers) with detail lookup.
 *
 * When TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET are configured, advertiser
 * ids are discovered via GET /oauth2/advertiser/get/; otherwise ids must come
 * from the advertiser_ids param or TIKTOK_ADS_ADVERTISER_ID.
 * @param {{ advertiser_ids?: string[] | string }} [params]
 * @param {{ request?: (path: string, params: Record<string, unknown>, options?: Record<string, unknown>) => Promise<any> }} [dependencies]
 * @returns {Promise<import('@modelcontextprotocol/sdk/types.js').CallToolResult>}
 */
export async function listAccounts(params = {}, dependencies = {}) {
  const request = dependencies.request || tiktokRequest;

  try {
    let advertiserIds = normalizeAdvertiserIds(params.advertiser_ids);
    let discoveredViaOauth = false;

    if (advertiserIds.length === 0) {
      const credentials = getAppCredentials();

      if (credentials) {
        const response = await request('/oauth2/advertiser/get/', {
          app_id: credentials.appId,
          secret: credentials.appSecret
        });
        const list = Array.isArray(response?.data?.list) ? response.data.list : [];
        advertiserIds = list.map((entry) => String(entry?.advertiser_id || '')).filter(Boolean);
        discoveredViaOauth = true;
      } else if (process.env.TIKTOK_ADS_ADVERTISER_ID) {
        advertiserIds = [String(process.env.TIKTOK_ADS_ADVERTISER_ID)];
      }
    }

    if (advertiserIds.length === 0) {
      throw invalidParamsError(
        'No advertiser ids available. Either pass advertiser_ids, set TIKTOK_ADS_ADVERTISER_ID, '
        + 'or set TIKTOK_ADS_APP_ID and TIKTOK_ADS_APP_SECRET to enable discovery via /oauth2/advertiser/get/.'
      );
    }

    const accounts = [];
    for (const batch of chunk(advertiserIds, INFO_BATCH_SIZE)) {
      const response = await request('/advertiser/info/', {
        advertiser_ids: batch,
        fields: INFO_FIELDS
      });
      const list = Array.isArray(response?.data?.list) ? response.data.list : [];
      accounts.push(...list.map(mapAccount));
    }

    return formatSuccess({
      summary: `Found ${accounts.length} accessible TikTok ad account${accounts.length === 1 ? '' : 's'}`,
      data: accounts,
      metadata: {
        totalAccounts: accounts.length,
        discoveredViaOauth
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
