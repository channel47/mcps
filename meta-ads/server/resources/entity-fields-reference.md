# Meta Ads Entity Field Reference

This document summarizes the default fields returned by the `query` tool for each entity and notes common additions.

## campaigns

Default:

- `id`
- `name`
- `status`
- `objective`
- `daily_budget`
- `lifetime_budget`
- `buying_type`
- `bid_strategy`
- `effective_status`

Common additions:

- `start_time`
- `stop_time`
- `special_ad_categories`

## adsets

Default:

- `id`
- `name`
- `status`
- `campaign_id`
- `daily_budget`
- `targeting`
- `optimization_goal`
- `billing_event`
- `effective_status`

Common additions:

- `lifetime_budget`
- `promoted_object`
- `attribution_spec`

## ads

Default:

- `id`
- `name`
- `status`
- `adset_id`
- `creative{id,name,title,body,image_url,video_id}`
- `effective_status`

Common additions:

- `tracking_specs`
- `conversion_specs`
- `preview_shareable_link`

## insights

Default:

- `spend`
- `impressions`
- `clicks`
- `ctr`
- `cpm`
- `cpc`
- `conversions`
- `cost_per_action_type`
- `frequency`
- `reach`
- `actions`

Common additions:

- `inline_link_clicks`
- `purchase_roas`
- `video_play_actions`

## audiences (`customaudiences`)

Default:

- `id`
- `name`
- `subtype`
- `approximate_count`
- `data_source`
- `delivery_status`

Common additions:

- `retention_days`
- `operation_status`
- `lookalike_spec`

## creatives (`adcreatives`)

Default:

- `id`
- `name`
- `title`
- `body`
- `image_url`
- `video_id`
- `object_story_spec`

Common additions:

- `object_type`
- `thumbnail_url`
- `asset_feed_spec`

## Inline Insights on Non-Insights Entities

For `campaigns`, `adsets`, `ads`, `audiences`, or `creatives`, you can append nested insights by passing `inline_insights_fields`.

Example:

```json
{
  "entity": "ads",
  "inline_insights_fields": ["spend", "ctr", "frequency"]
}
```

This produces a nested field projection similar to:

`insights{spend,ctr,frequency}`
