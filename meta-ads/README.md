# @channel47/meta-ads-mcp

MCP server for Meta Ads (Facebook + Instagram) using the Graph API (`v25.0`).

This server exposes three tools expected by Channel47 Meta workflows:

- `list_accounts`
- `query`
- `mutate`

## Installation

### Standalone

```bash
npx @channel47/meta-ads-mcp@latest
```

### Monorepo Development

```bash
cd mcps
npm install
npm run test
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `META_ADS_ACCESS_TOKEN` | Meta Graph API access token (long-lived user token or system user token) |

### Optional

| Variable | Description |
|----------|-------------|
| `META_ADS_ACCOUNT_ID` | Default ad account ID used when `account_id` is omitted |
| `META_ADS_READ_ONLY` | Set to `true` to disable live mutations |

## Tool Reference

### `list_accounts`

List accessible ad accounts from `GET /me/adaccounts`.

**Params:**
- `status` (optional): status filter (`ACTIVE`, `DISABLED`, etc.)

**Notes:**
- Account IDs are normalized without `act_` prefix
- Includes raw `account_status` and mapped status text

### `query`

Structured query wrapper for Meta Graph API entities:

- `campaigns`
- `adsets`
- `ads`
- `insights`
- `audiences`
- `creatives`

**Core params:**
- `entity` (required)
- `account_id` (optional if `META_ADS_ACCOUNT_ID` exists)
- `fields`, `filters`, `sort`, `limit`

**Insights params:**
- `date_range`: preset (`today`, `yesterday`, `last_7d`, `last_30d`) or `{ since, until }`
- `level`: `campaign`, `adset`, or `ad`
- `time_increment`: `1`, `7`, `monthly`, etc.

### `mutate`

Mutation tool with dry-run safety by default.

**Operation format:**

```json
{
  "entity": "campaign",
  "action": "update",
  "id": "123456789",
  "params": {
    "daily_budget": "5000"
  }
}
```

**Supported entities:**
- `campaign`
- `adset`
- `ad`
- `audience`

**Supported actions:**
- `create`
- `update`
- `pause`
- `enable`
- `delete`

**Top-level params:**
- `operations` (required)
- `dry_run` (default `true`)
- `partial_failure` (default `true`)

## Behavior Notes

- Auth is sent as Graph query param: `access_token`
- API retries once on:
  - `401 Unauthorized`
  - HTTP `429`
  - Graph error codes `17` and `32`
- Budgets are returned in minor currency units (example: `5000` means `$50.00` USD)

## Development Commands

```bash
cd meta-ads
npm test
node server/index.js
```

## License

MIT
