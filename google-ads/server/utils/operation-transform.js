/**
 * Operation format transformation utility
 * Converts standard Google Ads API format to Opteo library format
 */

import { transformImageAssetResource } from './image-asset.js';

/**
 * Entities that legitimately use resource_name in CREATE operations.
 * These use temporary resource IDs (-1, -2, etc.) for atomic multi-resource creation.
 * See: https://developers.google.com/google-ads/api/docs/mutating/overview
 */
const ENTITIES_REQUIRING_RESOURCE_NAME_IN_CREATE = new Set([
  'campaign_budget',  // Used for temp IDs when creating budget + campaign atomically
  'campaign'          // Used for temp IDs when creating campaign + asset group atomically (PMax)
]);

/**
 * Valid bidding strategy fields for campaigns.
 * Exactly ONE must be present for campaign creation.
 * See: https://developers.google.com/google-ads/api/docs/campaigns/bidding/assign-strategies
 */
const CAMPAIGN_BIDDING_STRATEGIES = [
  'manual_cpc',
  'manual_cpm',
  'manual_cpv',
  'maximize_conversions',
  'maximize_conversion_value',
  'target_cpa',
  'target_roas',
  'target_spend',
  'target_impression_share',
  'percent_cpc',
  'commission',
  'bidding_strategy'  // Portfolio bidding strategy reference
];

/**
 * Default value for EU political advertising field.
 * Required for all campaign creation since API v19.2 (September 2025).
 */
const DEFAULT_EU_POLITICAL_ADVERTISING = 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING';

/**
 * Resource name URL path segments to entity type mapping
 * Based on Google Ads API resource name patterns
 */
const RESOURCE_PATH_TO_ENTITY = {
  'campaigns': 'campaign',
  'adGroups': 'ad_group',
  'adGroupCriteria': 'ad_group_criterion',
  'campaignCriteria': 'campaign_criterion',
  'labels': 'label',
  'sharedSets': 'shared_set',
  'sharedCriteria': 'shared_criterion',
  'campaignBudgets': 'campaign_budget',
  'biddingStrategies': 'bidding_strategy',
  'ads': 'ad',              // For ad content updates (RSA headlines, descriptions, URLs)
  'adGroupAds': 'ad_group_ad', // For ad group membership and status changes
  'assets': 'asset',
  'conversionActions': 'conversion_action',
  'customerNegativeCriteria': 'customer_negative_criterion',
  'campaignLabels': 'campaign_label',
  'adGroupLabels': 'ad_group_label',
  'customerLabels': 'customer_label',
  'keywordPlanCampaigns': 'keyword_plan_campaign',
  'keywordPlanAdGroups': 'keyword_plan_ad_group',
  'keywordPlanAdGroupKeywords': 'keyword_plan_ad_group_keyword',
  'extensionFeedItems': 'extension_feed_item',
  'campaignExtensionSettings': 'campaign_extension_setting',
  'adGroupExtensionSettings': 'ad_group_extension_setting',
  'remarketingActions': 'remarketing_action',
  'userLists': 'user_list',
};

/**
 * Extract entity type from resource_name URL pattern
 * @param {string} resourceName - e.g., "customers/123/campaigns/456"
 * @returns {string|null} - e.g., "campaign" or null if not found
 */
function inferEntityFromResourceName(resourceName) {
  if (!resourceName || typeof resourceName !== 'string') return null;

  // Parse: customers/{customer_id}/{resource_type}/{resource_id}
  const parts = resourceName.split('/');
  if (parts.length >= 3 && parts[0] === 'customers') {
    const resourceType = parts[2]; // e.g., "campaigns", "adGroups"
    return RESOURCE_PATH_TO_ENTITY[resourceType] || null;
  }
  return null;
}

/**
 * Infer entity type from create operation structure
 * @param {Object} resource - The resource being created
 * @returns {string|null} - Entity type or null
 */
