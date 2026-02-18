# @channel47/bing-ads-mcp

[![npm version](https://badge.fury.io/js/@channel47%2Fbing-ads-mcp.svg)](https://www.npmjs.com/package/@channel47/bing-ads-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for Microsoft Advertising (Bing Ads) via REST API. Query campaigns, pull performance reports, and mutate entities with dry-run safety built in.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## What It Does

- **List accounts** under a customer ID with status and pause reason
- **Query entities** — campaigns, ad groups, keywords, ads with normalized output
- **Pull reports** — campaign, ad group, keyword, ad, search query, account, asset group performance with configurable date ranges and aggregation
- **Mutate entities** — campaigns, ad groups, keywords, ads with dry-run preview and explicit approval

## Installation

### For Claude Code Plugin Users

Bundled with the [media-buyer plugin](https://github.com/channel47/channel47). No manual install required.

### Standalone Use

```bash
npx @channel47/bing-ads-mcp@latest
```

Or install globally:

```bash
npm install -g @channel47/bing-ads-mcp
bing-ads-mcp
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `BING_ADS_DEVELOPER_TOKEN` | Microsoft Advertising API Developer Token |
| `BING_ADS_CLIENT_ID` | OAuth 2.0 Client ID from Azure AD |
| `BING_ADS_REFRESH_TOKEN` | OAuth 2.0 Refresh Token |

### Optional

| Variable | Description |
|----------|-------------|
| `BING_ADS_CLIENT_SECRET` | OAuth 2.0 Client Secret (required for confidential client apps, omit for public client apps) |
| `BING_ADS_CUSTOMER_ID` | Default Customer ID |
| `BING_ADS_ACCOUNT_ID` | Default Account ID |

## Tools

### list_accounts

List all accessible Microsoft Advertising accounts.

**Parameters:**
- `customer_id` (string, optional): Uses default if set

**Returns:** Array of account objects with ID, name, number, status, and pause reason.

### query

Query entity data from Campaign Management API.

**Parameters:**
- `entity` (string, required): `campaigns`, `ad_groups`, `keywords`, or `ads`
- `account_id` (string, optional): Account ID
- `customer_id` (string, optional): Customer ID
- `campaign_id` (string): Required when querying `ad_groups`
- `ad_group_id` (string): Required when querying `keywords` or `ads`
- `campaign_type` (string, optional): Filter campaigns by type

**Example:**
```json
{
  "entity": "campaigns",
  "account_id": "123456789"
}
```

### report

Generate performance reports with configurable date ranges, aggregation, and column selection. Handles the full async lifecycle: submit, poll, download, ZIP extract, CSV parse.

**Parameters:**
- `report_type` (string, required): `campaign`, `ad_group`, `keyword`, `ad`, `search_query`, `account`, or `asset_group`
- `account_id` (string, optional)
- `customer_id` (string, optional)
- `date_range` (string): Predefined range — `Today`, `Yesterday`, `LastSevenDays`, `ThisWeek`, `LastWeek`, `Last14Days`, `Last30Days`, `LastFourWeeks`, `ThisMonth`, `LastMonth`, `LastThreeMonths`, `LastSixMonths`, `ThisYear`, `LastYear` (default: `LastSevenDays`)
- `aggregation` (string, optional): `Summary`, `Daily`, `Weekly`, `Monthly`, or `Hourly` (default: Daily)
- `columns` (array, optional): Custom column list (sensible defaults per report type)
- `limit` (integer, optional): Max rows to return (default: 100)

**Example:**
```json
{
  "report_type": "search_query",
  "account_id": "123456789",
  "date_range": "Last30Days",
  "aggregation": "Summary"
}
```

### mutate

Execute write operations on Microsoft Advertising entities. Dry-run enabled by default.

**Parameters:**
- `operations` (array, required): Mutation operations
- `account_id` (string, optional)
- `customer_id` (string, optional)
- `partial_failure` (boolean, optional): Enable partial failure mode (default: true)
- `dry_run` (boolean, optional): Validate without executing (default: true)

**Supported entities:** campaigns, ad_groups, keywords, ads, negative_keywords

**Supported operations:** create, update, remove

Each operation object has `entity` plus one action key (`create`, `update`, or `remove`) whose value is the payload object.

**Example:**
```json
{
  "operations": [
    {
      "entity": "campaigns",
      "update": {
        "Id": "123456789",
        "Status": "Paused"
      }
    }
  ],
  "dry_run": false
}
```

## Development

```bash
git clone https://github.com/channel47/mcps.git
cd mcps
npm install    # workspaces — installs all servers
npm test       # runs all server tests
```

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [Media Buyer Plugin](https://github.com/channel47/channel47) — the paid-search toolkit this MCP powers
- [NPM Package](https://www.npmjs.com/package/@channel47/bing-ads-mcp)
- [Microsoft Advertising API](https://learn.microsoft.com/en-us/advertising/guides/?view=bingads-13)
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
