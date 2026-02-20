import { BING_BASE_URLS, bingRequest } from '../http.js';
import { formatError, formatSuccess } from '../utils/response-format.js';
import {
  getAccountId,
  getCustomerId,
  validateArray,
  validateEnum,
  validateRequired
} from '../utils/validation.js';

const ENTITY_TYPES = ['Ad', 'Keyword'];

const ENDPOINT = `${BING_BASE_URLS.campaignManagement}/EditorialReasons/QueryByIds`;

function normalizeEditorialReason(reason) {
  if (!reason) return null;
  return {
    ad_group_id: String(reason.AdGroupId ?? ''),
    entity_id: String(reason.AdOrKeywordId ?? ''),
    appeal_status: reason.AppealStatus ?? null,
    reasons: (reason.Reasons || []).map((r) => ({
      location: r?.Location ?? '',
      publisher_countries: r?.PublisherCountries ?? [],
      reason_code: r?.ReasonCode ?? null,
      term: r?.Term ?? null
    }))
  };
}

export async function getEditorialReasons(params = {}, dependencies = {}) {
  const request = dependencies.request || bingRequest;

  try {
    validateRequired(params, ['entity_type', 'entity_ids']);
    validateEnum(params.entity_type, ENTITY_TYPES, 'entity_type');
    validateArray(params.entity_ids, 'entity_ids');

    const accountId = getAccountId(params);
    const customerId = getCustomerId(params);

    const associations = params.entity_ids.map((entry) => {
      if (typeof entry === 'object' && entry.entity_id && entry.ad_group_id) {
        return {
          EntityId: Number(entry.entity_id),
          ParentId: Number(entry.ad_group_id)
        };
      }
      throw new Error(
        'Each item in entity_ids must be an object with entity_id and ad_group_id'
      );
    });

    const body = {
      AccountId: Number(accountId),
      EntityIdToParentIdAssociations: associations,
      EntityType: params.entity_type
    };

    const response = await request(ENDPOINT, body, { accountId, customerId });

    const reasons = (response?.EditorialReasons || [])
      .map(normalizeEditorialReason)
      .filter(Boolean);

    const partialErrors = (response?.PartialErrors || []).map((e) => ({
      index: e?.Index ?? null,
      code: e?.Code ?? null,
      error_code: e?.ErrorCode ?? '',
      message: e?.Message ?? '',
      disapproved_text: e?.DisapprovedText ?? null,
      location: e?.Location ?? null,
      publisher_country: e?.PublisherCountry ?? null,
      reason_code: e?.ReasonCode ?? null
    }));

    return formatSuccess({
      summary: `Retrieved editorial reasons for ${reasons.length} ${params.entity_type.toLowerCase()}(s)`,
      data: reasons,
      metadata: {
        entity_type: params.entity_type,
        accountId,
        customerId,
        totalRequested: associations.length,
        totalWithReasons: reasons.length,
        partialErrors: partialErrors.length > 0 ? partialErrors : undefined
      }
    });
  } catch (error) {
    return formatError(error);
  }
}
