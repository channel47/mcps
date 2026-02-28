import { validateArray, withActPrefix } from './validation.js';

export const SUPPORTED_MUTATE_ENTITIES = ['campaign', 'adset', 'ad', 'audience'];
export const SUPPORTED_MUTATE_ACTIONS = ['create', 'update', 'pause', 'enable', 'delete'];

const CREATE_ENTITY_PATHS = {
  campaign: 'campaigns',
  adset: 'adsets',
  ad: 'ads',
  audience: 'customaudiences'
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

  return {
    method: 'POST',
    path: `/${operation.id}`,
    params: { ...(operation.params || {}) }
  };
}

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
