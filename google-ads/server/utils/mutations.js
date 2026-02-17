/**
 * Mutation execution service for Google Ads write operations
 * All mutations support dry_run mode for validation without changes
 */

import { getCustomerClient } from '../auth.js';

/**
 * Execute Google Ads mutate operations
 * @param {string} customerId - Google Ads customer ID
 * @param {string} resourceType - Type of resource to mutate
 * @param {Array} operations - Array of mutate operations
 * @param {boolean} validateOnly - If true, validate without making changes (dry_run)
 * @returns {Object} Mutation results with success/failure details
 */
export async function executeMutations(customerId, resourceType, operations, validateOnly = true) {
  const customer = getCustomerClient(customerId);

  const results = {
    success: false,
    dry_run: validateOnly,
    operations_count: operations.length,
    successful: [],
    failed: [],
    warnings: []
  };

  try {
    // Build the mutation request payload
    const mutateOptions = {
      partial_failure: true,
      validate_only: validateOnly
    };

    let response;

    // Use the appropriate service method based on resource type
    // google-ads-api v21 uses service-specific methods
    switch (resourceType) {
      case 'campaign_criterion':
        response = await customer.campaignCriteria.create(operations, mutateOptions);
        break;
      case 'ad_group_criterion':
        response = await customer.adGroupCriteria.create(operations, mutateOptions);
        break;
      case 'shared_criterion':
        response = await customer.sharedCriteria.create(operations, mutateOptions);
        break;
      case 'campaign':
        response = await customer.campaigns.update(operations, mutateOptions);
        break;
      case 'ad_group':
        response = await customer.adGroups.update(operations, mutateOptions);
        break;
      case 'campaign_budget':
        response = await customer.campaignBudgets.update(operations, mutateOptions);
        break;
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }

    // Process results
    if (response.results) {
      response.results.forEach((result, index) => {
        if (result.resourceName) {
          results.successful.push({
            index: index,
            resource_name: result.resourceName,
            operation: operations[index]
          });
        }
      });
    }

    // Check for partial failures
    if (response.partial_failure_error) {
      const errors = response.partial_failure_error.errors || [];
      errors.forEach(error => {
        results.failed.push({
          index: error.location?.fieldPathElements?.[0]?.index || -1,
          message: error.message,
          error_code: error.errorCode
        });
      });
    }

    results.success = results.failed.length === 0;

  } catch (error) {
    results.failed.push({
      index: -1,
      message: error.message,
      error_code: error.code || 'UNKNOWN'
    });
  }

  return results;
}

/**
 * Build a negative keyword criterion operation
 * @param {Object} params
 * @param {string} params.keyword - Keyword text
 * @param {string} params.match_type - EXACT, PHRASE, or BROAD
 * @param {string} [params.campaign_id] - Campaign to add negative to
 * @param {string} [params.ad_group_id] - Ad group to add negative to
 * @returns {Object} Mutate operation
 */
export function buildNegativeKeywordOperation(params) {
  const { keyword, match_type, campaign_id, ad_group_id } = params;

  if (ad_group_id) {
    // Ad group level negative
    return {
      create: {
        ad_group: `customers/${params.customer_id}/adGroups/${ad_group_id}`,
        negative: true,
        keyword: {
          text: keyword,
          match_type: match_type
        }
      }
    };
  } else if (campaign_id) {
    // Campaign level negative
    return {
      create: {
        campaign: `customers/${params.customer_id}/campaigns/${campaign_id}`,
        negative: true,
        keyword: {
          text: keyword,
          match_type: match_type
        }
      }
    };
  }

  throw new Error('Either campaign_id or ad_group_id is required');
}

/**
 * Build a bid adjustment operation
 * @param {Object} params
 * @param {string} params.resource_type - keyword, product_group, or ad_group
 * @param {string} params.resource_id - Resource ID to adjust
 * @param {string} params.adjustment_type - SET, INCREASE_PERCENT, DECREASE_PERCENT, etc.
 * @param {number} params.value - Adjustment value
 * @param {number} [params.current_bid] - Current bid in micros (needed for percentage adjustments)
 * @param {number} [params.max_bid] - Maximum bid cap
 * @param {number} [params.min_bid] - Minimum bid floor
 * @returns {Object} Mutate operation with calculated bid
 */
