# GAQL Reference

All queries run via `mcp__google-ads__query` with a GAQL string and customer ID.

## Execution Notes

- Query responses include both `_micros` and auto-converted currency fields (e.g., `metrics.cost`). Use the converted fields — do not divide by 1,000,000 again.
- Use one consistent customer ID and date window per analysis unless the user specifies otherwise.
- Quality score may be null for low-volume keywords.
- Impression share fields are non-aggregable — query them for `YESTERDAY` only.
- `change_event` does not use `segments.date`; it uses `change_date_time`.

## Date Filtering

```sql
segments.date DURING LAST_7_DAYS
segments.date DURING LAST_30_DAYS
segments.date DURING YESTERDAY
segments.date BETWEEN '2026-01-01' AND '2026-01-31'
```

---

## Campaign Performance (30d daily)

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY segments.date DESC
```

## Budget Pacing & Impression Share (yesterday)

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign_budget.amount_micros,
  metrics.cost_micros,
  metrics.search_impression_share,
  metrics.search_budget_lost_impression_share,
  metrics.search_rank_lost_impression_share
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date DURING YESTERDAY
```

## Disapproved Ads

```sql
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_ad.ad.id,
  ad_group_ad.ad.type,
  ad_group_ad.policy_summary.approval_status,
  ad_group_ad.policy_summary.policy_topic_entries
FROM ad_group_ad
WHERE ad_group_ad.policy_summary.approval_status IN ('DISAPPROVED', 'AREA_OF_INTEREST_ONLY')
  AND ad_group_ad.status != 'REMOVED'
```

## High-Spend Zero-Conversion Keywords (yesterday)

```sql
SELECT
  campaign.name,
  ad_group.name,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM keyword_view
WHERE segments.date DURING YESTERDAY
  AND ad_group_criterion.status != 'REMOVED'
  AND metrics.cost_micros > 0
  AND metrics.conversions = 0
ORDER BY metrics.cost_micros DESC
```

## Recent Account Changes (last 24h)

```sql
SELECT
  change_event.change_date_time,
  change_event.change_resource_name,
  change_event.user_email,
  change_event.change_resource_type,
  change_event.resource_change_operation,
  change_event.changed_fields
FROM change_event
WHERE change_event.change_date_time >= 'YESTERDAY_DATE'
  AND change_event.change_date_time <= 'TODAY_DATE'
ORDER BY change_event.change_date_time DESC
LIMIT 10000
```

Replace `YESTERDAY_DATE` and `TODAY_DATE` with `YYYY-MM-DD HH:MM:SS` format. Change events can lag ~3 minutes.

---

## Non-Converting Keywords (30d)

```sql
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.average_cpc
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_criterion.status != 'REMOVED'
  AND metrics.cost_micros > 0
  AND metrics.conversions = 0
ORDER BY metrics.cost_micros DESC
```

## Low Quality Score Keywords

```sql
SELECT
  campaign.name,
  ad_group.name,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.quality_info.quality_score,
  ad_group_criterion.quality_info.creative_quality_score,
  ad_group_criterion.quality_info.post_click_quality_score,
  ad_group_criterion.quality_info.search_predicted_ctr,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.average_cpc
FROM keyword_view
WHERE ad_group_criterion.status != 'REMOVED'
  AND metrics.cost_micros > 0
  AND segments.date DURING LAST_30_DAYS
ORDER BY ad_group_criterion.quality_info.quality_score ASC
```

Filter: `quality_score <= 5 AND cost >= $10`.

## Display Expansion on Search Campaigns

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.network_settings.target_google_search,
  campaign.network_settings.target_search_network,
  campaign.network_settings.target_content_network,
  campaign.network_settings.target_partner_search_network,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND campaign.advertising_channel_type = 'SEARCH'
  AND campaign.network_settings.target_content_network = TRUE
  AND segments.date DURING LAST_30_DAYS
```

## Broad Match Keywords

```sql
SELECT
  campaign.id,
  campaign.name,
  ad_group.name,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  metrics.cost_micros,
  metrics.conversions
FROM keyword_view
WHERE ad_group_criterion.keyword.match_type = 'BROAD'
  AND ad_group_criterion.status != 'REMOVED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
```

## Shared Negative List Coverage

```sql
SELECT
  campaign.id,
  campaign.name,
  shared_set.id,
  shared_set.name,
  shared_set.type,
  shared_set.status
FROM campaign_shared_set
WHERE shared_set.type = 'NEGATIVE_KEYWORDS'
  AND shared_set.status = 'ENABLED'
