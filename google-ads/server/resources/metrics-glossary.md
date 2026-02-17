# Google Ads Metrics Glossary

Quick reference for Google Ads metrics available through the MCP server.

## Cost Metrics

| Metric | Description | Notes |
|--------|-------------|-------|
| `cost_micros` | Total cost | Divide by 1,000,000 for currency |
| `average_cpc` | Average cost per click | In micros |
| `average_cpm` | Cost per 1,000 impressions | In micros |

## Engagement Metrics

| Metric | Description | Formula |
|--------|-------------|---------|
| `impressions` | Times ads were shown | Raw count |
| `clicks` | Clicks on ads | Raw count |
| `ctr` | Click-through rate | clicks / impressions |
| `interactions` | Clicks + engagements | Raw count |

## Conversion Metrics

| Metric | Description | Notes |
|--------|-------------|-------|
| `conversions` | Number of conversions | May include view-through |
| `conversions_value` | Total conversion value | In account currency (micros) |
| `cost_per_conversion` | Average CPA | cost / conversions (micros) |
| `conversion_rate` | Conversion rate | conversions / clicks |
| `value_per_conversion` | Avg conversion value | conversions_value / conversions |

## ROAS Calculation

```
ROAS = conversions_value / cost_micros
```
- ROAS of 1.0 = break even
- ROAS of 3.0 = $3 revenue per $1 spent

## Competitive Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| `search_impression_share` | Your impressions / eligible | Higher is better |
| `search_top_impression_share` | Top of page / eligible top | 70%+ ideal |
| `search_absolute_top_impression_share` | Position 1 / eligible | For brand terms |
| `search_budget_lost_impression_share` | Lost due to budget | Lower is better |
| `search_rank_lost_impression_share` | Lost due to rank | Improve QS/bids |

## Quality Metrics

| Metric | Description | Scale |
|--------|-------------|-------|
| `quality_score` | Keyword quality score | 1-10 (7+ good) |
| `expected_ctr` | Predicted CTR | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |
| `ad_relevance` | Ad relevance to keyword | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |
| `landing_page_experience` | Landing page quality | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |

## Shopping Metrics

| Metric | Description |
|--------|-------------|
| `all_conversions` | All conversion types |
| `all_conversions_value` | All conversion value |
| `cross_device_conversions` | Cross-device conversions |

## Video Metrics

| Metric | Description |
|--------|-------------|
| `video_views` | Video view count |
| `video_view_rate` | Views / impressions |
| `average_cpv` | Cost per video view |

## Common Calculations

### CPA (Cost Per Acquisition)
```
CPA = cost_micros / conversions / 1000000
```

### CTR (Click-Through Rate)
```
CTR = (clicks / impressions) * 100
```

### Conversion Rate
```
Conv Rate = (conversions / clicks) * 100
```

### ROAS
```
ROAS = (conversions_value / cost_micros)
```

## Micros Conversion

All monetary values in micros:
| Dollars | Micros |
|---------|--------|
| $0.01 | 10,000 |
| $1.00 | 1,000,000 |
| $10.00 | 10,000,000 |
| $100.00 | 100,000,000 |

## Attribution Notes

- Default attribution: Last-click
- Conversions may use different attribution models
- View-through conversions typically separate
- Cross-device conversions estimated

## More Information

- [Metrics Reference](https://developers.google.com/google-ads/api/fields/v15/metrics)
- [Segments Reference](https://developers.google.com/google-ads/api/fields/v15/segments)
