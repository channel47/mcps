import { validateArray } from './validation.js';

/**
 * Supported mutate entity identifiers.
 */
export const SUPPORTED_MUTATE_ENTITIES = ['campaign', 'adgroup', 'ad'];
/**
 * Supported mutate action identifiers.
 */
export const SUPPORTED_MUTATE_ACTIONS = ['create', 'update', 'pause', 'enable', 'delete'];

// TikTok status update endpoints take plural id arrays.
const STATUS_ID_FIELDS = {
  campaign: 'campaign_ids',
  adgroup: 'adgroup_ids',
  ad: 'ad_ids'
};

// Update endpoints take a singular id field (ads identify targets via
// creatives[].ad_id inside params instead — see /ad/update/).
const UPDATE_ID_FIELDS = {
  campaign: 'campaign_id',
  adgroup: 'adgroup_id'
};

const STATUS_BY_ACTION = {
  pause: 'DISABLE',
  enable: 'ENABLE',
  delete: 'DELETE'
};

// /campaign/create/ and /adgroup/create/ default operation_status to ENABLE
// server-side; this server defaults them to DISABLE (paused) for safety.
// /ad/create/ has no top-level operation_status field.
const PAUSED_CREATE_ENTITIES = new Set(['campaign', 'adgroup']);

function validateOperationShape(op, index) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) {
    return { index, message: 'Operation must be an object' };
  }

  if (!op.entity) {
    return { index, message: 'Missing required field: entity' };
  }

  if (!SUPPORTED_MUTATE_ENTITIES.includes(op.entity)) {
    return {
      index,
      message: `Unsupported entity: ${op.entity}. Supported: ${SUPPORTED_MUTATE_ENTITIES.join(', ')}`
    };
  }

  if (!op.action) {
    return { index, message: 'Missing required field: action' };
  }

  if (!SUPPORTED_MUTATE_ACTIONS.includes(op.action)) {
    return {
      index,
      message: `Unsupported action: ${op.action}. Supported: ${SUPPORTED_MUTATE_ACTIONS.join(', ')}`
    };
  }

  if ((op.action === 'create' || op.action === 'update') && (!op.params || typeof op.params !== 'object' || Array.isArray(op.params))) {
    return {
      index,
      message: `${op.action} requires params object`
    };
  }

  const idOptional = op.action === 'create' || (op.action === 'update' && op.entity === 'ad');
  if (!idOptional && !op.id) {
    return {
      index,
      message: `${op.action} requires id`
    };
  }

  return null;
}

/**
 * Validate mutate operation array shape and action/entity compatibility.
 * @param {unknown} operations
 * @returns {Array<{ index: number, message: string }>}
 */
export function validateOperations(operations) {
  validateArray(operations, 'operations');

  const errors = [];
  for (let index = 0; index < operations.length; index += 1) {
    const issue = validateOperationShape(operations[index], index);
    if (issue) {
      errors.push(issue);
    }
  }

  return errors;
}

/**
 * Build a TikTok Business API request payload from a single mutate operation.
 * @param {{ entity: string, action: string, id?: string, params?: Record<string, unknown> }} operation
 * @param {string} advertiserId
 * @returns {{ method: string, path: string, body: Record<string, unknown> }}
 */
export function buildApiRequest(operation, advertiserId) {
  const { entity, action } = operation;

  if (action === 'create') {
    const defaults = PAUSED_CREATE_ENTITIES.has(entity) ? { operation_status: 'DISABLE' } : {};
    return {
      method: 'POST',
      path: `/${entity}/create/`,
      body: {
        advertiser_id: advertiserId,
        ...defaults,
        ...operation.params
      }
    };
  }

  if (action === 'update') {
    const idField = UPDATE_ID_FIELDS[entity];
    const idParams = idField && operation.id ? { [idField]: String(operation.id) } : {};
    return {
      method: 'POST',
      path: `/${entity}/update/`,
      body: {
        advertiser_id: advertiserId,
        ...idParams,
        ...operation.params
      }
    };
  }

  return {
    method: 'POST',
    path: `/${entity}/status/update/`,
    body: {
      advertiser_id: advertiserId,
      [STATUS_ID_FIELDS[entity]]: [String(operation.id)],
      operation_status: STATUS_BY_ACTION[action]
    }
  };
}

/**
 * Build a human-readable preview of API requests derived from operations.
 * @param {Array<{ entity: string, action: string, id?: string, params?: Record<string, unknown> }>} operations
 * @param {string} advertiserId
 * @returns {{ requests: Array<Record<string, unknown>> }}
 */
export function buildRequestPreview(operations, advertiserId) {
  return {
    requests: operations.map((operation, index) => {
      const request = buildApiRequest(operation, advertiserId);
      return {
        index,
        entity: operation.entity,
        action: operation.action,
        method: request.method,
        path: request.path,
        body: request.body
      };
    })
  };
}
