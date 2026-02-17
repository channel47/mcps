# @channel47/bing-ads-mcp

Microsoft Advertising (Bing Ads) MCP server for read-only campaign and reporting workflows.

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

## Required Environment Variables

- `BING_ADS_CLIENT_ID`
- `BING_ADS_CLIENT_SECRET`
- `BING_ADS_REFRESH_TOKEN`
- `BING_ADS_DEVELOPER_TOKEN`
- `BING_ADS_CUSTOMER_ID`
- `BING_ADS_ACCOUNT_ID`

## Tools

### `list_accounts`

List accessible accounts under the configured customer.

Optional input:

- `customer_id` (string)

### `query`

Read entity metadata from Campaign Management.

Input:

- `entity`: one of `campaigns`, `ad_groups`, `keywords`, `ads`
- `account_id` (optional)
- `customer_id` (optional)
- `campaign_id` (required for `ad_groups`)
- `ad_group_id` (required for `keywords`, `ads`)
- `campaign_type` (optional, campaigns only)

### `report`

Generate and parse Microsoft Advertising reports.

Input:

- `report_type`: one of `campaign`, `ad_group`, `keyword`, `ad`, `search_query`, `account`, `asset_group`
- `account_id` (optional)
- `customer_id` (optional)
- `columns` (optional string[])
- `date_range` (default `LastSevenDays`)
- `aggregation` (default `Daily`)
- `limit` (default `100`)

## Development

```bash
npm test
```

