import { getApiVersion, RESTLI_PROTOCOL_VERSION } from '../http.js';
import { encodeRestliValue } from './restli.js';
import { fromEntityUrn, toEntityUrn, validateArray } from './validation.js';

/**
 * Supported mutate entity identifiers.
 */
export const SUPPORTED_MUTATE_ENTITIES = ['campaign', 'campaign_group', 'creative'];
/**
 * Supported mutate action identifiers.
 */
export const SUPPORTED_MUTATE_ACTIONS = ['create', 'update', 'pause', 'enable', 'archive'];

/**
 * Default status applied to created entities. LinkedIn documents DRAFT as the
 * safe non-serving state for newly created campaigns, campaign groups, and
 * creatives; pass an explicit status (intendedStatus for creatives) to override.
 */
export const DEFAULT_CREATE_STATUS = 'DRAFT';

const ENTITY_COLLECTIONS = {
  campaign: 'adCampaigns',
  campaign_group: 'adCampaignGroups',
  creative: 'creatives'
};

const STATUS_FIELD_BY_ENTITY = {
  campaign: 'status',
  campaign_group: 'status',
  creative: 'intendedStatus'
};

const STATUS_BY_ACTION = {
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

  if (op.entity === 'creative' && op.action === 'create' && !op.params?.campaign) {
    return {
      index,
      message: 'creative create requires params.campaign (campaign ID or urn:li:sponsoredCampaign URN)'
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

// Creatives are keyed by URN in resource paths and must be percent-encoded;
// campaigns and campaign groups are keyed by their numeric ID.
function encodeEntityKey(entity, id) {
  if (entity === 'creative') {
    return encodeRestliValue(toEntityUrn('creative', id));
  }

  return encodeRestliValue(fromEntityUrn(id));
}

function buildCreateBody(operation, accountId) {
  const statusField = STATUS_FIELD_BY_ENTITY[operation.entity];
  const body = {
    [statusField]: DEFAULT_CREATE_STATUS,
    ...operation.params
  };

  if (operation.entity === 'creative') {
    body.campaign = toEntityUrn('campaign', operation.params.campaign);
    return body;
  }

  if (!body.account) {
    body.account = toEntityUrn('account', accountId);
  }

  return body;
}

/**
 * Build a LinkedIn Marketing API request from a single mutate operation.
 * Creates POST to the entity collection under the account; update and status
 * changes POST to the entity item with X-RestLi-Method: PARTIAL_UPDATE and a
 * { patch: { $set: {...} } } body.
 * @param {{ entity: string, action: string, id?: string, params?: Record<string, unknown> }} operation
 * @param {string} accountId
 * @returns {{ method: string, path: string, headers: Record<string, string>, body: Record<string, unknown> }}
 */
export function buildApiRequest(operation, accountId) {
  const collection = ENTITY_COLLECTIONS[operation.entity];

  if (operation.action === 'create') {
    return {
      method: 'POST',
      path: `/adAccounts/${accountId}/${collection}`,
      headers: {},
      body: buildCreateBody(operation, accountId)
    };
  }

  const statusField = STATUS_FIELD_BY_ENTITY[operation.entity];
  const actionStatus = STATUS_BY_ACTION[operation.action];
  const setPayload = actionStatus
    ? { [statusField]: actionStatus, ...(operation.params || {}) }
    : { ...(operation.params || {}) };

  return {
    method: 'POST',
    path: `/adAccounts/${accountId}/${collection}/${encodeEntityKey(operation.entity, operation.id)}`,
    headers: {
      'X-RestLi-Method': 'PARTIAL_UPDATE'
    },
    body: {
      patch: {
        $set: setPayload
      }
    }
  };
}

/**
 * Build a human-readable preview of the exact API requests derived from
 * operations, including the versioned headers that would be sent
 * (Authorization is omitted).
 * @param {Array<{ entity: string, action: string, id?: string, params?: Record<string, unknown> }>} operations
 * @param {string} accountId
 * @returns {{ requests: Array<Record<string, unknown>> }}
 */
export function buildRequestPreview(operations, accountId) {
  const sharedHeaders = {
    'LinkedIn-Version': getApiVersion(),
    'X-Restli-Protocol-Version': RESTLI_PROTOCOL_VERSION,
    'Content-Type': 'application/json'
  };

  return {
    requests: operations.map((operation, index) => {
      const request = buildApiRequest(operation, accountId);
      return {
        index,
        entity: operation.entity,
        action: operation.action,
        method: request.method,
        path: request.path,
        headers: {
          ...sharedHeaders,
          ...request.headers
        },
        body: request.body
      };
    })
  };
}