function inferEntityFromCreateResource(resource) {
  if (!resource || typeof resource !== 'object') return null;

  const keys = Object.keys(resource);

  // ad_group_criterion: has ad_group key and keyword/placement/negative
  if (keys.includes('ad_group') && (keys.includes('keyword') || keys.includes('negative') || keys.includes('placement'))) {
    return 'ad_group_criterion';
  }

  // campaign_criterion: has campaign key and keyword/negative (but not just campaign reference)
  if (keys.includes('campaign') && (keys.includes('keyword') || keys.includes('negative')) && !keys.includes('advertising_channel_type')) {
    return 'campaign_criterion';
  }

  // shared_criterion: has shared_set key
  if (keys.includes('shared_set')) {
    return 'shared_criterion';
  }

  // label: has name and text_label
  if (keys.includes('name') && keys.includes('text_label')) {
    return 'label';
  }

  // ad_group: has campaign key and name but no keyword (and isn't a criterion)
  if (keys.includes('campaign') && keys.includes('name') && !keys.includes('keyword') && !keys.includes('negative')) {
    return 'ad_group';
  }

  // campaign: has advertising_channel_type
  if (keys.includes('advertising_channel_type')) {
    return 'campaign';
  }

  // campaign_budget: has amount_micros
  if (keys.includes('amount_micros') && !keys.includes('cpc_bid_micros')) {
    return 'campaign_budget';
  }

  // asset: has type field (image_asset, text_asset, etc.)
  if (keys.some(k => k.endsWith('_asset'))) {
    return 'asset';
  }

  // conversion_action: has type and category
  if (keys.includes('type') && keys.includes('category')) {
    return 'conversion_action';
  }

  return null;
}

/**
 * Process campaign resource for CREATE operations.
 * - Adds required contains_eu_political_advertising field if missing
 * - Validates bidding strategy is present
 * @param {Object} resource - Campaign resource object
 * @param {number} index - Operation index for error messages
 * @returns {{ resource: Object, warnings: string[] }} - Processed resource and warnings
 * @throws {Error} - If validation fails
 */
function processCampaignCreate(resource, index) {
  const warnings = [];
  let processedResource = { ...resource };

  // Add EU political advertising field if missing (required since API v19.2)
  if (!processedResource.contains_eu_political_advertising) {
    processedResource.contains_eu_political_advertising = DEFAULT_EU_POLITICAL_ADVERTISING;
    warnings.push(
      `Operation ${index}: Auto-added contains_eu_political_advertising='${DEFAULT_EU_POLITICAL_ADVERTISING}' (required since API v19.2)`
    );
  }

  // Validate bidding strategy is present
  const hasBiddingStrategy = CAMPAIGN_BIDDING_STRATEGIES.some(
    field => processedResource[field] !== undefined
  );

  if (!hasBiddingStrategy) {
    throw new Error(
      `Operation ${index}: Campaign CREATE requires a bidding strategy. ` +
      `Set one of: ${CAMPAIGN_BIDDING_STRATEGIES.join(', ')}`
    );
  }

  return { resource: processedResource, warnings };
}

/**
 * Check if operation is already in Opteo format
 * @param {Object} operation
 * @returns {boolean}
 */
function isOpteoFormat(operation) {
  return !!(operation &&
    typeof operation.entity === 'string' &&
    operation.resource !== undefined);
}

/**
 * Get operation type from standard format operation
 * @param {Object} operation
 * @returns {string|null} - 'create', 'update', 'remove', or null
 */
function getStandardOperationType(operation) {
  if (!operation || typeof operation !== 'object') return null;
  if ('create' in operation) return 'create';
  if ('update' in operation) return 'update';
  if ('remove' in operation) return 'remove';
  return null;
}

/**
 * Transform standard format operation to Opteo format
 * @param {Object} operation - Standard format operation
 * @param {number} index - Operation index for error messages
 * @returns {Object} - Opteo format operation
 * @throws {Error} - If entity cannot be inferred
 */
