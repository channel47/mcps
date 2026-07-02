# @channel47/tiktok-ads-mcp

MCP server for TikTok Ads using the TikTok for Business API (`v1.3`).

This server exposes four tools expected by channel47 TikTok workflows:

- `list_accounts`
- `query`
- `report`
- `mutate`

## Installation

### Standalone

```bash
npx @channel47/tiktok-ads-mcp@latest
```

### Claude Code

```bash
claude mcp add tiktok-ads --env TIKTOK_ADS_ACCESS_TOKEN=<token> -- npx @channel47/tiktok-ads-mcp@latest
```

Or as JSON config:

```json
{
  "mcpServers": {
    "tiktok-ads": {
      "command": "npx",
      "args": ["@channel47/tiktok-ads-mcp@latest"],
      "env": {
        "TIKTOK_ADS_ACCESS_TOKEN": "<token>",
        "TIKTOK_ADS_ADVERTISER_ID": "<advertiser id>"
      }
    }
  }
}
```

### Monorepo Development

```bash
cd mcps
npm install
npm run test
```

## Getting Credentials

1. Create a developer app at [TikTok for Business Developers](https://business-api.tiktok.com/portal) (Marketing API).
2. Authorize the app against your advertiser account(s) via the app's authorization URL.
3. Exchange the returned `auth_code` for a long-lived access token at `POST /open_api/v1.3/oauth2/access_token/`.
4. Use that token as `TIKTOK_ADS_ACCESS_TOKEN`. The token is sent as the `Access-Token` request header (not `Authorization: Bearer`).

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `TIKTOK_ADS_ACCESS_TOKEN` | TikTok Business API long-lived access token |

### Optional

| Variable | Description |
|----------|-------------|
| `TIKTOK_ADS_ADVERTISER_ID` | Default advertiser ID used when `advertiser_id` is omitted |
| `TIKTOK_ADS_APP_ID` | Developer app ID — only needed so `list_accounts` can discover authorized advertisers via `/oauth2/advertiser/get/` |
| `TIKTOK_ADS_APP_SECRET` | Developer app secret (pairs with `TIKTOK_ADS_APP_ID`) |
| `TIKTOK_ADS_READ_ONLY` | Set to `true` to disable live mutations |
| `TIKTOK_ADS_REQUEST_TIMEOUT_MS` | HTTP request timeout in milliseconds (default `30000`) |

## Tool Reference

### `list_accounts`

List accessible TikTok ad accounts (advertisers).

**Params:**
- `advertiser_ids` (optional): explicit advertiser ids to look up

**Notes:**
- With `TIKTOK_ADS_APP_ID` + `TIKTOK_ADS_APP_SECRET` set, ids are discovered via `GET /oauth2/advertiser/get/`
- Without app credentials, pass `advertiser_ids` or set `TIKTOK_ADS_ADVERTISER_ID`
- Details (name, status, currency, timezone, company, country) come from `GET /advertiser/info/` (batched 100 ids per request)

### `query`

Structured query wrapper for TikTok Business API entities:

- `campaigns` — `GET /campaign/get/`
- `adgroups` — `GET /adgroup/get/`
- `ads` — `GET /ad/get/`

**Params:**
- `entity` (required)
- `advertiser_id` (optional if `TIKTOK_ADS_ADVERTISER_ID` exists)
- `fields`: array or comma-separated string (entity-specific defaults)
- `filtering`: TikTok filtering object, e.g. `{ "campaign_ids": ["123"], "primary_status": "STATUS_DELIVERY_OK" }`
- `limit`: max rows (default `100`, max `1000`); pagination via `page`/`page_size` is handled automatically

### `report`

Synchronous integrated reporting via `GET /report/integrated/get/`.

**Params:**
- `advertiser_id` (optional if `TIKTOK_ADS_ADVERTISER_ID` exists)
- `report_type`: `BASIC` (default) or `AUDIENCE`
- `data_level`: `AUCTION_ADVERTISER`, `AUCTION_CAMPAIGN` (default), `AUCTION_ADGROUP`, `AUCTION_AD`
- `dimensions`: defaults to the data_level id dimension plus `stat_time_day`
- `metrics`: defaults to `spend, impressions, clicks, ctr, cpc, cpm, conversion, cost_per_conversion, conversion_rate`
- `start_date` / `end_date` (`YYYY-MM-DD`, default trailing 7 days UTC) or `lifetime: true`
- `filtering`: array of `{ field_name, filter_type, filter_value }` clauses
- `order_field` / `order_type` (`ASC` / `DESC`)
- `limit`: max rows (default `100`, max `1000`)

Rows are returned with `dimensions` and `metrics` flattened into a single object per row.

### `mutate`

Mutation tool with dry-run safety by default.

**Operation format:**

```json
{
  "entity": "campaign",
  "action": "update",
  "id": "1781234567890",
  "params": {
    "budget": 500
  }
}
```

**Supported entities:** `campaign`, `adgroup`, `ad`

**Supported actions:**
- `create` — `POST /<entity>/create/`; campaign and adgroup creates default `operation_status` to `DISABLE` (paused) — pass explicit `operation_status` to override
- `update` — `POST /<entity>/update/`; `id` maps to `campaign_id`/`adgroup_id`. Ad updates take the full `/ad/update/` body in `params` (ads are identified via `creatives[].ad_id`), so `id` is optional
- `pause` / `enable` / `delete` — `POST /<entity>/status/update/` with `operation_status` `DISABLE` / `ENABLE` / `DELETE`

**Top-level params:**
- `operations` (required)
- `advertiser_id` (optional if `TIKTOK_ADS_ADVERTISER_ID` exists)
- `dry_run` (default `true`)
- `partial_failure` (default `true`)

**Safety notes:**
- TikTok has **no server-side validate-only mode**. `dry_run: true` validates operations locally and returns a preview of the exact requests (method, path, body) without calling the API.
- `delete` is permanent and unrecoverable — prefer `pause`.
- Set `TIKTOK_ADS_READ_ONLY=true` to remove the mutate tool entirely.

## Behavior Notes

- Auth is sent via the `Access-Token` request header
- TikTok returns HTTP `200` with an envelope `{ code, message, request_id, data }`; any non-zero `code` is surfaced as an error including the API code and message
- Complex GET params (`fields`, `filtering`, `dimensions`, `metrics`, `advertiser_ids`) are JSON-encoded into the query string automatically
- API retries once on HTTP `429` or envelope error code `40100` (rate limit), honoring `Retry-After` when present (fallback `60s`)
- Requests are aborted on timeout (default `30000ms`, configurable via `TIKTOK_ADS_REQUEST_TIMEOUT_MS`)
- List endpoints paginate with `page`/`page_size` (`data.page_info.total_page`)

## Development Commands

```bash
cd tiktok-ads
npm test
node server/index.js
```

## License

MIT
