import { validateQuery, logValidation } from './query-validator.js';

/**
 * GAQL query templates with placeholder substitution
 */
export const TEMPLATES = {
  // List accounts query
  LIST_ACCOUNTS: `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.manager,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status
    FROM customer_client
    {{FILTERS}}
  `,

  // Campaign performance
  CAMPAIGN_PERFORMANCE: `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      {{METRICS}}
    FROM campaign
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Ad group performance
  AD_GROUP_PERFORMANCE: `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      campaign.id,
      campaign.name,
      {{METRICS}}
    FROM ad_group
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Keyword performance
  KEYWORD_PERFORMANCE: `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      {{METRICS}}
    FROM keyword_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Product group performance
  PRODUCT_GROUP_PERFORMANCE: `
    SELECT
      shopping_performance_view.product_item_id,
      shopping_performance_view.product_title,
      shopping_performance_view.product_brand,
      campaign.id,
      campaign.name,
      {{METRICS}}
    FROM shopping_performance_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Search terms report
  SEARCH_TERMS: `
    SELECT
      search_term_view.search_term,
      search_term_view.status,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      {{METRICS}}
    FROM search_term_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      AND metrics.impressions >= {{MIN_IMPRESSIONS}}
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Wasted spend - search terms
  WASTED_SPEND_SEARCH_TERMS: `
    SELECT
      search_term_view.search_term,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM search_term_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      AND metrics.cost_micros >= {{MIN_COST_MICROS}}
      AND metrics.conversions = {{MAX_CONVERSIONS}}
      {{FILTERS}}
    ORDER BY metrics.cost_micros DESC
    LIMIT {{LIMIT}}
  `,

  // Wasted spend - keywords
  WASTED_SPEND_KEYWORDS: `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM keyword_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      AND metrics.cost_micros >= {{MIN_COST_MICROS}}
      AND metrics.conversions = {{MAX_CONVERSIONS}}
      {{FILTERS}}
    ORDER BY metrics.cost_micros DESC
    LIMIT {{LIMIT}}
  `,

  // Account average CPA (for smart threshold)
  ACCOUNT_CPA: `
    SELECT
      metrics.cost_per_conversion
    FROM customer
    WHERE segments.date DURING LAST_30_DAYS
  `,

  // ============================================
  // PHASE 2: Quality & Budget Analysis Templates
  // ============================================

  // Quality Score Analysis
  QUALITY_SCORE_ANALYSIS: `
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.quality_info.search_predicted_ctr,
      ad_group.id,
      ad_group.name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      AND ad_group_criterion.status = 'ENABLED'
      AND metrics.impressions >= {{MIN_IMPRESSIONS}}
      {{FILTERS}}
    ORDER BY metrics.cost_micros DESC
    LIMIT {{LIMIT}}
  `,

  // Budget Pacing - Campaign Budgets
  CAMPAIGN_BUDGET: `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.id,
      campaign_budget.name,
      campaign_budget.amount_micros,
      campaign_budget.period,
      campaign_budget.delivery_method,
      campaign_budget.explicitly_shared,
      campaign_budget.has_recommended_budget,
      campaign_budget.recommended_budget_amount_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
  `,

  // Budget Pacing - Yesterday's spend for daily rate
  CAMPAIGN_DAILY_SPEND: `
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date = '{{DATE}}'
      {{FILTERS}}
  `,

  // ============================================
  // PHASE 3: Shopping & Segmentation Templates
  // ============================================

  // Shopping Product Status
  SHOPPING_PRODUCT_STATUS: `
    SELECT
      shopping_product.resource_name,
      shopping_product.merchant_center_id,
      shopping_product.channel,
      shopping_product.language_code,
      shopping_product.feed_label,
      shopping_product.item_id,
      shopping_product.title,
      shopping_product.brand,
      shopping_product.price_micros,
      shopping_product.currency_code,
      shopping_product.status,
      shopping_product.issues
    FROM shopping_product
    WHERE 1=1
    {{FILTERS}}
    LIMIT {{LIMIT}}
  `,

  // Shopping Performance by Segment
  SHOPPING_PERFORMANCE: `
    SELECT
      {{SEGMENT_FIELD}},
      campaign.id,
      campaign.name,
      campaign.advertising_channel_type,
      {{METRICS}}
    FROM shopping_performance_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      AND metrics.impressions >= {{MIN_IMPRESSIONS}}
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Performance by Hour of Day
  PERFORMANCE_BY_HOUR: `
    SELECT
      segments.hour,
      {{METRICS}}
    FROM campaign
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
  `,

  // Performance by Day of Week
  PERFORMANCE_BY_DAY_OF_WEEK: `
    SELECT
      segments.day_of_week,
      {{METRICS}}
    FROM campaign
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
  `,

  // Performance by Device
  PERFORMANCE_BY_DEVICE: `
    SELECT
      segments.device,
      {{METRICS}}
    FROM campaign
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
  `,

  // Performance by Geographic Location
  PERFORMANCE_BY_GEO: `
    SELECT
      geographic_view.country_criterion_id,
      geographic_view.location_type,
      {{METRICS}}
    FROM geographic_view
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `,

  // Performance by Audience
  PERFORMANCE_BY_AUDIENCE: `
    SELECT
      user_list.id,
      user_list.name,
      user_list.type,
      {{METRICS}}
    FROM user_list
    WHERE segments.date BETWEEN '{{START_DATE}}' AND '{{END_DATE}}'
      {{FILTERS}}
    ORDER BY {{ORDER_BY}} DESC
    LIMIT {{LIMIT}}
  `
};