function transformToOpteoFormat(operation, index) {
  const opType = getStandardOperationType(operation);

  if (!opType) {
    throw new Error(
      `Operation ${index}: Invalid format. Expected { create: {...} }, { update: {...} }, { remove: "..." }, ` +
      `or Opteo format { entity: "...", operation: "...", resource: {...} }`
    );
  }

  let entity = null;
  let resource = null;

  if (opType === 'remove') {
    // Remove operations have resource_name as string value
    // The Opteo library expects resource to be the string directly for remove ops
    const resourceName = operation.remove;
    if (typeof resourceName !== 'string') {
      throw new Error(`Operation ${index}: 'remove' value must be a resource_name string`);
    }
    entity = inferEntityFromResourceName(resourceName);
    resource = resourceName;  // String, not object - Opteo expects { remove: "resource_name" }
  } else {
    // Create/Update operations have resource as object
    resource = operation[opType];
    if (!resource || typeof resource !== 'object') {
      throw new Error(`Operation ${index}: '${opType}' value must be an object`);
    }

    // Try to infer entity from resource_name first (for updates)
    if (resource.resource_name) {
      entity = inferEntityFromResourceName(resource.resource_name);
    }

    // For creates without resource_name, infer from structure
    if (!entity && opType === 'create') {
      entity = inferEntityFromCreateResource(resource);
    }
  }

  // Check for explicit entity hint in the operation
  if (!entity && operation._entity) {
    entity = operation._entity;
  }

  if (!entity) {
    throw new Error(
      `Operation ${index}: Could not infer entity type. Please use Opteo format: ` +
      `{ entity: "campaign", operation: "${opType}", resource: {...} } ` +
      `or add "_entity" field to your operation.`
    );
  }

  // Strip resource_name from CREATE operations (API generates it automatically)
  // Exception: entities that use temp IDs for atomic multi-resource creation
  // See: https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns
  if (opType === 'create' && resource.resource_name) {
    if (!ENTITIES_REQUIRING_RESOURCE_NAME_IN_CREATE.has(entity)) {
      const { resource_name, ...resourceWithoutName } = resource;
      resource = resourceWithoutName;
    }
  }

  // Process image file paths in asset resources
  if (opType === 'create' && entity === 'asset') {
    const imageResult = transformImageAssetResource(resource);
    if (imageResult.error) {
      throw new Error(`Operation ${index}: ${imageResult.error}`);
    }
    if (imageResult.processed) {
      resource = imageResult.resource;
    }
  }

  // Process campaign CREATE operations (EU political advertising, bidding strategy validation)
  let campaignWarnings = [];
  if (opType === 'create' && entity === 'campaign') {
    const campaignResult = processCampaignCreate(resource, index);
    resource = campaignResult.resource;
    campaignWarnings = campaignResult.warnings;
  }

  return {
    entity,
    operation: opType,
    resource,
    _campaignWarnings: campaignWarnings  // Pass warnings up for logging
  };
}

/**
 * Transform operations array to Opteo format
 * Passes through Opteo format operations, transforms standard format
 * @param {Array} operations - Array of operations (mixed formats allowed)
 * @returns {{ operations: Array, warnings: Array }} - Transformed operations and any warnings
 */
export function normalizeOperations(operations) {
  const normalizedOps = [];
  const warnings = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (isOpteoFormat(op)) {
      // Already in Opteo format - pass through, but normalize special cases
      let normalizedOp = { ...op };

      // Handle image_file_path in Opteo format asset operations
      if (op.entity === 'asset' && op.operation === 'create' && op.resource?.image_file_path) {
        const imageResult = transformImageAssetResource(op.resource);
        if (imageResult.error) {
          throw new Error(`Operation ${i}: ${imageResult.error}`);
        }
        if (imageResult.processed) {
          normalizedOp.resource = imageResult.resource;
        }
      }

      // Handle campaign CREATE operations (EU political advertising, bidding strategy)
      if (op.entity === 'campaign' && op.operation === 'create' && op.resource) {
        const campaignResult = processCampaignCreate(op.resource, i);
        normalizedOp.resource = campaignResult.resource;
        warnings.push(...campaignResult.warnings);
      }

      // For remove ops, ensure resource is the string, not an object
      if (op.operation === 'remove' && op.resource && typeof op.resource === 'object') {
        normalizedOp.resource = op.resource.resource_name || op.resource;
      }

      normalizedOps.push(normalizedOp);
    } else {
      // Transform from standard format
      const transformed = transformToOpteoFormat(op, i);
      // Collect campaign warnings and strip internal property
      if (transformed._campaignWarnings?.length > 0) {
        warnings.push(...transformed._campaignWarnings);
      }
      const { _campaignWarnings, ...cleanTransformed } = transformed;
      normalizedOps.push(cleanTransformed);
      warnings.push(`Operation ${i}: Transformed from standard format (entity: ${cleanTransformed.entity})`);
    }
  }

  return { operations: normalizedOps, warnings };
}

// Export helpers for testing
export {
  inferEntityFromResourceName,
  inferEntityFromCreateResource,
  isOpteoFormat,
  getStandardOperationType,
  RESOURCE_PATH_TO_ENTITY
};
