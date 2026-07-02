import { BING_BASE_URLS } from '../http.js';
import { validateArray, validateOneOf } from './validation.js';

const ACTION_KEYS = ['create', 'update', 'remove'];

const ENTITY_CONFIG = {
  campaigns: {
    actions: {
      create: { method: 'POST', url: `${BING_BASE_URLS.campaignManagement}/Campaigns` },
      update: { method: 'PUT', url: `${BING_BASE_URLS.campaignManagement}/Campaigns` },
      remove: { method: 'DELETE', url: `${BING_BASE_URLS.campaignManagement}/Campaigns` }
    },
    parentField: null, // uses accountId from context
    batchLimit: 100,
    idArrayKey: 'CampaignIds',
    bodyCollectionKey: 'Campaigns',
    deleteIdsKey: 'CampaignIds'
  },
  ad_groups: {
    actions: {
      create: { method: 'POST', url: `${BING_BASE_URLS.campaignManagement}/AdGroups` },
      update: { method: 'PUT', url: `${BING_BASE_URLS.campaignManagement}/AdGroups` },
      remove: { method: 'DELETE', url: `${BING_BASE_URLS.campaignManagement}/AdGroups` }
    },
    parentField: 'campaign_id',
    parentApiKey: 'CampaignId',
    batchLimit: 1000,
    idArrayKey: 'AdGroupIds',
    bodyCollectionKey: 'AdGroups',
    deleteIdsKey: 'AdGroupIds'
  },
  keywords: {
    actions: {
      create: { method: 'POST', url: `${BING_BASE_URLS.campaignManagement}/Keywords` },
      update: { method: 'PUT', url: `${BING_BASE_URLS.campaignManagement}/Keywords` },
      remove: { method: 'DELETE', url: `${BING_BASE_URLS.campaignManagement}/Keywords` }
    },
    parentField: 'ad_group_id',
    parentApiKey: 'AdGroupId',
    batchLimit: 1000,
    idArrayKey: 'KeywordIds',
    bodyCollectionKey: 'Keywords',
    deleteIdsKey: 'KeywordIds'
  },
  ads: {
    actions: {
      create: { method: 'POST', url: `${BING_BASE_URLS.campaignManagement}/Ads` },
      update: { method: 'PUT', url: `${BING_BASE_URLS.campaignManagement}/Ads` },
      remove: { method: 'DELETE', url: `${BING_BASE_URLS.campaignManagement}/Ads` }
    },
    parentField: 'ad_group_id',
    parentApiKey: 'AdGroupId',
    batchLimit: 50,
    idArrayKey: 'AdIds',
    bodyCollectionKey: 'Ads',
    deleteIdsKey: 'AdIds'
  },
  negative_keywords: {
    actions: {
      create: { method: 'POST', url: `${BING_BASE_URLS.campaignManagement}/EntityNegativeKeywords` },
      remove: { method: 'DELETE', url: `${BING_BASE_URLS.campaignManagement}/EntityNegativeKeywords` }
    },
    parentField: 'entity_id',
    batchLimit: 20000
  }
};

const SUPPORTED_ENTITIES = Object.keys(ENTITY_CONFIG);

/**
 * Extract the action type from an operation object.
 */
export function getActionType(op) {
  return validateOneOf(op, ACTION_KEYS, 'operation');
}

function computeParentId(op, body, config, accountId) {
  if (op.entity === 'negative_keywords') {
    return `${body.entity_type}:${body.entity_id}`;
  }
  if (config.parentField) {
    return String(body[config.parentField]);
  }
  return String(accountId);
}

/**
 * Validate all operations and return errors (if any).
 */
export function validateOperations(ops, accountId) {
  validateArray(ops, 'operations');

  const errors = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];

    if (!op.entity) {
      errors.push({ index: i, message: 'Missing required field: entity' });
      continue;
    }

    if (!SUPPORTED_ENTITIES.includes(op.entity)) {
      errors.push({ index: i, message: `Unsupported entity: ${op.entity}. Supported: ${SUPPORTED_ENTITIES.join(', ')}` });
      continue;
    }

    let action;
    try {
      action = getActionType(op);
    } catch (e) {
      errors.push({ index: i, message: e.message });
      continue;
    }

    const config = ENTITY_CONFIG[op.entity];
    if (!config.actions[action]) {
      errors.push({ index: i, message: `Action "${action}" not supported for entity "${op.entity}"` });
      continue;
    }

    const body = op[action];
    if (!body || typeof body !== 'object') {
      errors.push({ index: i, message: `"${action}" must be a non-empty object` });
      continue;
    }

    // Validate parent field for non-campaign entities
    if (op.entity === 'negative_keywords') {
      if (!body.entity_id) {
        errors.push({ index: i, message: 'negative_keywords operations require entity_id' });
      }
      if (!body.entity_type) {
        errors.push({ index: i, message: 'negative_keywords operations require entity_type' });
      }
    } else if (config.parentField && !body[config.parentField]) {
      errors.push({ index: i, message: `${op.entity} operations require ${config.parentField}` });
    }

    // Validate Id for update/remove (except negative_keywords remove uses entity_id)
    if ((action === 'update' || action === 'remove') && op.entity !== 'negative_keywords' && !body.Id) {
      errors.push({ index: i, message: `"${action}" requires Id field` });
    }
  }

  // Enforce batch limits per (entity, action, parentId) group
  if (errors.length === 0) {
    const counts = new Map();
    for (const op of ops) {
      const action = getActionType(op);
      const body = op[action];
      const config = ENTITY_CONFIG[op.entity];
      const parentId = computeParentId(op, body, config, accountId);

      const key = `${op.entity}|${action}|${parentId}`;
      counts.set(key, (counts.get(key) || 0) + 1);

      if (counts.get(key) > config.batchLimit) {
        errors.push({ index: ops.indexOf(op), message: `Batch limit exceeded for ${op.entity} ${action}: max ${config.batchLimit} per request` });
        break;
      }
    }
  }

  return errors;
}