/**
 * Build GAQL query from template with parameter substitution
 * @param {string} template - Template string with placeholders
 * @param {Object} params - Substitution parameters
 * @returns {string} Complete GAQL query
 */
export function buildQuery(template, params = {}) {
  let query = template;

  // Replace metrics (array → comma-separated string)
  if (params.metrics) {
    const metricsStr = params.metrics.map(m => {
      // Add metrics. prefix if not present
      return m.startsWith('metrics.') ? m : `metrics.${m}`;
    }).join(', ');
    query = query.replace('{{METRICS}}', metricsStr);
  }

  // Replace dates
  if (params.dates) {
    query = query.replace('{{START_DATE}}', params.dates.start);
    query = query.replace('{{END_DATE}}', params.dates.end);
  }

  // Replace filters
  const filters = params.filters || '';
  query = query.replace('{{FILTERS}}', filters);

  // Replace order by
  const orderBy = params.orderBy || 'metrics.cost_micros';
  query = query.replace('{{ORDER_BY}}', orderBy);

  // Replace limit
  const limit = params.limit || 50;
  query = query.replace('{{LIMIT}}', limit);

  // Replace min impressions
  const minImpressions = params.minImpressions || 10;
  query = query.replace('{{MIN_IMPRESSIONS}}', minImpressions);

  // Replace min cost (convert dollars to micros)
  if (params.minCost !== undefined) {
    const minCostMicros = Math.round(params.minCost * 1000000);
    query = query.replace('{{MIN_COST_MICROS}}', minCostMicros);
  }

  // Replace max conversions
  const maxConversions = params.maxConversions !== undefined ? params.maxConversions : 0;
  query = query.replace('{{MAX_CONVERSIONS}}', maxConversions);

  // Replace resource ID (for auction insights)
  if (params.resourceId !== undefined) {
    query = query.replace('{{RESOURCE_ID}}', params.resourceId);
  }

  // Replace single date (for daily spend queries)
  if (params.date) {
    query = query.replace('{{DATE}}', params.date);
  }

  // Replace max quality score filter
  if (params.maxQualityScore !== undefined) {
    query = query.replace('{{MAX_QUALITY_SCORE}}', params.maxQualityScore);
  }

  // Replace segment field (for shopping performance)
  if (params.segmentField) {
    query = query.replace('{{SEGMENT_FIELD}}', params.segmentField);
  }

  // Replace status filter (for shopping product status)
  if (params.statusFilter) {
    query = query.replace('{{STATUS_FILTER}}', `= '${params.statusFilter}'`);
  } else {
    // If no status filter, match all statuses
    query = query.replace('{{STATUS_FILTER}}', 'IS NOT NULL');
  }

  // Replace geo level (for geographic queries)
  if (params.geoLevel) {
    query = query.replace('{{GEO_LEVEL}}', params.geoLevel);
  }

  // Clean up whitespace
  const finalQuery = query.trim().replace(/\s+/g, ' ');

  // Validate the query (logs warnings/errors if any)
  const validation = validateQuery(finalQuery);
  if (!validation.valid) {
    logValidation(finalQuery, validation);
  }

  return finalQuery;
}
