import { validateArray, withActPrefix } from './validation.js';

/**
 * Supported mutate entity identifiers.
 */
export const SUPPORTED_MUTATE_ENTITIES = ['campaign', 'adset', 'ad', 'audience', 'creative'];
/**
 * Supported mutate action identifiers.
 */
export const SUPPORTED_MUTATE_ACTIONS = ['create', 'update', 'pause', 'enable', 'archive', 'delete'];

const CREATE_ENTITY_PATHS = {
  campaign: 'campaigns',
  adset: 'adsets',
  ad: 'ads',
  audience: 'customaudiences',
  creative: 'adcreatives'
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
      message: `Unsupported action: ${op.action}. Supported: ${SUPPORTED_MUTATE_ACTIONS.join(', ')}`
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
 * Build a Meta Graph API request payload from a single mutate operation.
 * @param {{ entity: string, action: string, id?: string, params?: Record<string, unknown> }} operation
 * @param {string} accountId
 * @returns {{ method: string, path: string, params: Record<string, unknown> }}
 */
export function buildApiRequest(operation, accountId) {
  const action = operation.action;

  if (action === 'create') {
    const parentPath = CREATE_ENTITY_PATHS[operation.entity];
    return {
      method: 'POST',
      path: `/${withActPrefix(accountId)}/${parentPath}`,
      params: {
        status: 'PAUSED',
        ...operation.params
      }
    };
  }

  if (action === 'delete') {
    return {
      method: 'DELETE',
      path: `/${operation.id}`,
      params: {}
    };
  }

  if (action === 'pause') {
    return {
      method: 'POST',
      path: `/${operation.id}`,
      params: {
        status: 'PAUSED',
        ...(operation.params || {})
      }
    };
  }

  if (action === 'enable') {
    return {
      method: 'POST',
      path: `/${operation.id}`,
      params: {
        status: 'ACTIVE',
        ...(operation.params || {})
      }
    };
  }

  if (action === 'archive') {
    return {
      method: 'POST',
      path: `/${operation.id}`,
      params: {
        status: 'ARCHIVED',
        ...(operation.params || {})
      }
    };
  }

  return {
    method: 'POST',
    path: `/${operation.id}`,
    params: { ...(operation.params || {}) }
  };
}

/**
 * Build a human-readable preview of API requests derived from operations.
 * @param {Array<{ entity: string, action: string, id?: string, params?: Record<string, unknown> }>} operations
 * @param {string} accountId
 * @returns {{ requests: Array<Record<string, unknown>> }}
 */
export function buildRequestPreview(operations, accountId) {
  return {
    requests: operations.map((operation, index) => {
      const request = buildApiRequest(operation, accountId);
      return {
        index,
        entity: operation.entity,
        action: operation.action,
        method: request.method,
        path: request.path,
        params: request.params
      };
    })
  };
}
