import { BING_BASE_URLS, contentRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import { validateRequired } from '../utils/validation.js';

const DEFAULT_MAX_RESULTS = 250;
const MIN_MAX_RESULTS = 1;
const MAX_MAX_RESULTS = 250;

function resolveMaxResults(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_MAX_RESULTS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_MAX_RESULTS || parsed > MAX_MAX_RESULTS) {
    throw new Error(`Invalid max_results: ${value}. Must be an integer between 1 and 250.`);
  }

  return parsed;
}

function buildProductsUrl(storeId, maxResults, startToken) {
  const query = new URLSearchParams({
    'max-results': String(maxResults)
  });

  if (startToken) {
    query.set('start-token', String(startToken));
  }

  return `${BING_BASE_URLS.contentApi}/${encodeURIComponent(storeId)}/products?${query.toString()}`;
}

function normalizeProduct(product) {
  const customLabels = [
    product?.customLabel0,
    product?.customLabel1,
    product?.customLabel2,
    product?.customLabel3,
    product?.customLabel4
  ].filter((label) => label !== undefined && label !== null && label !== '');

  return {
    id: product?.id ?? '',
    offer_id: product?.offerId ?? '',
    title: product?.title ?? '',
    link: product?.link ?? '',
    mobile_link: product?.mobileLink ?? null,
    adwords_redirect: product?.adwordsRedirect ?? null,
    price: product?.price ?? null,
    sale_price: product?.salePrice ?? null,
    availability: product?.availability ?? '',
    image_link: product?.imageLink ?? '',
    brand: product?.brand ?? '',
    custom_labels: customLabels,
    expiration_date: product?.expirationDate ?? null
  };
}

export async function listProducts(params = {}, dependencies = {}) {
  const request = dependencies.request || contentRequest;

  try {
    validateRequired(params, ['store_id']);

    const storeId = String(params.store_id);
    const maxResults = resolveMaxResults(params.max_results);
    const requestUrl = buildProductsUrl(storeId, maxResults, params.start_token);
    const response = await request(
      requestUrl,
      undefined,
      {
        method: 'GET',
        includeContextHeaders: false
      }
    );

    const products = (response?.resources || response?.products || []).map(normalizeProduct);
    const nextPageToken = response?.nextPageToken ?? null;

    return formatSuccess({
      summary: `Found ${products.length} product${products.length === 1 ? '' : 's'} in store ${storeId}`,
      data: products,
      metadata: {
        storeId,
        maxResults,
        nextPageToken,
        totalProducts: products.length
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
