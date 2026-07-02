# Pinterest Ads Analytics Columns Reference

Analytics endpoints require a `columns` list. Pinterest exposes ~185 column names;
this document covers the ones most useful for marketer workflows. All names below
are valid values on the v5 analytics endpoints.

## Naming Conventions

- `_1` suffix: paid-only metric (attributed to the ad impression itself)
- `_2` suffix: paid + earned metric (includes downstream organic activity such as saves/repins of the promoted Pin)
- `TOTAL_` prefix: conversion totals across attribution types (click + engagement + view)
- `*_IN_MICRO_DOLLAR`: value in micro-currency of the ad account's currency (1,000,000 = 1 unit)
- `*_IN_DOLLAR`: value in whole currency units of the ad account's currency

## Default Columns Used by This Server

| Column | Meaning |
|--------|---------|
| `SPEND_IN_DOLLAR` | Spend in currency units |
| `IMPRESSION_2` | Paid + earned impressions |
| `CLICKTHROUGH_2` | Paid + earned Pin clicks |
| `CTR_2` | Paid + earned click-through rate |
| `TOTAL_CONVERSIONS` | Total attributed conversions |

## Common Spend and Delivery Columns

- `SPEND_IN_MICRO_DOLLAR`, `SPEND_IN_DOLLAR`
- `IMPRESSION_1`, `IMPRESSION_2`, `PAID_IMPRESSION`, `TOTAL_IMPRESSION`
- `TOTAL_IMPRESSION_USER` (reach), `TOTAL_IMPRESSION_FREQUENCY` (frequency)
- `CLICKTHROUGH_1`, `CLICKTHROUGH_2`, `TOTAL_CLICKTHROUGH`
- `OUTBOUND_CLICK_1`, `OUTBOUND_CLICK_2`, `OUTBOUND_CTR_1`

## Efficiency Columns

- `CTR`, `CTR_2`, `ECTR`
- `CPC_IN_MICRO_DOLLAR`, `ECPC_IN_DOLLAR`, `ECPC_IN_MICRO_DOLLAR`
- `CPM_IN_DOLLAR`, `CPM_IN_MICRO_DOLLAR`, `ECPM_IN_MICRO_DOLLAR`
- `ECPE_IN_DOLLAR` (cost per engagement), `COST_PER_LEAD`
- `COST_PER_OUTBOUND_CLICK_IN_DOLLAR`

## Engagement Columns

- `ENGAGEMENT_1`, `ENGAGEMENT_2`, `TOTAL_ENGAGEMENT`
- `ENGAGEMENT_RATE`, `EENGAGEMENT_RATE`
- `REPIN_1`, `REPIN_2`, `REPIN_RATE` (saves)

## Conversion Columns

- `TOTAL_CONVERSIONS`
- `TOTAL_CHECKOUT`, `TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR`, `CHECKOUT_ROAS`
- `TOTAL_CLICK_CHECKOUT`, `TOTAL_VIEW_CHECKOUT`, `TOTAL_ENGAGEMENT_CHECKOUT`
- `TOTAL_SIGNUP`, `TOTAL_SIGNUP_VALUE_IN_MICRO_DOLLAR`
- `TOTAL_LEAD`, `LEADS`, `TOTAL_PAGE_VISIT`, `PAGE_VISIT_ROAS`
- `TOTAL_ADD_TO_CART_CONVERSION_RATE`, `TOTAL_CHECKOUT_CONVERSION_RATE`
- `TOTAL_WEB_SESSIONS`, `WEB_SESSIONS_1`, `WEB_SESSIONS_2`

## Video Columns

- `TOTAL_VIDEO_3SEC_VIEWS`, `TOTAL_VIDEO_MRC_VIEWS`
- `TOTAL_VIDEO_P25_COMBINED` through `TOTAL_VIDEO_P95_COMBINED`, `TOTAL_VIDEO_P100_COMPLETE`
- `TOTAL_VIDEO_AVG_WATCHTIME_IN_SECOND`, `VIDEO_LENGTH`
- `ECPV_IN_DOLLAR` (cost per view), `ECPCV_IN_DOLLAR` (cost per completed view)
- `PAID_VIDEO_VIEWABLE_RATE`, `VIDEO_SPEND_IN_DOLLAR`

## Dimension / Metadata Columns

Useful for labeling rows in entity-level reports:

- `CAMPAIGN_ID`, `CAMPAIGN_NAME`, `CAMPAIGN_ENTITY_STATUS`, `CAMPAIGN_OBJECTIVE_TYPE`
- `CAMPAIGN_DAILY_SPEND_CAP`, `CAMPAIGN_LIFETIME_SPEND_CAP`
- `AD_GROUP_ID`, `AD_GROUP_NAME`, `AD_GROUP_ENTITY_STATUS`, `AD_GROUP_BUDGET_TYPE`
- `AD_ID`, `AD_NAME`, `PIN_ID`, `PIN_PROMOTION_ID`

## Attribution Windows

Conversion metrics respect the requested attribution windows:

- `click_window_days` (default 30), `engagement_window_days` (default 30), `view_window_days` (default 1)
- Each accepts `0, 1, 7, 14, 30, 60`
- `conversion_report_time` controls whether conversions are bucketed by ad action time (default) or conversion time

## Granularity Notes

- `TOTAL` aggregates the full range into one row; other granularities add a `DATE` field per row
- `HOUR` granularity no longer returns conversion metrics (non-conversion metrics still work)
- Dates are limited to 90 days back and a 90-day range