/**
 * Group operations by (entity, action, parentId) for batching into API calls.
 * Returns array of groups, each with: entity, action, parentId, items (with original indices).
 */
export function groupOperations(ops, accountId) {
  const groupMap = new Map();

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const action = getActionType(op);
    const body = op[action];
    const config = ENTITY_CONFIG[op.entity];
    const parentId = computeParentId(op, body, config, accountId);

    const key = `${op.entity}|${action}|${parentId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        entity: op.entity,
        action,
        parentId,
        items: []
      });
    }

    groupMap.get(key).items.push({ index: i, body });
  }

  return Array.from(groupMap.values());
}

/**
 * Build the API request (url, method, body) for a group of operations.
 */
export function buildApiRequest(group, accountId) {
  const { entity, action, items } = group;
  const config = ENTITY_CONFIG[entity];
  const endpoint = config.actions[action];

  if (entity === 'negative_keywords') {
    return buildNegativeKeywordRequest(group, endpoint);
  }

  if (action === 'remove') {
    return buildDeleteRequest(group, accountId, config, endpoint);
  }

  return buildCreateUpdateRequest(group, accountId, config, endpoint);
}

function transformAdForApi(ad) {
  const transformed = { ...ad };

  // Ensure Type field is set for the API
  if (!transformed.Type && transformed.AdType) {
    transformed.Type = transformed.AdType;
    delete transformed.AdType;
  }
  if (!transformed.Type) {
    transformed.Type = 'ResponsiveSearch';
  }

  // Transform headlines array of strings into AssetLink format
  if (transformed.headlines && Array.isArray(transformed.headlines)) {
    transformed.Headlines = transformed.headlines.map((text) => ({
      Asset: { Type: 'TextAsset', Text: text }
    }));
    delete transformed.headlines;
  } else if (transformed.Headlines && Array.isArray(transformed.Headlines)) {
    // Check if already in correct format or needs transformation
    if (typeof transformed.Headlines[0] === 'string') {
      transformed.Headlines = transformed.Headlines.map((text) => ({
        Asset: { Type: 'TextAsset', Text: text }
      }));
    }
  }

  // Transform descriptions array of strings into AssetLink format
  if (transformed.descriptions && Array.isArray(transformed.descriptions)) {
    transformed.Descriptions = transformed.descriptions.map((text) => ({
      Asset: { Type: 'TextAsset', Text: text }
    }));
    delete transformed.descriptions;
  } else if (transformed.Descriptions && Array.isArray(transformed.Descriptions)) {
    if (typeof transformed.Descriptions[0] === 'string') {
      transformed.Descriptions = transformed.Descriptions.map((text) => ({
        Asset: { Type: 'TextAsset', Text: text }
      }));
    }
  }

  // Normalize final_urls to FinalUrls
  if (transformed.final_urls && !transformed.FinalUrls) {
    transformed.FinalUrls = transformed.final_urls;
    delete transformed.final_urls;
  }

  // Normalize path fields
  if (transformed.path_1 && !transformed.Path1) {
    transformed.Path1 = transformed.path_1;
    delete transformed.path_1;
  }
  if (transformed.path_2 && !transformed.Path2) {
    transformed.Path2 = transformed.path_2;
    delete transformed.path_2;
  }

  return transformed;
}

// Seed a request body with the account or parent entity key expected by the API.
function seedParentKey(entity, items, config, accountId) {
  if (entity === 'campaigns') {
    return { AccountId: Number(accountId) };
  }
  return { [config.parentApiKey]: Number(items[0].body[config.parentField]) };
}

function buildCreateUpdateRequest(group, accountId, config, endpoint) {
  const { entity, items } = group;

  const entities = items.map(({ body }) => {
    const cleaned = { ...body };
    // Strip parent field — it's sent as a top-level key
    if (config.parentField) {
      delete cleaned[config.parentField];
    }
    // Transform ad objects into the format the Bing Ads REST API expects
    if (entity === 'ads') {
      return transformAdForApi(cleaned);
    }
    return cleaned;
  });

  const requestBody = seedParentKey(entity, items, config, accountId);
  requestBody[config.bodyCollectionKey] = entities;

  return {
    url: endpoint.url,
    method: endpoint.method,
    body: requestBody
  };
}

function buildDeleteRequest(group, accountId, config, endpoint) {
  const { entity, items } = group;

  const ids = items.map(({ body }) => Number(body.Id));
  const requestBody = seedParentKey(entity, items, config, accountId);
  requestBody[config.deleteIdsKey] = ids;

  return {
    url: endpoint.url,
    method: endpoint.method,
    body: requestBody
  };
}

function buildNegativeKeywordRequest(group, endpoint) {
  const { action, items } = group;

  if (action === 'create') {
    // Group negative keywords by entity_id+entity_type
    const entityMap = new Map();
    for (const { body } of items) {
      const key = `${body.entity_type}:${body.entity_id}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, {
          EntityId: Number(body.entity_id),
          EntityType: body.entity_type,
          NegativeKeywords: []
        });
      }
      entityMap.get(key).NegativeKeywords.push({
        Text: body.Text,
        MatchType: body.MatchType
      });
    }

    return {
      url: endpoint.url,
      method: endpoint.method,
      body: {
        EntityNegativeKeywords: Array.from(entityMap.values())
      }
    };
  }

  // remove action
  const entityMap = new Map();
  for (const { body } of items) {
    const key = `${body.entity_type}:${body.entity_id}`;
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        EntityId: Number(body.entity_id),
        EntityType: body.entity_type,
        NegativeKeywordIds: []
      });
    }
    entityMap.get(key).NegativeKeywordIds.push(Number(body.Id));
  }

  return {
    url: endpoint.url,
    method: endpoint.method,
    body: {
      EntityNegativeKeywords: Array.from(entityMap.values())
    }
  };
}

