# Meta Ads Graph API Quick Reference

## Base URL

`https://graph.facebook.com/v25.0`

## Authentication

- Auth is provided via query param: `access_token=<TOKEN>`
- This server reads token from `META_ADS_ACCESS_TOKEN`
- No token refresh flow in v1 (supports long-lived user tokens and system user tokens)

## Account Discovery

- List accounts: `GET /me/adaccounts`
- Suggested fields:
  - `id,name,account_status,currency,timezone_name,business{name}`

## Query Endpoints (by Account)

Use normalized account IDs in tools (`1234567890`) and API paths with `act_` prefix:

- Campaigns: `GET /act_<ACCOUNT_ID>/campaigns`
- Ad sets: `GET /act_<ACCOUNT_ID>/adsets`
- Ads: `GET /act_<ACCOUNT_ID>/ads`
- Insights: `GET /act_<ACCOUNT_ID>/insights`
- Audiences: `GET /act_<ACCOUNT_ID>/customaudiences`
- Creatives: `GET /act_<ACCOUNT_ID>/adcreatives`

Useful query params:

- `fields`: comma-separated field list
- `limit`: up to 1000
- `after`: pagination cursor
- `filtering`: JSON-encoded filter array
- `sort`: sort expression

Insights-only params:

- `time_range`: JSON object (`{ "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" }`)
- `level`: `campaign` | `adset` | `ad`
- `time_increment`: `1`, `7`, `monthly`, etc.

## Mutations

Typical write patterns:

- Create: `POST /act_<ACCOUNT_ID>/<entity_collection>`
- Update: `POST /<OBJECT_ID>`
- Pause/Enable: `POST /<OBJECT_ID>` with `status=PAUSED` or `status=ACTIVE`
- Delete: `DELETE /<OBJECT_ID>`

Supported entity collections in this server:

- Campaign: `campaigns`
- Ad set: `adsets`
- Ad: `ads`
- Audience: `customaudiences`

## Error Handling

Retry strategy in this server:

- Retry once on `401 Unauthorized`
- Retry once on throttling:
  - HTTP `429`
  - Graph error codes `17` or `32`

Error message extraction priority:

1. `payload.error.message`
2. `payload.message`
3. Fallback generic message

## Notes

- Budget values are returned in minor currency units (e.g., `5000` => `$50.00` USD)
- Graph API version is pinned in code (`v25.0`) for predictable behavior
