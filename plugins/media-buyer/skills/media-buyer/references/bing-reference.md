# Bing Ads MCP Reference

All queries use `mcp__bing-ads__report`, `mcp__bing-ads__query`, or `mcp__bing-ads__list_accounts`.

## Key Data Notes

- Bing `Spend` is already in dollars — no micros conversion needed.
- `Ctr` is returned as a percentage string (e.g., "2.45%"). Parse to float for math.
- `QualityScore` may be `"--"` or empty for low-volume keywords. Treat as "no QS".
- Search query reports have the same privacy thresholds as Google — low-volume terms hidden.
- Bing API does not expose: change event history, ad disapproval data, impression share in reports.

---

## Report Tool (`mcp__bing-ads__report`)

```json
{
  "report_type": "campaign | ad_group | keyword | ad | search_query | account | asset_group",
  "date_range": "Last30Days",
  "aggregation": "Daily | Summary | Weekly | Monthly | Hourly",
  "columns": ["..."],
  "limit": 5000,
  "account_id": "optional",
  "customer_id": "optional"
}
```

### Date Ranges

| Value | Coverage |
|-------|----------|
| `Today` | Current day |
| `Yesterday` | Previous day |
| `LastSevenDays` / `Last7Days` | Past 7 days |
| `LastFourWeeks` / `Last30Days` | Past 28 days (not 30) |
| `ThisMonth` | Current month |
| `LastMonth` | Previous month |
| `LastThreeMonths` | Past 3 months |
| `ThisYear` | Current year |

For custom ranges, use `start_date` and `end_date` as `YYYY-MM-DD` instead of `date_range`.

### Report Types & Common Columns

**Campaign Performance**: `CampaignName`, `CampaignStatus`, `CampaignType`, `Impressions`, `Clicks`, `Ctr`, `Spend`, `Conversions`, `CostPerConversion`, `Revenue`, `ReturnOnAdSpend`

**Ad Group Performance**: `CampaignName`, `AdGroupName`, `AdGroupStatus`, `Impressions`, `Clicks`, `Ctr`, `Spend`, `Conversions`, `CostPerConversion`

**Keyword Performance**: `CampaignName`, `AdGroupName`, `Keyword`, `KeywordId`, `MatchType`, `Impressions`, `Clicks`, `Ctr`, `Spend`, `Conversions`, `CostPerConversion`, `QualityScore`

**Search Query Performance**: `SearchQuery`, `CampaignName`, `AdGroupName`, `Keyword`, `MatchType`, `Impressions`, `Clicks`, `Spend`, `Conversions`

**Product Dimension Performance**: `Title`, `MerchantProductId`, `Brand`, `Condition`, `Impressions`, `Clicks`, `Ctr`, `Spend`, `Conversions`, `Revenue`, `ReturnOnAdSpend`

---

## Query Tool (`mcp__bing-ads__query`)

```json
{
  "entity": "campaigns | ad_groups | keywords | ads",
  "campaign_id": "optional",
  "ad_group_id": "optional"
}
```

- `campaigns`: Returns campaign IDs, names, statuses, budget types, daily budgets.
- `keywords`: Returns keyword text, match type, status, bid. Requires `campaign_id` and `ad_group_id`.
- `ads`: Returns ad copy, status. Requires `campaign_id` and `ad_group_id`.

---

## Common Report Configs

### Campaign Performance (30d daily)

```json
{
  "report_type": "campaign",
  "date_range": "Last30Days",
  "aggregation": "Daily",
  "columns": ["TimePeriod", "AccountName", "CampaignName", "CampaignId", "Impressions", "Clicks", "Ctr", "AverageCpc", "Spend", "Conversions", "Revenue"],
  "limit": 5000
}
```

### Keyword Performance (yesterday)

```json
{
  "report_type": "keyword",
  "date_range": "Yesterday",
  "aggregation": "Daily",
  "columns": ["CampaignName", "AdGroupName", "Keyword", "KeywordId", "Impressions", "Clicks", "Spend", "Conversions", "QualityScore"],
  "limit": 1000
}
```

### Keyword Performance (30d summary — waste detection)

```json
{
  "report_type": "keyword",
  "date_range": "Last30Days",
  "aggregation": "Summary",
  "columns": ["CampaignName", "AdGroupName", "Keyword", "KeywordId", "MatchType", "Impressions", "Clicks", "Spend", "Conversions", "QualityScore"],
  "limit": 5000
}
```

### Search Query Report (30d)

```json
{
  "report_type": "search_query",
  "date_range": "Last30Days",
  "aggregation": "Summary",
  "columns": ["CampaignName", "AdGroupName", "SearchQuery", "Keyword", "MatchType", "Impressions", "Clicks", "Spend", "Conversions"],
  "limit": 5000
}
```

### Campaign Structure

```json
{
  "entity": "campaigns"
}
```

Returns campaign IDs, names, statuses, daily budgets. Use `daily_budget` for pacing calculations.

### Zero-Impression Campaigns (30d)

```json
{
  "report_type": "campaign",
  "date_range": "Last30Days",
  "aggregation": "Summary",
  "columns": ["CampaignName", "CampaignId", "Impressions", "Clicks", "Spend"],
  "limit": 1000
}
```

Filter: `Impressions == 0` for campaigns that are active.

---

## Google-to-Bing Field Mapping

| Google Field | Bing Field | Notes |
|-------------|-----------|-------|
| `search_term_view.search_term` | `SearchQuery` | Same concept |
| `metrics.cost` | `Spend` | Both in dollars |
| `metrics.conversions` | `Conversions` | Same |
| `metrics.ctr` (decimal) | `Ctr` (percentage string) | Parse Bing to float |
| `segments.date` | `TimePeriod` | Format varies by aggregation |
| `ad_group_criterion.keyword.match_type` (BROAD) | `MatchType` (Broad) | Different enum casing |

## Bing Gaps vs Google

- No change event history
- No ad disapproval data via reporting
- No impression share in standard reports
- No Display network expansion toggle (Bing doesn't have it)
- Per-ad-group keyword/ad queries can be slow on large accounts — cap at 50 ad groups, prioritized by spend
