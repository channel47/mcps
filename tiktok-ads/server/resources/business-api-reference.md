# TikTok Business API Quick Reference

## Base URL

`https://business-api.tiktok.com/open_api/v1.3`

## Authentication

- Auth is provided via the `Access-Token` request header (not `Authorization: Bearer`)
- This server reads the token from `TIKTOK_ADS_ACCESS_TOKEN`
- Tokens issued for the Business API are long-lived; no refresh flow in v1
- `TIKTOK_ADS_APP_ID` + `TIKTOK_ADS_APP_SECRET` (developer app credentials) are only needed for advertiser discovery via `/oauth2/advertiser/get/`

## Response Envelope

Every response — including errors — is normally HTTP `200` with:

```json
{
  "code": 0,
  "message": "OK",
  "request_id": "...",
  "data": { }
}
```

- `code: 0` means success; any non-zero `code` is an error
- This server converts non-zero codes into thrown errors that include the code and message
- List endpoints return `data.list` plus `data.page_info { page, page_size, total_number, total_page }`

## Account Discovery

- Authorized advertisers: `GET /oauth2/advertiser/get/` with `app_id` and `secret` query params (plus `Access-Token` header). Returns `data.list` of `{ advertiser_id, advertiser_name }`
- Account details: `GET /advertiser/info/` with `advertiser_ids` (JSON-encoded array, max 100 ids) and optional `fields` (JSON-encoded array, e.g. `name`, `status`, `currency`, `timezone`, `company`, `country`, `create_time`)

## Query Endpoints (by Advertiser)

- Campaigns: `GET /campaign/get/`
- Ad groups: `GET /adgroup/get/`
- Ads: `GET /ad/get/`

Useful query params:

- `advertiser_id` (required)
- `fields`: JSON-encoded array of field names
- `filtering`: JSON-encoded object (e.g. `{"campaign_ids": ["123"], "primary_status": "STATUS_DELIVERY_OK"}`)
- `page` (default 1) and `page_size` (default 10, max 1000)

Complex GET params (`fields`, `filtering`, `dimensions`, `metrics`, `advertiser_ids`) must be JSON-encoded strings in the query string.

## Mutations

All writes are `POST` with a JSON body that includes `advertiser_id`:

- Create: `POST /campaign/create/`, `POST /adgroup/create/`, `POST /ad/create/`
- Update: `POST /campaign/update/` (`campaign_id`), `POST /adgroup/update/` (`adgroup_id`), `POST /ad/update/` (identifies ads via `creatives[].ad_id`)
- Status: `POST /campaign/status/update/` (`campaign_ids`), `POST /adgroup/status/update/` (`adgroup_ids`), `POST /ad/status/update/` (`ad_ids`) with `operation_status`: `ENABLE`, `DISABLE`, or `DELETE` (max 100 ids per call)

Notes:

- `/campaign/create/` requires `campaign_name` and `objective_type`; `operation_status` defaults to `ENABLE` server-side — this server defaults it to `DISABLE` (paused)
- `/adgroup/create/` requires `campaign_id`, `adgroup_name`, `billing_event`, `budget`, `budget_mode`, `optimization_goal`, `pacing`, `schedule_type`, `schedule_start_time`
- `/ad/create/` requires `adgroup_id` and a `creatives` array; there is no top-level `operation_status`
- `DELETE` via status update is permanent — prefer `DISABLE` (pause)
- There is no validate-only/dry-run mode in the API; this server's dry run previews requests locally

## Error Handling

- Non-zero `code` on HTTP 200 is an API error (message in `message`)
- `code 40100` indicates rate limiting (see the rate limits resource)
- Common auth errors: invalid/expired token, advertiser not authorized for the token
- Budgets and money metrics are denominated in the advertiser account currency (major units)
