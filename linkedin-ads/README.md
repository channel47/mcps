# @channel47/linkedin-ads-mcp

MCP server for LinkedIn Ads using the LinkedIn Marketing API (versioned REST, default `LinkedIn-Version: 202605`).

This server exposes four tools expected by channel47 LinkedIn workflows:

- `list_accounts`
- `query`
- `analytics`
- `mutate`

## Installation

### Standalone

```bash
npx @channel47/linkedin-ads-mcp@latest
```

### Monorepo Development

```bash
cd mcps
npm install
npm run test
```

### Claude Code

```bash
claude mcp add linkedin-ads --env LINKEDIN_ADS_ACCESS_TOKEN=<token> -- npx @channel47/linkedin-ads-mcp@latest
```

Or as JSON config:

```json
{
  "mcpServers": {
    "linkedin-ads": {
      "command": "npx",
      "args": ["@channel47/linkedin-ads-mcp@latest"],
      "env": {
        "LINKEDIN_ADS_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
```

## Getting Credentials

1. Create an app at [developer.linkedin.com](https://developer.linkedin.com/) and associate it with a LinkedIn Company Page.
2. Request access to the **Advertising API** product (approval required).
3. Complete the 3-legged OAuth flow with the `r_ads` scope (read) plus `rw_ads` (mutations) and `r_ads_reporting` (analytics) to obtain a member access token (valid 60 days).
4. Either paste that token into `LINKEDIN_ADS_ACCESS_TOKEN`, or — if your app is enabled for programmatic refresh — supply client ID/secret and the refresh token (valid 1 year) and let the server refresh automatically.

## Configuration

### Required (one of the two auth modes)

| Variable | Description |
|----------|-------------|
| `LINKEDIN_ADS_ACCESS_TOKEN` | Static LinkedIn OAuth access token, used directly |
| `LINKEDIN_ADS_CLIENT_ID` + `LINKEDIN_ADS_CLIENT_SECRET` + `LINKEDIN_ADS_REFRESH_TOKEN` | OAuth refresh flow. When all three are set the server exchanges the refresh token at `https://www.linkedin.com/oauth/v2/accessToken`, caches the access token in memory, and refreshes ~5 minutes before expiry. Takes precedence over the static token. |

### Optional

| Variable | Description |
|----------|-------------|
| `LINKEDIN_ADS_ACCOUNT_ID` | Default ad account ID used when `account_id` is omitted |
| `LINKEDIN_ADS_API_VERSION` | `LinkedIn-Version` header override in `YYYYMM` format (default `202605`) |
| `LINKEDIN_ADS_READ_ONLY` | Set to `true` to disable live mutations |
| `LINKEDIN_ADS_REQUEST_TIMEOUT_MS` | HTTP request timeout in milliseconds (default `30000`) |

## Tool Reference

### `list_accounts`

List accessible ad accounts from `GET /rest/adAccounts?q=search` with cursor (`pageSize`/`pageToken`) pagination.

**Params:**
- `status` (optional): `ACTIVE`, `CANCELED`, `DRAFT`, `PENDING_DELETION`, `REMOVED` — string or array, applied server-side via the search finder
- `type` (optional): `BUSINESS`, `ENTERPRISE`
- `limit` (optional, default 1000)

Returns id, name, status, currency, type, test flag, organization reference, and serving statuses per account.

### `query`

Entity reads for one ad account:

| `entity` | Endpoint | Finder |
|----------|----------|--------|
| `campaigns` | `/rest/adAccounts/{id}/adCampaigns` | `q=search` |
| `campaign_groups` | `/rest/adAccounts/{id}/adCampaignGroups` | `q=search` |
| `creatives` | `/rest/adAccounts/{id}/creatives` | `q=criteria` |

**Params:**
- `entity` (required)
- `account_id` (optional if `LINKEDIN_ADS_ACCOUNT_ID` exists; accepts `123` or `urn:li:sponsoredAccount:123`)
- `status` (optional): e.g. `ACTIVE`, `PAUSED`, `DRAFT`, `ARCHIVED` — for creatives this filters `intendedStatus`
- `campaign_ids` (creatives only): restrict creatives to these campaigns
- `limit` (default 100; creatives paginate at LinkedIn's max page size of 100, others at 1000)

### `analytics`

Metrics from `GET /rest/adAnalytics?q=analytics`.

**Params:**
- `pivot` (required): `ACCOUNT`, `CAMPAIGN_GROUP`, `CAMPAIGN`, `CREATIVE`
- `start` (required) / `end` (optional): `YYYY-MM-DD`; encoded as the Rest.li `dateRange` expression
- `time_granularity`: `ALL` (default), `DAILY`, `MONTHLY`
- `entity_type` (default `account`) + `entity_ids`: plain IDs are converted to sponsored URNs and sent as the matching facet param (`accounts=List(...)`, `campaigns=List(...)`, ...). When omitted, the report is scoped to the account.
- `fields`: defaults to `impressions, clicks, costInLocalCurrency, externalWebsiteConversions, dateRange, pivotValues`

**Notes:**
- LinkedIn allows at most **20 metric fields** per call; the server enforces this.
- adAnalytics has **no pagination** — LinkedIn caps responses at 15,000 elements. Narrow the date range or entity list if you hit the cap.

### `mutate`

Mutation tool with dry-run safety by default.

**Operation format:**

```json
{
  "entity": "campaign",
  "action": "update",
  "id": "123456789",
  "params": {
    "dailyBudget": { "amount": "75", "currencyCode": "USD" }
  }
}
```

**Supported entities:** `campaign`, `campaign_group`, `creative`

**Supported actions:**
- `create` — POST to the entity collection under the account. New entities default to `DRAFT` status (`intendedStatus` for creatives), LinkedIn's safe non-serving state; pass an explicit status to override. The account URN is filled in automatically; creative creates require `params.campaign`.
- `update` — Rest.li partial update: POST to the entity item with `X-RestLi-Method: PARTIAL_UPDATE` and body `{ "patch": { "$set": { ... } } }`
- `pause` / `enable` / `archive` — status shortcuts via partial update (`PAUSED` / `ACTIVE` / `ARCHIVED`; creatives use `intendedStatus`)

**Top-level params:**
- `operations` (required)
- `dry_run` (default `true`): LinkedIn has **no server-side validate-only mode**, so dry run performs local validation and returns a preview of the exact requests (method, path, headers, body) without calling the API
- `partial_failure` (default `true`)

**Safety notes:**
- `archive` is hard to reverse — prefer `pause`.
- Deletion (`PENDING_DELETION`) is deliberately not exposed.
- Creative IDs are URNs (`urn:li:sponsoredCreative:123`); plain numeric IDs are accepted and converted.

## Behavior Notes

- Every request sends `Authorization: Bearer <token>`, `LinkedIn-Version` (default `202605`, override via `LINKEDIN_ADS_API_VERSION`), and `X-Restli-Protocol-Version: 2.0.0`.
- Query strings use Rest.li 2.0 encoding: `List(...)` params keep literal parens/commas with percent-encoded items (`campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123)`), and `dateRange=(start:(year:2026,month:6,day:1),end:(...))` keeps literal structure. `URLSearchParams` is never used for these.
- API retries once on HTTP `429`, using the `Retry-After` header when available (fallback `60s`).
- Requests are aborted on timeout (default `30000ms`, configurable via `LINKEDIN_ADS_REQUEST_TIMEOUT_MS`).
- Created entity IDs are read from the `x-restli-id` response header.
- LinkedIn API versions are supported for roughly one year; bump `LINKEDIN_ADS_API_VERSION` if requests start failing with version errors.

## Read-Only Mode

Set `LINKEDIN_ADS_READ_ONLY=true` to remove the `mutate` tool entirely. Dry runs are unaffected in normal mode; live execution is blocked even if a mutate call slips through.

## Development Commands

```bash
cd linkedin-ads
npm test
node server/index.js
```

## License

MIT