export function buildBidAdjustmentOperation(params) {
  const {
    customer_id,
    resource_type,
    resource_id,
    adjustment_type,
    value,
    current_bid,
    max_bid,
    min_bid
  } = params;

  // Calculate new bid based on adjustment type
  let newBidMicros;

  switch (adjustment_type) {
    case 'SET':
      newBidMicros = Math.round(value * 1000000);
      break;
    case 'INCREASE_PERCENT':
      if (!current_bid) throw new Error('current_bid required for percentage adjustments');
      newBidMicros = Math.round(current_bid * (1 + value / 100));
      break;
    case 'DECREASE_PERCENT':
      if (!current_bid) throw new Error('current_bid required for percentage adjustments');
      newBidMicros = Math.round(current_bid * (1 - value / 100));
      break;
    case 'INCREASE_AMOUNT':
      if (!current_bid) throw new Error('current_bid required for amount adjustments');
      newBidMicros = current_bid + Math.round(value * 1000000);
      break;
    case 'DECREASE_AMOUNT':
      if (!current_bid) throw new Error('current_bid required for amount adjustments');
      newBidMicros = current_bid - Math.round(value * 1000000);
      break;
    default:
      throw new Error(`Invalid adjustment_type: ${adjustment_type}`);
  }

  // Apply caps
  if (max_bid !== undefined) {
    const maxBidMicros = Math.round(max_bid * 1000000);
    newBidMicros = Math.min(newBidMicros, maxBidMicros);
  }

  if (min_bid !== undefined) {
    const minBidMicros = Math.round(min_bid * 1000000);
    newBidMicros = Math.max(newBidMicros, minBidMicros);
  }

  // Ensure minimum bid of $0.01
  newBidMicros = Math.max(newBidMicros, 10000);

  // Build operation based on resource type
  // Note: ad_group_criterion uses .create() method which needs update wrapper
  // ad_group uses .update() method which does NOT need update wrapper
  if (resource_type === 'keyword' || resource_type === 'product_group') {
    return {
      update: {
        resource_name: `customers/${customer_id}/adGroupCriteria/${resource_id}`,
        cpc_bid_micros: newBidMicros
      }
    };
  } else if (resource_type === 'ad_group') {
    return {
      resource_name: `customers/${customer_id}/adGroups/${resource_id}`,
      cpc_bid_micros: newBidMicros
    };
  }

  throw new Error(`Unsupported resource_type: ${resource_type}`);
}

/**
 * Build a campaign status/budget update operation
 * @param {Object} params
 * @param {string} params.customer_id - Customer ID
 * @param {string} params.campaign_id - Campaign ID to update
 * @param {string} [params.status] - ENABLED or PAUSED
 * @param {number} [params.daily_budget] - New daily budget in account currency
 * @returns {Object} Mutate operation(s)
 */
export function buildCampaignUpdateOperation(params) {
  const { customer_id, campaign_id, status, daily_budget } = params;

  const operations = [];

  // Status update
  if (status) {
    operations.push({
      type: 'campaign',
      operation: {
        update: {
          resource_name: `customers/${customer_id}/campaigns/${campaign_id}`,
          status: status
        },
        update_mask: 'status'
      }
    });
  }

  // Budget update requires finding and updating the campaign budget
  if (daily_budget !== undefined) {
    operations.push({
      type: 'campaign_budget',
      operation: {
        update: {
          // Note: In practice, you'd need to look up the budget resource name
          // This is a simplified version
          amount_micros: Math.round(daily_budget * 1000000)
        },
        update_mask: 'amount_micros'
      },
      requires_lookup: true,
      campaign_id: campaign_id
    });
  }

  return operations;
}

/**
 * Check for conflicts before adding negative keywords
 * @param {string} customerId - Customer ID
 * @param {Array} negatives - Proposed negative keywords
 * @param {string} [campaignId] - Campaign to check
 * @param {string} [adGroupId] - Ad group to check
 * @returns {Array} Array of conflict warnings
 */