function indexErrors(errors) {
  const errorsByIndex = new Map();
  for (const err of errors) {
    errorsByIndex.set(err.Index, err);
  }
  return errorsByIndex;
}

// Map batch positions back to original operation indices, marking failures from
// positional errors. When idArray is provided (create actions), successful
// results include the created entity id.
function mapIndicesToResults(indices, errorsByIndex, idArray = null) {
  return indices.map((originalIndex, position) => {
    const error = errorsByIndex.get(position);
    if (error) {
      return {
        index: originalIndex,
        success: false,
        error: { code: error.Code, message: error.Message, error_code: error.ErrorCode }
      };
    }

    if (idArray) {
      return {
        index: originalIndex,
        success: true,
        id: idArray[position] != null ? String(idArray[position]) : null
      };
    }

    return { index: originalIndex, success: true };
  });
}

/**
 * Normalize an API response back into per-operation results, mapped to original indices.
 */
export function normalizeResponse(response, entity, action, indices) {
  if (entity === 'negative_keywords') {
    return normalizeNegativeKeywordResponse(response, action, indices);
  }

  const config = ENTITY_CONFIG[entity];
  const errorsByIndex = indexErrors(response?.PartialErrors || []);

  if (action === 'create') {
    return mapIndicesToResults(indices, errorsByIndex, response?.[config.idArrayKey] || []);
  }

  // update or remove — success inferred from absence of error at position
  return mapIndicesToResults(indices, errorsByIndex);
}

function normalizeNegativeKeywordResponse(response, action, indices) {
  if (action === 'create') {
    // Flatten IDs across entity groups and errors across nested batches
    const allIds = (response?.NegativeKeywordIds || []).flatMap((group) => group?.Ids || []);
    const nestedErrors = (response?.NestedPartialErrors || []).flatMap((nested) => nested?.BatchErrors || []);
    return mapIndicesToResults(indices, indexErrors(nestedErrors), allIds);
  }

  // remove — only partial errors
  return mapIndicesToResults(indices, indexErrors(response?.PartialErrors || []));
}

/**
 * Build a dry-run preview of what would be sent.
 */
export function buildRequestPreview(ops, accountId) {
  const validationErrors = validateOperations(ops, accountId);
  if (validationErrors.length > 0) {
    return { valid: false, errors: validationErrors };
  }

  const groups = groupOperations(ops, accountId);
  const requests = groups.map((group) => {
    const apiRequest = buildApiRequest(group, accountId);
    return {
      entity: group.entity,
      action: group.action,
      operationCount: group.items.length,
      indices: group.items.map((item) => item.index),
      url: apiRequest.url,
      method: apiRequest.method,
      body: apiRequest.body
    };
  });

  return { valid: true, requests };
}
