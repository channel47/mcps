# Pinterest Ads REST API v5 Quick Reference

## Base URL

`https://api.pinterest.com/v5`

## Authentication

- Auth is sent via `Authorization: Bearer <TOKEN>` request header.
- This server reads a static token from `PINTEREST_ADS_ACCESS_TOKEN`, or refreshes one
  when `PINTEREST_ADS_CLIENT_ID`, `PINTEREST_ADS_CLIENT_SECRET`, and
  `PINTEREST_ADS_REFRESH_TOKEN` are all set.
- Token refresh: `POST /oauth/token` with `Authorization: Basic base64(client_id:client_secret)`
  and form body `grant_type=refresh_token&refresh_token=<TOKEN>`.
- Pinterest uses continuous refresh tokens (60-day expiration window). Refresh responses
  may include a rotated `refresh_token`; this server logs a stderr warning when that
  happens because it cannot persist the new value itself.
- Required scopes: `ads:read` for read tools, `ads:write` for mutate.

## Pagination

All list endpoints use bookmark cursors:

- Request params: `page_size` (default 25, max 250) and `bookmark`
- Response envelope: `{ "items": [...], "bookmark": "<cursor>" | null }`
- A `null`/absent bookmark means the last page was reached

## Account Discovery

- List accounts: `GET /ad_accounts`
- Optional param: `include_shared_accounts` (default true)
- Account fields include: `id`, `name`, `currency`, `country`, `owner{id,username}`, `time_zone`, `permissions`

## Entity Endpoints (by Ad Account)

- Campaigns: `GET /ad_accounts/<AD_ACCOUNT_ID>/campaigns`
- Ad groups: `GET /ad_accounts/<AD_ACCOUNT_ID>/ad_groups`
- Ads: `GET /ad_accounts/<AD_ACCOUNT_ID>/ads`

Useful query params (arrays are comma-separated strings):

- `entity_statuses`: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DRAFT`, `DELETED_DRAFT` (API default: `ACTIVE,PAUSED`)
- `campaign_ids`: all three endpoints
- `ad_group_ids`: ad_groups and ads endpoints
- `ad_ids`: ads endpoint only
- `order`: `ASCENDING` or `DESCENDING` by ID (higher IDs are more recent)

## Analytics Endpoints

- Account: `GET /ad_accounts/<ID>/analytics`
- Campaigns: `GET /ad_accounts/<ID>/campaigns/analytics` (requires `campaign_ids`)
- Ad groups: `GET /ad_accounts/<ID>/ad_groups/analytics` (requires `ad_group_ids`)
- Ads: `GET /ad_accounts/<ID>/ads/analytics` (requires `ad_ids`)

Required params: `start_date`, `end_date` (YYYY-MM-DD, UTC), `columns` (comma-separated), `granularity` (`TOTAL`, `DAY`, `HOUR`, `WEEK`, `MONTH`).

Constraints:

- `start_date` cannot be more than 90 days back from today
- `end_date` cannot be more than 90 days past `start_date`
- `HOUR` granularity no longer returns conversion metrics

Optional params: `click_window_days`, `engagement_window_days`, `view_window_days`
(each one of `0, 1, 7, 14, 30, 60`), `conversion_report_time`
(`TIME_OF_AD_ACTION` | `TIME_OF_CONVERSION`), `reporting_timezone`
(`PINTEREST_TIME_ZONE` | `AD_ACCOUNT_TIME_ZONE`).

The response is a JSON array of row objects keyed by column name (plus `DATE` for
non-TOTAL granularities).

## Mutations

Pinterest v5 uses bulk-array request bodies (max 30 items per request):

- Create: `POST /ad_accounts/<ID>/campaigns` (or `/ad_groups`, `/ads`) with an array of creation objects
- Update: `PATCH` on the same paths with an array of `{ "id": "...", ...changes }`
- Status change: `PATCH` with `status` set to `ACTIVE`, `PAUSED`, or `ARCHIVED`
- Response envelope: `{ "items": [{ "data": {...}, "exceptions": [...] }] }` — check `exceptions` per item

Required create fields:

- Campaign: `name`, `objective_type` (`AWARENESS`, `CONSIDERATION`, `WEB_CONVERSION`, `CATALOG_SALES`, `VIDEO_COMPLETION`, `APP_INSTALL`, `SALES`, `LEADS`, `CTV_CONSIDERATION`)
- Ad group: `name`, `campaign_id`, `billable_event`
- Ad: `ad_group_id`, `pin_id`, `creative_type`

Notes:

- There is NO delete for campaigns, ad groups, or ads — `ARCHIVED` is the terminal state
- Archived entities cannot be reactivated
- Budget and spend cap fields are in micro-currency (1,000,000 = 1 currency unit)
- `objective_type` can only be updated on draft campaigns

## Error Handling

Errors are JSON `{ "code": <int>, "message": "<text>" }` with an HTTP status
(400, 401, 403, 404, 429). This server:

- Surfaces errors as `Pinterest Ads API request failed (<status>): <message>`
- Retries once on HTTP `429`, honoring `Retry-After` when present (fallback: 60s)
- Does not retry `401` (invalid/expired token)