```

Join: campaigns with broad match keywords but no shared negative list = unprotected.

## Single-Ad Ad Groups

```sql
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_ad.ad.id,
  ad_group_ad.ad.type,
  ad_group_ad.status
FROM ad_group_ad
WHERE ad_group_ad.status = 'ENABLED'
  AND campaign.status != 'REMOVED'
```

Count enabled ads per ad group. Flag groups with exactly 1.

## Zero-Impression Enabled Campaigns (7d)

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign_budget.amount_micros,
  metrics.impressions
FROM campaign
WHERE campaign.status = 'ENABLED'
  AND segments.date DURING LAST_7_DAYS
```

## Non-Converting Search Terms (30d)

```sql
SELECT
  search_term_view.search_term,
  campaign.name,
  ad_group.name,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
  AND metrics.cost_micros > 0
  AND metrics.conversions = 0
ORDER BY metrics.cost_micros DESC
```

---

## Search Term Full Report (30d)

```sql
SELECT
  search_term_view.search_term,
  search_term_view.status,
  segments.search_term_match_type,
  campaign.id,
  campaign.name,
  campaign.advertising_channel_type,
  ad_group.id,
  ad_group.name,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.cost_micros,
  metrics.average_cpc,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 10000
```

## Search Term with Keyword Mapping (Search only)

```sql
SELECT
  search_term_view.search_term,
  search_term_view.status,
  segments.keyword.info.text,
  segments.keyword.info.match_type,
  segments.search_term_match_type,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 10000
```

Adding `segments.keyword.info.text` limits to Search keyword traffic. Shopping, DSA, PMax terms excluded.

Notes:
- Rows marked `EXCLUDED` should not generate new negative recommendations.
- `segments.search_term_match_type` is the match type of the query, not the keyword's configured match type.
- GAQL `LIMIT 10000` can truncate very large accounts.

---

## PMax: Campaign List

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
  AND campaign.status = 'ENABLED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
```

## PMax: Search Term Insight Categories

```sql
SELECT
  campaign_search_term_insight.campaign_id,
  campaign_search_term_insight.category_label,
  campaign_search_term_insight.id,
  metrics.clicks,
  metrics.impressions,
  metrics.conversions,
  metrics.conversions_value
FROM campaign_search_term_insight
WHERE segments.date DURING LAST_30_DAYS
  AND campaign_search_term_insight.campaign_id = 'CAMPAIGN_ID'
```

Requires single-campaign filtering. Run per campaign.

## PMax: Search Terms within a Category

```sql
SELECT
  segments.search_subcategory,
  segments.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.conversions_value
FROM campaign_search_term_insight
WHERE segments.date DURING LAST_30_DAYS
  AND campaign_search_term_insight.campaign_id = 'CAMPAIGN_ID'
  AND campaign_search_term_insight.id = 'CATEGORY_ID'
```

`campaign_search_term_insight` does not include `metrics.cost_micros` — use click share as traffic proxy.

## PMax: Channel Distribution (API v23+)

```sql
SELECT
  campaign.name,
  asset_group.id,
  asset_group.name,
  segments.ad_network_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM asset_group
WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
```

Channel data (SEARCH, YOUTUBE, DISPLAY, SHOPPING) is reliable only for dates after June 1, 2025.

## PMax: Asset Group Performance

```sql
SELECT
  asset_group.id,
  asset_group.name,
  asset_group.primary_status,
  asset_group.ad_strength,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM asset_group
WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
  AND segments.date DURING LAST_30_DAYS
```

## PMax: Asset Performance Labels

```sql
SELECT
  asset_group_asset.asset,
  asset_group_asset.performance_label,
  asset_group_asset.status
FROM asset_group_asset
WHERE asset_group.id = 'ASSET_GROUP_ID'
  AND asset_group_asset.status != 'REMOVED'
```

Labels are relative rankings (`BEST`, `GOOD`, `LOW`, `PENDING`), not cost metrics.

## PMax: Placement Visibility

```sql
SELECT
  performance_max_placement_view.display_name,
  performance_max_placement_view.placement,
  performance_max_placement_view.placement_type,
  performance_max_placement_view.target_url,
  metrics.impressions,
  campaign.id
FROM performance_max_placement_view
WHERE campaign.id = 'CAMPAIGN_ID'
  AND segments.date DURING LAST_30_DAYS
```

Placement view returns impressions only — no clicks, cost, or conversions.

## Common Segmentation Fields

- Device: `segments.device`
- Day of week: `segments.day_of_week`
- Geography: `segments.geo_target_region`
- Network: `segments.ad_network_type`
- Search term: `search_term_view.search_term`
