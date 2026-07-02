# @channel47/pinterest-ads-mcp

MCP server for Pinterest Ads using the Pinterest REST API (`v5`).

This server exposes four tools expected by channel47 Pinterest workflows:

- `list_accounts`
- `query`
- `analytics`
- `mutate`

## Installation

### Standalone

```bash
npx @channel47/pinterest-ads-mcp@latest
```

### Monorepo Development

```bash
cd mcps
npm install
npm run test
```

## Configuration

### Getting Credentials

1. Create an app at [developers.pinterest.com/apps](https://developers.pinterest.com/apps/) and request Standard access for the `ads:read` (and `ads:write` for mutations) scopes.
2. Complete the OAuth authorization-code flow to obtain an access token and refresh token — see [Set up authentication and authorization](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/).
3. Either paste a valid access token into `PINTEREST_ADS_ACCESS_TOKEN`, or configure the client credentials + refresh token and let this server mint access tokens itself.

### Required (one of the two options)

| Variable | Description |
|----------|-------------|
| `PINTEREST_ADS_ACCESS_TOKEN` | Pinterest OAuth access token (sent as `Authorization: Bearer`) |

or all three of:

| Variable | Description |
|----------|-------------|
| `PINTEREST_ADS_CLIENT_ID` | Pinterest app ID |
| `PINTEREST_ADS_CLIENT_SECRET` | Pinterest app secret |
| `PINTEREST_ADS_REFRESH_TOKEN` | OAuth refresh token used to mint access tokens via `POST /v5/oauth/token` |

When both are configured, the refresh-token flow wins. Access tokens are cached in
memory and refreshed about 5 minutes before expiry. Pinterest uses continuous
refresh tokens and may rotate the refresh token on use — the server logs a stderr
warning when that happens because it cannot persist the new value; update
`PINTEREST_ADS_REFRESH_TOKEN` yourself when you see the warning.

### Optional

| Variable | Description |
|----------|-------------|
| `PINTEREST_ADS_AD_ACCOUNT_ID` | Default ad account ID used when `ad_account_id` is omitted |
| `PINTEREST_ADS_READ_ONLY` | Set to `true` to disable live mutations |
| `PINTEREST_ADS_REQUEST_TIMEOUT_MS` | HTTP request timeout in milliseconds (default `30000`) |

### Claude Code

```bash
claude mcp add pinterest-ads \
  --env PINTEREST_ADS_ACCESS_TOKEN=<token> \
  --env PINTEREST_ADS_AD_ACCOUNT_ID=<ad-account-id> \
  -- npx @channel47/pinterest-ads-mcp@latest
```

Or as JSON config:

```json
{
  "mcpServers": {
    "pinterest-ads": {
      "command": "npx",
      "args": ["@channel47/pinterest-ads-mcp@latest"],
      "env": {
        "PINTEREST_ADS_ACCESS_TOKEN": "<token>",
        "PINTEREST_ADS_AD_ACCOUNT_ID": "<ad-account-id>"
      }
    }
  }
}
```

## Tool Reference

### `list_accounts`

List accessible ad accounts from `GET /ad_accounts` with bookmark pagination.

**Params:**
- `include_shared_accounts` (optional): include accounts shared with you (API default `true`)

**Notes:**
- Returns `id`, `name`, `currency`, `country`, `owner_username`, `time_zone`, `permissions`
- Follows bookmark pagination to return all accessible accounts

### `query`

Structured entity reads over:

- `campaigns` — `GET /ad_accounts/{id}/campaigns`
- `ad_groups` — `GET /ad_accounts/{id}/ad_groups`
- `ads` — `GET /ad_accounts/{id}/ads`

**Params:**
- `entity` (required)
- `ad_account_id` (optional if `PINTEREST_ADS_AD_ACCOUNT_ID` exists)
- `entity_statuses`: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DRAFT`, `DELETED_DRAFT` — the API defaults to `ACTIVE, PAUSED`, so pass this to see archived entities
- `campaign_ids` / `ad_group_ids` / `ad_ids`: id filters (each only where the endpoint supports it)
- `order`: `ASCENDING` | `DESCENDING` by ID
- `limit`: rows to return across pages (default `100`, max `1000`; API pages are max `250`)

### `analytics`

Metrics via the v5 analytics endpoints:

- `account` — `GET /ad_accounts/{id}/analytics`
- `campaign` — `GET /ad_accounts/{id}/campaigns/analytics` (requires `campaign_ids`)
- `ad_group` — `GET /ad_accounts/{id}/ad_groups/analytics` (requires `ad_group_ids`)
- `ad` — `GET /ad_accounts/{id}/ads/analytics` (requires `ad_ids`)

**Params:**
- `start_date` / `end_date` (required, `YYYY-MM-DD`): at most 90 days back and a 90-day range
- `level`: `account` (default), `campaign`, `ad_group`, `ad`
- `columns`: defaults to `SPEND_IN_DOLLAR, IMPRESSION_2, CLICKTHROUGH_2, CTR_2, TOTAL_CONVERSIONS` (see the `pinterestads://analytics-columns` resource)
- `granularity`: `TOTAL` (default), `DAY`, `WEEK`, `MONTH`, `HOUR` (`HOUR` no longer returns conversion metrics)
- `click_window_days` / `engagement_window_days` / `view_window_days`: `0, 1, 7, 14, 30, 60`
- `conversion_report_time`: `TIME_OF_AD_ACTION` | `TIME_OF_CONVERSION`
- `reporting_timezone`: `PINTEREST_TIME_ZONE` | `AD_ACCOUNT_TIME_ZONE`

### `mutate`

Mutation tool with dry-run safety by default.

**Operation format:**

```json
{
  "entity": "campaign",
  "action": "update",
  "id": "626735565838",
  "params": {
    "daily_spend_cap": 25000000
  }
}
```

**Supported entities:** `campaign`, `ad_group`, `ad`

**Supported actions:** `create`, `update`, `pause`, `enable`, `archive`

**Top-level params:**
- `operations` (required)
- `dry_run` (default `true`)
- `partial_failure` (default `true`)

**Notes:**
- Pinterest v5 uses bulk-array bodies: creates are `POST /ad_accounts/{id}/{campaigns|ad_groups|ads}` with an array of creation objects; updates and status changes are `PATCH` with an array of `{ id, ...changes }`
- **There is no delete.** `archive` sets `status: ARCHIVED`, which is terminal — archived entities cannot be reactivated
- Pinterest has no server-side validate-only mode, so `dry_run` performs local validation and returns a preview of the exact requests (method, path, body) without calling the API
- Creates default to `status: PAUSED` (pass an explicit `status` to override)
- Required create fields — campaign: `name`, `objective_type`; ad_group: `name`, `campaign_id`, `billable_event`; ad: `ad_group_id`, `pin_id`, `creative_type`
- Money fields (spend caps, budgets, bids) are in micro-currency: `25000000` = 25.00 in the account currency

## Read-Only Mode

Set `PINTEREST_ADS_READ_ONLY=true` to remove the `mutate` tool from the tool list
and block mutate calls entirely. Recommended for reporting-only setups.

## Behavior Notes

- Auth is sent via `Authorization: Bearer <token>` request header
- Retries once on HTTP `429`, using `Retry-After` when available (fallback `60s`)
- Requests abort on timeout (default `30000ms`, configurable via `PINTEREST_ADS_REQUEST_TIMEOUT_MS`)
- Errors surface as `Pinterest Ads API request failed (<status>): <message> [code <n>]`
- Pagination uses `page_size` (max 250) + `bookmark` cursors; responses are `{ items, bookmark }`

## Development Commands

```bash
cd pinterest-ads
npm test
node server/index.js
```

## License

MIT
