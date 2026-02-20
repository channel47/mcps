import { bingRequest, BING_BASE_URLS } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { getAccountId, getCustomerId } from '../utils/validation.js';

const BMC_STORES_URL = `${BING_BASE_URLS.campaignManagement}/BMCStores/QueryByCustomerId`;

function mapStore(store) {
  return {
    id: String(store?.Id ?? ''),
    name: store?.Name ?? '',
    store_url: store?.StoreUrl ?? '',
    is_active: store?.IsActive ?? false,
    has_catalog: store?.HasCatalog ?? false,
    is_product_ads_enabled: store?.IsProductAdsEnabled ?? false,
    sub_type: store?.SubType ?? null
  };
}

export async function listStores(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;

  try {
    const customerId = getCustomerId(params);
    const accountId = getAccountId(params);

    const response = await request(
      BMC_STORES_URL,
      {},
      {
        customerId,
        accountId,
        includeContextHeaders: true
      }
    );

    const stores = (response?.BMCStores || []).map(mapStore);

    return formatSuccess({
      summary: `Found ${stores.length} Merchant Center store${stores.length === 1 ? '' : 's'}`,
      data: stores,
      metadata: {
        customerId,
        totalStores: stores.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
