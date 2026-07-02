import { validateArray } from './validation.js';

/**
 * Supported mutate entity identifiers.
 */
export const SUPPORTED_MUTATE_ENTITIES = ['campaign', 'ad_group', 'ad'];
/**
 * Supported mutate action identifiers. Pinterest v5 has no delete for ads
 * entities — ARCHIVED (via archive) is the terminal state.
 */
export const SUPPORTED_MUTATE_ACTIONS = ['create', 'update', 'pause', 'enable', 'archive'];

const ENTITY_COLLECTIONS = {
  campaign: 'campaigns',
  ad_group: 'ad_groups',
  ad: 'ads'
};

const CREATE_REQUIRED_FIELDS = {
  campaign: ['name', 'objective_type'],
  ad_group: ['name', 'campaign_id', 'billable_event'],
  ad: ['ad_group_id', 'pin_id', 'creative_type']
};

const STATUS_ACTIONS = {
  pause: 'PAUSED',
  enable: 'ACTIVE',
  archive: 'ARCHIVED'
};

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
      message: `Unsupported action: ${op.action}. Supported: ${SUPPORTED_MUTATE_ACTIONS.join(', ')} (Pinterest has no delete — use archive)`
    };
  }

  if ((op.action === 'create' || op.action === 'update') && (!op.params || typeof op.params !== 'object' || Array.isArray(op.params))) {
    return {
      index,
      message: `${op.action} requires params object`
    };
  }

  if (op.action !== 'create' && !op.id) {
    return {
      index,
      message: `${op.action} requires id`
    };
  }

  if (op.action === 'create') {
    const requiredFields = CREATE_REQUIRED_FIELDS[op.entity];
    const missing = requiredFields.filter((field) => {
      const value = op.params[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return {
        index,
        message: `${op.entity} create requires params: ${missing.join(', ')}`
      };
    }
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
 * Build a Pinterest v5 API request from a single mutate operation.
 * Creates are POST with a one-element array body; updates and status changes
 * are PATCH with a one-element array body of { id, ...changes }.
 * @param {{ entity: string, action: string, id?: string, params?: Record<string, unknown> }} operation
 * @param {string} adAccountId
 * @returns {{ method: string, path: string, body: Array<Record<string, unknown>> }}
 */
export function buildApiRequest(operation, adAccountId) {
  const action = operation.action;
  const path = `/ad_accounts/${adAccountId}/${ENTITY_COLLECTIONS[operation.entity]}`;

  if (action === 'create') {
    return {
      method: 'POST',
      path,
      body: [{
        status: 'PAUSED',
        ...operation.params
      }]
    };
  }

  if (action === 'update') {
    return {
      method: 'PATCH',
      path,
      body: [{
        ...operation.params,
        id: String(operation.id)
      }]
    };
  }

  return {
    method: 'PATCH',
    path,
    body: [{
      ...(operation.params || {}),
      id: String(operation.id),
      status: STATUS_ACTIONS[action]
    }]
  };
}

/**
 * Build a human-readable preview of API requests derived from operations.
 * @param {Array<{ entity: string, action: string, id?: string, params?: Record<string, unknown> }>} operations
 * @param {string} adAccountId
 * @returns {{ requests: Array<Record<string, unknown>> }}
 */
export function buildRequestPreview(operations, adAccountId) {
  return {
    requests: operations.map((operation, index) => {
      const request = buildApiRequest(operation, adAccountId);
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
