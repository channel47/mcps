# TikTok Ads Reporting Reference

The `report` tool wraps the synchronous integrated report endpoint:

`GET /report/integrated/get/`

## Report Types

- `BASIC` (default): performance metrics by advertiser/campaign/adgroup/ad
- `AUDIENCE`: performance broken down by audience dimensions (age, gender, country, etc.)

The API also supports `PLAYABLE_MATERIAL`, `CATALOG`, and `BC` report types; this server intentionally exposes only `BASIC` and `AUDIENCE`.

## Data Levels

`data_level` controls aggregation and must match the id dimension used:

| data_level | id dimension |
|------------|--------------|
| `AUCTION_ADVERTISER` | `advertiser_id` |
| `AUCTION_CAMPAIGN` | `campaign_id` |
| `AUCTION_ADGROUP` | `adgroup_id` |
| `AUCTION_AD` | `ad_id` |

## Dimensions

- Id dimensions: `advertiser_id`, `campaign_id`, `adgroup_id`, `ad_id`
- Time dimensions: `stat_time_day`, `stat_time_hour` (not allowed with lifetime queries)
- Audience dimensions (`report_type: AUDIENCE`): `age`, `gender`, `country_code`, `language`, `platform`, `ac`

Default in this server: the data_level id dimension plus `stat_time_day` (id dimension only when `lifetime: true`).

## Common BASIC Metrics

- Cost: `spend`, `cpc`, `cpm`
- Delivery: `impressions`, `clicks`, `ctr`, `reach`, `frequency`, `cost_per_1000_reached`
- Conversion: `conversion`, `cost_per_conversion`, `conversion_rate`, `real_time_conversion`
- On-platform result: `result`, `cost_per_result`, `result_rate`
- Video: `video_play_actions`, `video_watched_2s`, `video_watched_6s`, `average_video_play`
- Engagement: `likes`, `comments`, `shares`, `follows`, `profile_visits`

Note: the conversion metric is `conversion` (singular). Attribution metrics like `skan_*` exist for iOS campaigns.

## Date Handling

- `start_date` / `end_date` in `YYYY-MM-DD`, interpreted in the advertiser account timezone
- Or `query_lifetime: true` for lifetime metrics (mutually exclusive with dates and `stat_time_*` dimensions)
- This server defaults to the trailing 7 days (UTC) when no dates are given

## Filtering and Sorting

- `filtering`: JSON-encoded array of clauses, e.g.
  `[{"field_name": "campaign_ids", "filter_type": "IN", "filter_value": "[\"123\"]"}]`
- `order_field` + `order_type` (`ASC` / `DESC`) sort results server-side

## Pagination

- `page` (starts at 1) and `page_size` (max 1000)
- Responses include `data.page_info { page, page_size, total_number, total_page }`
- Rows arrive as `{ dimensions: {...}, metrics: {...} }`; this server flattens each row into a single object
