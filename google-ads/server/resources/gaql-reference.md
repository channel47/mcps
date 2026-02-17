# Google Ads Query Language (GAQL) Quick Reference

## Basic Syntax

```sql
SELECT field1, field2, ...
FROM resource_name
WHERE conditions
ORDER BY field [ASC|DESC]
LIMIT n
```

## Common Resources

| Resource | Description |
|----------|-------------|
| `campaign` | Campaign-level data |
| `ad_group` | Ad group data |
| `keyword_view` | Keyword performance |
| `search_term_view` | Search queries |
| `shopping_performance_view` | Shopping product data |
| `geographic_view` | Geo performance |
| `ad_group_criterion` | Keyword details |
| `campaign_budget` | Budget data |

## Date Filtering

```sql
-- Predefined ranges
WHERE segments.date DURING LAST_7_DAYS
WHERE segments.date DURING LAST_30_DAYS
WHERE segments.date DURING THIS_MONTH

-- Custom range
WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-31'
```

## Common Filters

```sql
WHERE campaign.status = 'ENABLED'
WHERE campaign.advertising_channel_type = 'SEARCH'
WHERE metrics.impressions > 100
WHERE metrics.cost_micros > 10000000  -- $10
```

## Metric Values

All cost/value metrics are in **micros** (divide by 1,000,000):
- `$1.00` = `1000000` micros
- `$100.00` = `100000000` micros

## Example Queries

### Campaign Performance
```sql
SELECT
  campaign.id, campaign.name,
  metrics.cost_micros, metrics.impressions,
  metrics.clicks, metrics.conversions
FROM campaign
WHERE campaign.status = 'ENABLED'
  AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 50
```

### Search Terms
```sql
SELECT
  search_term_view.search_term,
  metrics.impressions, metrics.clicks,
  metrics.cost_micros, metrics.conversions
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 100
```

### Quality Score
```sql
SELECT
  ad_group_criterion.keyword.text,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions, metrics.cost_micros
FROM keyword_view
WHERE ad_group_criterion.status = 'ENABLED'
  AND segments.date DURING LAST_30_DAYS
LIMIT 100
```

## Limitations

- Must start with SELECT
- One resource per query (no JOINs)
- LIMIT max 10,000 rows
- No subqueries

## More Information

- [GAQL Documentation](https://developers.google.com/google-ads/api/docs/query/overview)
- [Available Resources](https://developers.google.com/google-ads/api/docs/query/resources)
