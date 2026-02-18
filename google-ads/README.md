# @channel47/google-ads-mcp

[![npm version](https://badge.fury.io/js/@channel47%2Fgoogle-ads-mcp.svg)](https://www.npmjs.com/package/@channel47/google-ads-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for Google Ads API access via GAQL (Google Ads Query Language). Built by a practitioner managing 25+ ad accounts daily — not a demo.

Part of [Channel 47](https://channel47.dev), the open-source ecosystem of profession plugins for Claude Code. [Get the newsletter](https://channel47.dev/subscribe) for weekly skill breakdowns from production use.

## What It Does

- **List accounts** accessible under your MCC or individual credentials
- **Query anything** with raw GAQL — campaigns, ad groups, keywords, search terms, assets, any resource
- **Mutate entities** — campaigns, ad groups, ads, keywords, budgets, assets with dry-run safety
- **Resources and prompts** — bundled GAQL reference docs and operation templates

## Installation

### For Claude Code Plugin Users

Bundled with the [media-buyer plugin](https://github.com/channel47/channel47). No manual install required.

### Standalone Use

```bash
npx @channel47/google-ads-mcp@latest
```

Or install globally:

```bash
npm install -g @channel47/google-ads-mcp
google-ads-mcp
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Your Google Ads API Developer Token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth 2.0 Refresh Token |

### Optional

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC Account ID (10 digits, no dashes) |
| `GOOGLE_ADS_DEFAULT_CUSTOMER_ID` | Default account ID for queries |

## Tools

### list_accounts

List all accessible Google Ads accounts.

**Returns:** Array of account objects with ID, name, currency, and status.

### query

Execute any GAQL SELECT query. Returns clean JSON results.

**Parameters:**
- `customer_id` (string, optional): Account ID (10 digits, no dashes)
- `query` (string, required): GAQL SELECT query
- `limit` (integer, optional): Max rows to return (default: 100, max: 10000)

**Example:**
```javascript
{
  "customer_id": "1234567890",
  "query": "SELECT campaign.name, campaign.status FROM campaign WHERE campaign.status = 'ENABLED'",
  "limit": 50
}
```

### mutate

Execute write operations using GoogleAdsService.Mutate.

**Parameters:**
- `customer_id` (string, optional): Account ID
- `operations` (array, required): Mutation operations
- `partial_failure` (boolean, optional): Enable partial failure mode (default: true)
- `dry_run` (boolean, optional): Validate without executing (default: true for safety)

**Example:**
```javascript
{
  "customer_id": "1234567890",
  "operations": [
    {
      "campaignOperation": {
        "update": {
          "resourceName": "customers/1234567890/campaigns/123",
          "status": "PAUSED"
        },
        "updateMask": "status"
      }
    }
  ],
  "dry_run": false
}
```

#### Working with Responsive Search Ads (RSAs)

RSAs have two different resource types with different mutability:

| Resource | Entity | Use Case |
|----------|--------|----------|
| `customers/{id}/ads/{ad_id}` | `ad` | Update ad **content** (headlines, descriptions, URLs) |
| `customers/{id}/adGroupAds/{ad_group_id}~{ad_id}` | `ad_group_ad` | Change ad **status** (pause, enable, remove) |

**Update RSA headlines/descriptions** (use `entity: 'ad'`):
```javascript
{
  "operations": [{
    "entity": "ad",
    "operation": "update",
    "resource": {
      "resource_name": "customers/1234567890/ads/9876543210",
      "responsive_search_ad": {
        "headlines": [
          {"text": "New Headline 1"},
          {"text": "New Headline 2"},
          {"text": "New Headline 3"}
        ],
        "descriptions": [
          {"text": "New Description 1"},
          {"text": "New Description 2"}
        ]
      },
      "final_urls": ["https://example.com"]
    }
  }],
  "dry_run": false
}
```

**Change RSA status** (use `entity: 'ad_group_ad'`):
```javascript
{
  "operations": [{
    "entity": "ad_group_ad",
    "operation": "update",
    "resource": {
      "resource_name": "customers/1234567890/adGroupAds/111222333~9876543210",
      "status": "PAUSED"
    }
  }],
  "dry_run": false
}
```

#### Creating Image Assets with File Paths

When creating image assets, you can provide a local file path instead of base64 data:

```javascript
{
  "operations": [{
    "entity": "asset",
    "operation": "create",
    "resource": {
      "name": "My Image Asset",
      "image_file_path": "/path/to/image.png"
    }
  }]
}
```

The server will automatically read the file and convert it to the required base64 format.

#### Creating Campaigns

Campaign creation requires specific fields since Google Ads API v19.2 (September 2025):

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Campaign name |
| `advertising_channel_type` | Yes | Campaign type (SEARCH, DISPLAY, etc.) |
| `campaign_budget` | Yes | Reference to budget resource |
| `bidding strategy` | Yes | One of: `manual_cpc`, `maximize_conversions`, `target_cpa`, etc. |
| `contains_eu_political_advertising` | Auto | Auto-defaults to `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING` |

**Complete campaign creation example:**
```javascript
{
  "operations": [
    // 1. Create budget first (with temp ID for atomic creation)
    {
      "entity": "campaign_budget",
      "operation": "create",
      "resource": {
        "resource_name": "customers/1234567890/campaignBudgets/-1",
        "name": "My Budget",
        "amount_micros": 10000000,
        "delivery_method": "STANDARD"
      }
    },
    // 2. Create campaign referencing the budget
    {
      "entity": "campaign",
      "operation": "create",
      "resource": {
        "name": "My Search Campaign",
        "advertising_channel_type": "SEARCH",
        "status": "PAUSED",
        "campaign_budget": "customers/1234567890/campaignBudgets/-1",
        "manual_cpc": { "enhanced_cpc_enabled": false },
        "network_settings": {
          "target_google_search": true,
          "target_search_network": true
        }
      }
    }
  ],
  "dry_run": false
}
```

**Supported bidding strategies:**
- `manual_cpc` - Manual cost-per-click
- `maximize_conversions` - Maximize conversions
- `maximize_conversion_value` - Maximize conversion value (with optional `target_roas`)
- `target_cpa` - Target cost-per-acquisition
- `target_spend` - Maximize clicks (target spend)
- `target_impression_share` - Target impression share
- `bidding_strategy` - Reference to portfolio bidding strategy

## Development

```bash
git clone https://github.com/channel47/mcps.git
cd mcps
npm install    # workspaces — installs all servers
npm test       # runs all server tests
```

~200 lines of server code. 3 core tools. Dry-run by default. OAuth 2.0 with environment-based credentials.

Pairs with the [media-buyer plugin](https://github.com/channel47/channel47), which adds skills, mutation validation hooks, and GAQL reference docs on top of this server.

## Links

- [Channel 47](https://channel47.dev) — open-source profession plugins for Claude Code
- [Build Notes](https://channel47.dev/subscribe) — weekly skill breakdowns from production use
- [Media Buyer Plugin](https://github.com/channel47/channel47) — the paid-search toolkit this MCP powers
- [NPM Package](https://www.npmjs.com/package/@channel47/google-ads-mcp)
- [Google Ads API](https://developers.google.com/google-ads/api/docs/start) / [GAQL Reference](https://developers.google.com/google-ads/api/docs/query/overview)
- [X](https://x.com/ctrlswing) / [LinkedIn](https://www.linkedin.com/in/jackson-d-9979a7a0/) / [GitHub](https://github.com/channel47)

## License

MIT