export async function checkNegativeConflicts(customerId, negatives, campaignId, adGroupId) {
  const customer = getCustomerClient(customerId);
  const conflicts = [];

  // Build query to check for existing negatives and positive keywords
  const filters = [];
  if (campaignId) {
    filters.push(`campaign.id = ${campaignId}`);
  }
  if (adGroupId) {
    filters.push(`ad_group.id = ${adGroupId}`);
  }

  const filterClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';

  // Check for duplicate negatives
  const existingNegativesQuery = `
    SELECT
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign_criterion.negative = true
      ${filterClause}
  `;

  try {
    const existingNegatives = await customer.query(existingNegativesQuery);
    const existingSet = new Set(
      existingNegatives.map(r =>
        `${r.campaign_criterion?.keyword?.text?.toLowerCase()}|${r.campaign_criterion?.keyword?.match_type}`
      )
    );

    negatives.forEach(neg => {
      const key = `${neg.keyword.toLowerCase()}|${neg.match_type}`;
      if (existingSet.has(key)) {
        conflicts.push({
          type: 'DUPLICATE',
          keyword: neg.keyword,
          match_type: neg.match_type,
          message: `Negative keyword "${neg.keyword}" [${neg.match_type}] already exists`
        });
      }
    });
  } catch (error) {
    // Log but don't fail - conflict check is advisory
    console.error('Conflict check failed:', error.message);
  }

  // Check if negatives would block positive keywords
  const positiveKeywordsQuery = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      ${filterClause}
  `;

  try {
    const positiveKeywords = await customer.query(positiveKeywordsQuery);

    negatives.forEach(neg => {
      const negLower = neg.keyword.toLowerCase();

      positiveKeywords.forEach(pos => {
        const posText = pos.ad_group_criterion?.keyword?.text?.toLowerCase();

        // Check if negative would block positive
        if (neg.match_type === 'EXACT' && posText === negLower) {
          conflicts.push({
            type: 'BLOCKS_POSITIVE',
            keyword: neg.keyword,
            match_type: neg.match_type,
            blocked_keyword: pos.ad_group_criterion?.keyword?.text,
            message: `Negative "${neg.keyword}" would block positive keyword "${pos.ad_group_criterion?.keyword?.text}"`
          });
        } else if (neg.match_type === 'PHRASE' && posText?.includes(negLower)) {
          conflicts.push({
            type: 'MAY_BLOCK_POSITIVE',
            keyword: neg.keyword,
            match_type: neg.match_type,
            affected_keyword: pos.ad_group_criterion?.keyword?.text,
            message: `Phrase negative "${neg.keyword}" may block positive keyword "${pos.ad_group_criterion?.keyword?.text}"`
          });
        }
      });
    });
  } catch (error) {
    console.error('Positive keyword check failed:', error.message);
  }

  return conflicts;
}

/**
 * Validate bid adjustment limits
 * @param {number} currentBid - Current bid in currency
 * @param {number} newBid - Proposed new bid in currency
 * @param {Object} limits - Safety limits
 * @returns {Object} Validation result with warnings
 */
export function validateBidChange(currentBid, newBid, limits = {}) {
  const {
    max_change_percent = 50,
    max_bid = null,
    min_bid = 0.01
  } = limits;

  const warnings = [];
  let adjustedBid = newBid;

  // Check percentage change
  if (currentBid > 0) {
    const percentChange = ((newBid - currentBid) / currentBid) * 100;

    if (Math.abs(percentChange) > max_change_percent) {
      warnings.push({
        type: 'LARGE_CHANGE',
        message: `Bid change of ${percentChange.toFixed(1)}% exceeds ${max_change_percent}% limit`,
        original_bid: currentBid,
        proposed_bid: newBid
      });
    }
  }

  // Check max bid
  if (max_bid !== null && newBid > max_bid) {
    adjustedBid = max_bid;
    warnings.push({
      type: 'MAX_BID_EXCEEDED',
      message: `Bid capped at maximum of $${max_bid}`,
      original_bid: newBid,
      adjusted_bid: adjustedBid
    });
  }

  // Check min bid
  if (newBid < min_bid) {
    adjustedBid = min_bid;
    warnings.push({
      type: 'MIN_BID_APPLIED',
      message: `Bid raised to minimum of $${min_bid}`,
      original_bid: newBid,
      adjusted_bid: adjustedBid
    });
  }

  return {
    valid: true,
    adjusted_bid: adjustedBid,
    warnings
  };
}
