# @channel47/bing-ads-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for Microsoft Advertising (Bing Ads) — read-only campaign metadata and async reporting.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## Features

- OAuth2 refresh-token authentication with in-memory token caching
- `list_accounts` to discover accessible account IDs
- `query` for campaigns, ad groups, keywords, and ads
- `report` for async reporting (submit, poll, download, ZIP extract, CSV parse)
- Static MCP resources and workflow prompts

## Installation

```bash
npm install -g @channel47/bing-ads-mcp
```

Run:

```bash
bing-ads-mcp
```

## Configuration

| Variable | Required |
|----------|----------|
| `BING_ADS_CLIENT_ID` | Yes |
| `BING_ADS_CLIENT_SECRET` | Yes |
| `BING_ADS_REFRESH_TOKEN` | Yes |
| `BING_ADS_DEVELOPER_TOKEN` | Yes |
| `BING_ADS_CUSTOMER_ID` | Yes |
| `BING_ADS_ACCOUNT_ID` | Yes |

## Tools

### list_accounts

List accessible accounts under the configured customer.

**Parameters:**
- `customer_id` (string, optional)

### query

Read entity metadata from Campaign Management.

**Parameters:**
- `entity` (required): `campaigns`, `ad_groups`, `keywords`, or `ads`
- `account_id` (optional)
- `customer_id` (optional)
- `campaign_id` (required for `ad_groups`)
- `ad_group_id` (required for `keywords`, `ads`)
- `campaign_type` (optional, campaigns only)

### report

Generate and parse Microsoft Advertising reports.

**Parameters:**
- `report_type` (required): `campaign`, `ad_group`, `keyword`, `ad`, `search_query`, `account`, or `asset_group`
- `account_id` (optional)
- `customer_id` (optional)
- `columns` (optional string[])
- `date_range` (default: `LastSevenDays`)
- `aggregation` (default: `Daily`)
- `limit` (default: `100`)

## Development

```bash
npm test
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes Newsletter](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [Media Buyer Plugin](https://github.com/channel47/channel47) — the paid-search toolkit this MCP powers
- [GitHub Repository](https://github.com/channel47/mcps/tree/main/bing-ads)

## License

MIT
