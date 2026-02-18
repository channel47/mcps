# Bing Ads MCP Server — Implementation Plan

> `@channel47/bing-ads-mcp` — Microsoft Advertising (Bing Ads) MCP server for Claude Code plugins.
>
> This plan mirrors the architecture of `@channel47/google-ads-mcp` (v1.0.8) and is grounded in the [Microsoft Advertising REST API v13 documentation](https://learn.microsoft.com/en-us/advertising/guides/get-started).

---

## 1. Context

The media-buyer plugin currently bundles `@channel47/google-ads-mcp` via `.mcp.json`. Adding a Bing Ads MCP server extends the plugin to a second ad platform while keeping the same architecture: bundled MCP servers accessed through native Claude tool calls, no SDK wrappers, no pip dependencies.

**Why a separate MCP server (not a combined "ads" server)?**
- Self-contained per platform. Separate auth, separate env vars, separate failure domains.
- Plugins that only need Bing can bundle only Bing.
- Matches the `@channel47/{platform}-mcp` naming convention.
- Smaller blast radius on updates — a Google Ads change never risks breaking Bing.

---

## 2. Microsoft Advertising REST API v13 — Reference

All endpoints below are **production URLs**. Sandbox equivalents use `*.sandbox.bingads.microsoft.com`.

### 2.1 Service Base URLs

| Service | Base URL | Purpose |
|---------|----------|---------|
| Campaign Management | `https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/` | CRUD for campaigns, ad groups, ads, keywords |
| Reporting | `https://reporting.api.bingads.microsoft.com/Reporting/v13/` | Async report generation |
| Customer Management | `https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/` | Account/customer lookup |

Source: [Bing Ads API Web Service Addresses](https://learn.microsoft.com/en-us/advertising/guides/web-service-addresses)

### 2.2 Authentication (OAuth 2.0)

**Token endpoint:**
```
POST https://login.microsoftonline.com/common/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded
```

**Refresh token request:**
```
client_id={BING_ADS_CLIENT_ID}
&scope=https%3A%2F%2Fads.microsoft.com%2Fmsads.manage%20offline_access
&refresh_token={BING_ADS_REFRESH_TOKEN}
&grant_type=refresh_token
&client_secret={BING_ADS_CLIENT_SECRET}
```

**Response:**
```json
{
  "access_token": "eyJ0eX...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "OAAABAAAAiL9Kn..."
}
```

**Critical notes:**
- Scope must include `offline_access` for refresh tokens.
- Microsoft **may rotate refresh tokens** on every use — always store the new `refresh_token` from each response. For a long-running MCP server, keep the latest token in memory.
- `client_secret` is required for web app registrations but not native apps. We'll use web app (confidential client) to avoid device-binding issues.
- Access tokens expire after ~3600 seconds. Cache and refresh proactively.
- Multi-factor authentication is required since June 2022.

Source: [Get access and refresh tokens](https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth-get-tokens)

### 2.3 Common REST Headers

All REST requests require these headers:

```
Authorization: Bearer {access_token}
DeveloperToken: {developer_token}
Content-Type: application/json
```

Campaign Management and Reporting additionally require:
```
CustomerAccountId: {account_id}
CustomerId: {customer_id}
```

**Important:** REST uses `Authorization: Bearer {token}` (not `AuthenticationToken` like SOAP).

Source: [Services Protocol](https://learn.microsoft.com/en-us/advertising/guides/services-protocol)

### 2.4 Campaign Management — Key Endpoints

**Get Campaigns:**
```
POST https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Campaigns/QueryByAccountId
```
```json
{
  "AccountId": 123456789,
  "CampaignType": "Search Shopping",
  "ReturnAdditionalFields": "BidStrategyId"
}
```

Response returns `{ "Campaigns": [...] }` with campaign objects containing Id, Name, Status, BudgetType, DailyBudget, CampaignType, BiddingScheme, etc.

Source: [GetCampaignsByAccountId](https://learn.microsoft.com/en-us/advertising/campaign-management-service/getcampaignsbyaccountid)

**Get Ad Groups:**
```
POST https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/AdGroups/QueryByCampaignId
```

**Get Keywords:**
```
POST https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Keywords/QueryByAdGroupId
```

**Get Ads:**
```
POST https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/Ads/QueryByAdGroupId
```

**Polymorphic types:** Campaign Management uses `"Type"` (capital T, no underscore) as the discriminator field for derived types like BiddingScheme, Setting, and Ad subtypes.

### 2.5 Customer Management — List Accounts

```
POST https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/AccountsInfo/Query
```
```json
{
  "CustomerId": null,
  "OnlyParentAccounts": false
}
```

Response:
```json
{
  "AccountsInfo": [
    {
      "Id": 123456789,
      "Name": "My Account",
      "Number": "F12345AB",
      "AccountLifeCycleStatus": "Active",
      "PauseReason": null
    }
  ]
}
```

Headers: `Authorization`, `DeveloperToken` only (no CustomerAccountId needed).

Source: [GetAccountsInfo](https://learn.microsoft.com/en-us/advertising/customer-management-service/getaccountsinfo)

### 2.6 Reporting — Async Flow

Reporting is a 3-step async process: Submit → Poll → Download.

**Step 1: Submit**
```
POST https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Submit
```
```json
{
  "ReportRequest": {
    "__type": "CampaignPerformanceReportRequest",
    "ReportName": "Campaign Performance",
    "Format": "Csv",
    "FormatVersion": "2.0",
    "ExcludeColumnHeaders": false,
    "ExcludeReportHeader": false,
    "ExcludeReportFooter": false,
    "ReturnOnlyCompleteData": false,
    "Aggregation": "Daily",
    "Columns": [
      "AccountName", "CampaignName", "CampaignId",
      "Impressions", "Clicks", "Ctr", "AverageCpc", "Spend",
      "Conversions", "Revenue"
    ],
    "Scope": {
      "AccountIds": [123456789]
    },
    "Time": {
      "PredefinedTime": "Last7Days"
    }
  }
}
```

Response: `{ "ReportRequestId": "abc123..." }`

**Step 2: Poll**
```
POST https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Poll
```
```json
{
  "ReportRequestId": "abc123..."
}
```

Response:
```json
{
  "ReportRequestStatus": {
    "ReportRequestId": "abc123...",
    "Status": "Success",
    "ReportDownloadUrl": "https://bingads.blob.core.windows.net/reports/abc123.zip"
  }
}
```

Status values: `Pending`, `InProgress`, `Success`, `Error`.

**Step 3: Download**
GET the `ReportDownloadUrl`. Returns a ZIP file containing a CSV. URL **expires after 5 minutes**.

**`__type` discriminator:** Reporting uses `__type` (double underscore) for polymorphic report request types. This is different from Campaign Management's `Type` field.

**Common report types:**
- `CampaignPerformanceReportRequest`
- `AdGroupPerformanceReportRequest`
- `KeywordPerformanceReportRequest`
- `AdPerformanceReportRequest`
- `SearchQueryPerformanceReportRequest`
- `AccountPerformanceReportRequest`
- `AssetGroupPerformanceReportRequest`

Source: [SubmitGenerateReport](https://learn.microsoft.com/en-us/advertising/reporting-service/submitgeneratereport)

### 2.7 Rate Limits

| Service | Limit | Error Code | Window |
|---------|-------|------------|--------|
| Campaign Management | Sliding window | 117 (`CallRateExceeded`) | 60 seconds |
| Reporting | Concurrent requests | 207 (`ConcurrentRequestOverLimit`) | Until previous reports complete |
| Customer Management | Sliding window | 117 (`CallRateExceeded`) | 60 seconds |

Source: [Handle Throttling](https://learn.microsoft.com/en-us/advertising/guides/services-protocol#handle-throttling)

---

## 3. Target Architecture

### 3.1 File Structure

Mirror the Google Ads MCP layout:

```
bing-ads/
├── server/
│   ├── index.js                     # MCP server entry, tool/prompt/resource registration
│   ├── auth.js                      # OAuth2 token management (refresh + cache)
│   ├── http.js                      # Shared HTTP client (fetch wrapper with headers, retries)
│   ├── tools/
│   │   ├── list-accounts.js         # List accessible accounts
│   │   ├── query-campaigns.js       # Get campaigns, ad groups, keywords, ads
│   │   └── report.js                # Submit + poll + download + parse reporting
│   ├── utils/
│   │   ├── response-format.js       # formatSuccess() / formatError() (copy from google-ads)
│   │   ├── validation.js            # validateRequired(), date range helpers
│   │   └── csv-parser.js            # Parse CSV from report ZIP (no external deps)
│   ├── resources/
│   │   ├── index.js                 # MCP resource handlers
│   │   ├── api-reference.md         # Bing Ads REST endpoint reference
│   │   └── report-columns.md        # Available columns per report type
│   └── prompts/
│       └── templates.js             # Prompt templates (health check, search term analysis)
├── test/
│   ├── fixtures.js                  # Mock data
│   ├── auth.test.js
│   ├── list-accounts.test.js
│   ├── query-campaigns.test.js
│   ├── report.test.js
│   └── integration.test.js
├── package.json
├── README.md
├── LICENSE
├── .gitignore
└── .npmignore
```

### 3.2 Environment Variables

```
BING_ADS_CLIENT_ID          # Azure AD app (client) ID
BING_ADS_CLIENT_SECRET       # Azure AD app secret (web app registration)
BING_ADS_REFRESH_TOKEN       # OAuth2 refresh token
BING_ADS_DEVELOPER_TOKEN     # Microsoft Advertising developer token
BING_ADS_CUSTOMER_ID         # Default customer (manager) ID
BING_ADS_ACCOUNT_ID          # Default account ID (optional, can be passed per-call)
```

### 3.3 Package Configuration

```json
{
  "name": "@channel47/bing-ads-mcp",
  "version": "1.0.0",
  "description": "Microsoft Advertising (Bing Ads) MCP Server - Query campaigns and reports via REST API",
  "main": "server/index.js",
  "bin": {
    "bing-ads-mcp": "server/index.js"
  },
  "type": "module",
  "files": [
    "server/**/*.js",
    "server/**/*.md",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test test/*.test.js",
    "prepublishOnly": "npm test"
  },
  "keywords": [
    "mcp", "model-context-protocol", "bing-ads",
    "microsoft-advertising", "analytics", "advertising", "claude"
  ],
  "author": "Channel47",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/channel47/mcps.git",
    "directory": "bing-ads"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Key difference from Google Ads MCP:** Zero platform-specific npm dependencies. Google Ads uses `google-ads-api` (Opteo) and `google-auth-library`. Bing Ads uses raw REST via Node's built-in `fetch` (Node 18+). This is possible because Bing has a proper REST API (Google's is gRPC-based, which is why the Opteo wrapper exists).

---

## 4. Tool Definitions

### 4.1 `list_accounts`

List accessible Microsoft Advertising accounts.

```js
{
  name: 'list_accounts',
  description: 'List all accessible Microsoft Advertising (Bing Ads) accounts. Use this first to find account IDs before running other tools.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer (manager) ID. Uses default from BING_ADS_CUSTOMER_ID if not specified.'
      }
    }
  }
}
```

**Implementation:**
```
POST https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/AccountsInfo/Query
Body: { "CustomerId": null, "OnlyParentAccounts": false }
Headers: Authorization + DeveloperToken only
```

Returns: `[{ id, name, number, status }]`

### 4.2 `query`

Read campaign data — campaigns, ad groups, keywords, ads.

```js
{
  name: 'query',
  description: 'Query Microsoft Advertising campaign data. Supports campaigns, ad_groups, keywords, and ads. Returns clean JSON results. Read-only — no mutations.',
  inputSchema: {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: 'Account ID (uses default if not specified)'
      },
      entity: {
        type: 'string',
        enum: ['campaigns', 'ad_groups', 'keywords', 'ads'],
        description: 'Entity type to query'
      },
      campaign_id: {
        type: 'string',
        description: 'Campaign ID (required for ad_groups, keywords, ads)'
      },
      ad_group_id: {
        type: 'string',
        description: 'Ad group ID (required for keywords, ads)'
      },
      campaign_type: {
        type: 'string',
        description: 'Filter by campaign type: Search, Shopping, DynamicSearchAds, Performance Max, Audience',
        default: 'Search Shopping'
      }
    },
    required: ['entity']
  }
}
```

**Implementation routes:**
| Entity | Endpoint |
|--------|----------|
| campaigns | `POST .../Campaigns/QueryByAccountId` |
| ad_groups | `POST .../AdGroups/QueryByCampaignId` |
| keywords | `POST .../Keywords/QueryByAdGroupId` |
| ads | `POST .../Ads/QueryByAdGroupId` |

### 4.3 `report`

Generate and retrieve performance reports.

```js
{
  name: 'report',
  description: `Generate a Microsoft Advertising performance report. Handles the full async flow: submit, poll, download, and parse.

Supported report types: campaign, ad_group, keyword, ad, search_query, account, asset_group.

Returns parsed CSV data as structured JSON. Report generation is async and may take 5-60 seconds.`,
  inputSchema: {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: 'Account ID (uses default if not specified)'
      },
      report_type: {
        type: 'string',
        enum: ['campaign', 'ad_group', 'keyword', 'ad', 'search_query', 'account', 'asset_group'],
        description: 'Type of performance report'
      },
      columns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Columns to include. Defaults vary by report type.'
      },
      date_range: {
        type: 'string',
        enum: ['Today', 'Yesterday', 'Last7Days', 'Last14Days', 'Last30Days',
               'ThisMonth', 'LastMonth', 'ThisYear'],
        description: 'Predefined date range (default: Last7Days)'
      },
      aggregation: {
        type: 'string',
        enum: ['Summary', 'Daily', 'Weekly', 'Monthly', 'Hourly'],
        description: 'Time aggregation (default: Daily)'
      },
      limit: {
        type: 'integer',
        description: 'Max rows to return from parsed report (default: 100)',
        default: 100
      }
    },
    required: ['report_type']
  }
}
```

**Implementation:**
1. Map `report_type` → `__type` discriminator (e.g., `campaign` → `CampaignPerformanceReportRequest`)
2. Submit to `POST .../GenerateReport/Submit`
3. Poll `POST .../GenerateReport/Poll` every 5 seconds (max 120 seconds timeout)
4. Download ZIP from `ReportDownloadUrl`
5. Extract CSV, parse with custom `csv-parser.js` (no external deps), return as JSON

**Default columns by report type:**

| Report Type | Default Columns |
|-------------|----------------|
| campaign | AccountName, CampaignName, CampaignId, Impressions, Clicks, Ctr, AverageCpc, Spend, Conversions, Revenue |
| ad_group | CampaignName, AdGroupName, AdGroupId, Impressions, Clicks, Ctr, AverageCpc, Spend, Conversions |
| keyword | CampaignName, AdGroupName, Keyword, KeywordId, Impressions, Clicks, Ctr, AverageCpc, Spend, QualityScore |
| search_query | CampaignName, AdGroupName, SearchQuery, Keyword, Impressions, Clicks, Spend |
| account | AccountName, Impressions, Clicks, Ctr, AverageCpc, Spend, Conversions, Revenue |

---

## 5. Implementation Phases

### Phase 1: Auth + HTTP Client + List Accounts

**Files:** `auth.js`, `http.js`, `server/index.js`, `tools/list-accounts.js`, `utils/response-format.js`, `utils/validation.js`, `package.json`

**auth.js core logic:**
```js
// OAuth2 token management
// - Reads env vars on startup
// - Refreshes access token via POST to Microsoft identity endpoint
// - Caches token in memory with expiry tracking
// - Stores latest refresh_token (Microsoft may rotate it)
// - Proactively refreshes when token has < 5 min remaining

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';

let cachedToken = null;
let tokenExpiry = 0;
let currentRefreshToken = process.env.BING_ADS_REFRESH_TOKEN;

export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 300_000) {
    return cachedToken;
  }
  // Refresh...
}
```

**http.js core logic:**
```js
// Shared fetch wrapper
// - Attaches auth headers (Authorization: Bearer, DeveloperToken)
// - Attaches context headers (CustomerAccountId, CustomerId) when provided
// - Handles 401 (refresh token + retry once)
// - Handles 117/CallRateExceeded (wait 60s + retry)
// - Returns parsed JSON response body

export async function bingRequest(url, body, { accountId, customerId } = {}) {
  const token = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'DeveloperToken': process.env.BING_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  };
  if (accountId) headers['CustomerAccountId'] = accountId;
  if (customerId) headers['CustomerId'] = customerId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  // Handle errors...
}
```

**Deliverables:**
- `list_accounts` tool working end-to-end
- Token refresh with rotation handling
- Error formatting matching google-ads patterns
- Tests for auth validation and list accounts

**Estimated complexity:** Medium. Most code is new but follows established patterns.

### Phase 2: Campaign Query Tool

**Files:** `tools/query-campaigns.js`

**Implementation:**
- Route entity types to correct REST endpoints
- Validate required parent IDs (campaign_id for ad_groups, ad_group_id for keywords/ads)
- Flatten nested response objects (BiddingScheme, Settings)
- Handle `"Type"` discriminator fields in response (polymorphic types)

**Deliverables:**
- `query` tool working for all 4 entity types
- Response flattening (similar to google-ads `gaql-query.js` auto-flattening)
- Tests for each entity type

**Estimated complexity:** Medium. Straightforward REST calls, main work is response normalization.

### Phase 3: Reporting Tool

**Files:** `tools/report.js`, `utils/csv-parser.js`

**Implementation:**
- Map report_type → `__type` discriminator string
- Build report request with columns, date range, aggregation, scope
- Submit → Poll loop (5s interval, 120s max timeout)
- Download ZIP via GET
- Extract CSV from ZIP using Node.js `zlib` (stdlib)
- Parse CSV with custom lightweight parser (no papa-parse dependency)
- Return structured JSON through `formatSuccess()`

**`csv-parser.js`:** A minimal CSV parser (~50 lines). Bing reports have consistent formatting: no nested quotes in data columns, optional header/footer rows (controlled by request flags). We set `ExcludeReportHeader: true`, `ExcludeReportFooter: true` for clean CSV.

**ZIP handling:** Use Node.js built-in `zlib.gunzipSync()` — no, Bing returns actual ZIP not gzip. Use a minimal unzip implementation or the `node:zlib` + manual ZIP parsing. Since ZIP local file headers are straightforward for single-file archives (which Bing always returns), we can extract the CSV with ~30 lines of buffer manipulation. Alternatively, use `child_process.execSync('unzip -p -', ...)` but that breaks portability. Best option: use Node.js `node:zlib` `inflateRawSync` after parsing the ZIP local file header.

**Deliverables:**
- `report` tool working end-to-end
- CSV parser tested against sample report data
- ZIP extraction without external dependencies
- Tests for report submission, polling, CSV parsing

**Estimated complexity:** High. The async flow, ZIP extraction, and CSV parsing are the most complex parts of the server.

### Phase 4: Resources + Prompts + Polish

**Files:** `resources/`, `prompts/`, `README.md`

**Resources:**
- `bingads://reference` — API endpoint reference (static markdown)
- `bingads://report-columns` — Available columns per report type (static markdown)

**Prompts (mirror google-ads patterns):**
- `quick_health_check` — Account overview with spend, clicks, conversions
- `search_term_analysis` — Search query report → negate/promote decisions
- `campaign_comparison` — Compare campaign performance across date ranges

**README.md:** Installation, env var setup, tool descriptions, example usage.

**Deliverables:**
- MCP resources and prompts registered
- README with clear setup guide
- All tests passing
- npm publish dry run

**Estimated complexity:** Low. Mostly markdown and boilerplate.

### Phase 5: Integration + Plugin Wiring

**Not in this repo** — done in the `ecosystem/plugins/media-buyer/` repo.

Add to `.mcp.json`:
```json
{
  "google-ads": { ... },
  "bing-ads": {
    "command": "npx",
    "args": ["-y", "@channel47/bing-ads-mcp@latest"],
    "env": {
      "BING_ADS_CLIENT_ID": "${BING_ADS_CLIENT_ID}",
      "BING_ADS_CLIENT_SECRET": "${BING_ADS_CLIENT_SECRET}",
      "BING_ADS_REFRESH_TOKEN": "${BING_ADS_REFRESH_TOKEN}",
      "BING_ADS_DEVELOPER_TOKEN": "${BING_ADS_DEVELOPER_TOKEN}",
      "BING_ADS_CUSTOMER_ID": "${BING_ADS_CUSTOMER_ID}",
      "BING_ADS_ACCOUNT_ID": "${BING_ADS_ACCOUNT_ID}"
    }
  }
}
```

Update `hooks/hooks.json` to intercept `mcp__bing-ads__*` mutation tools if mutations are added later.

Update skill `allowed-tools` frontmatter to include `mcp__bing-ads__*` tools where appropriate.

---

## 6. Key Design Decisions

### 6.1 No Platform-Specific npm Dependencies

Unlike Google Ads MCP (which uses `google-ads-api` because Google's API is gRPC-based), Bing Ads has a full REST API. Node 18+ has built-in `fetch`. The only dependency is `@modelcontextprotocol/sdk`.

This means:
- Faster installs via `npx`
- Smaller package size
- No transitive dependency risk
- Easier to audit

### 6.2 Read-Only First (No Mutations)

v1.0.0 ships with read-only tools: `list_accounts`, `query`, `report`. No create/update/delete operations.

**Rationale:**
- Google Ads MCP mutations required significant safety infrastructure (dry_run default, hook validation)
- The primary use cases (morning briefs, waste detection, search term analysis) are read-heavy
- Mutations can be added in v1.1.0 after the read path is proven stable
- Keeps the initial scope manageable

### 6.3 Report-First Architecture

Unlike Google Ads (which has GAQL for flexible ad-hoc queries), Bing's REST API returns fixed entity shapes. You can't ask "give me campaign spend where status = ENABLED" in one call — you get all campaigns and filter client-side, or you use the Reporting API.

For performance data (impressions, clicks, spend, conversions), the Reporting API is the correct path. The `query` tool handles entity metadata (names, statuses, settings); the `report` tool handles performance metrics.

This is an important architectural distinction from google-ads MCP where a single `query` tool (GAQL) handles both entity data and performance data.

### 6.4 ZIP/CSV Handling Without External Dependencies

Bing reports download as ZIP files containing CSV. Rather than adding `adm-zip` or `papaparse` as dependencies, we'll implement:
- Minimal ZIP extraction (~40 lines) — parse local file header, inflate with `zlib.inflateRawSync`
- Minimal CSV parsing (~50 lines) — split on newlines and commas, handle quoted fields

This keeps the zero-dependency philosophy intact and makes the package tiny.

### 6.5 Token Rotation Handling

Microsoft may issue a new refresh token on every token refresh. The MCP server runs as a long-lived process (spawned by Claude Code on plugin load), so:
- Store latest refresh token in memory
- Log when rotation occurs (to stderr, per MCP protocol)
- If the process restarts, it uses the env var value — the user may need to update it if Microsoft rotated the token during the previous session

For a future enhancement: write rotated tokens to a `.bing-ads-token` file in the plugin's `.local/` directory (Claude Code plugin spec supports `.local/` for per-user state).

---

## 7. Testing Strategy

Mirror `google-ads/` testing patterns:

### Unit Tests
- `auth.test.js` — env var validation, token refresh mocking, rotation handling
- `list-accounts.test.js` — response formatting, error handling
- `query-campaigns.test.js` — entity routing, response flattening, validation
- `report.test.js` — request building, `__type` mapping, CSV parsing, ZIP extraction
- `csv-parser.test.js` — edge cases (quoted commas, empty fields, Unicode)

### Integration Tests
- `integration.test.js` — end-to-end tool calls with mocked HTTP responses
- Test MCP protocol compliance (tool listing, tool execution, error formats)

### Test runner
Node.js built-in `node --test` (same as google-ads). No jest, no mocha.

### Fixtures
Sample API responses and report CSVs stored in `test/fixtures/`:
- `accounts-response.json`
- `campaigns-response.json`
- `sample-report.csv`
- `sample-report.zip` (pre-built for ZIP extraction tests)

---

## 8. Error Handling

### API Errors

Map Bing error codes to MCP error format:

| Bing Error | MCP Error Code | Handling |
|------------|---------------|----------|
| 117 (CallRateExceeded) | InternalError | Auto-retry after 60s, then surface |
| 207 (ConcurrentRequestOverLimit) | InternalError | Wait for previous reports, then retry |
| 401 Unauthorized | InvalidParams | Refresh token, retry once, then surface |
| Invalid account/customer | InvalidParams | Surface with clear message |
| Report generation failed | InternalError | Surface with report request ID for debugging |

### Response Format

Use the same `formatSuccess()` / `formatError()` pattern from google-ads:

```js
// Success
{ success: true, summary: "Found 5 campaigns", data: [...], metadata: { accountId, ... } }

// Error
{ content: [{ type: 'text', text: JSON.stringify({ error, code, details }) }], isError: true }
```

---

## 9. Sequencing & Dependencies

```
Phase 1 (auth + list_accounts)
  ↓
Phase 2 (query campaigns)    ← can start as soon as Phase 1 auth works
  ↓
Phase 3 (reporting)           ← independent of Phase 2, needs Phase 1 auth
  ↓
Phase 4 (resources + polish)  ← after Phase 2 + 3
  ↓
Phase 5 (plugin wiring)       ← after npm publish
```

Phases 2 and 3 can run in parallel once Phase 1 is complete.

**Total estimated effort:** 4-6 focused sessions with an agent (Sonnet recommended for Phases 1-3, Haiku for Phase 4).

---

## 10. Plugin `.mcp.json` After Both Servers

Once `@channel47/bing-ads-mcp` is published, the media-buyer plugin's `.mcp.json` becomes:

```json
{
  "google-ads": {
    "command": "npx",
    "args": ["-y", "@channel47/google-ads-mcp@latest"],
    "env": {
      "GOOGLE_ADS_DEVELOPER_TOKEN": "${GOOGLE_ADS_DEVELOPER_TOKEN}",
      "GOOGLE_ADS_CLIENT_ID": "${GOOGLE_ADS_CLIENT_ID}",
      "GOOGLE_ADS_CLIENT_SECRET": "${GOOGLE_ADS_CLIENT_SECRET}",
      "GOOGLE_ADS_REFRESH_TOKEN": "${GOOGLE_ADS_REFRESH_TOKEN}",
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID": "${GOOGLE_ADS_LOGIN_CUSTOMER_ID}"
    }
  },
  "bing-ads": {
    "command": "npx",
    "args": ["-y", "@channel47/bing-ads-mcp@latest"],
    "env": {
      "BING_ADS_CLIENT_ID": "${BING_ADS_CLIENT_ID}",
      "BING_ADS_CLIENT_SECRET": "${BING_ADS_CLIENT_SECRET}",
      "BING_ADS_REFRESH_TOKEN": "${BING_ADS_REFRESH_TOKEN}",
      "BING_ADS_DEVELOPER_TOKEN": "${BING_ADS_DEVELOPER_TOKEN}",
      "BING_ADS_CUSTOMER_ID": "${BING_ADS_CUSTOMER_ID}",
      "BING_ADS_ACCOUNT_ID": "${BING_ADS_ACCOUNT_ID}"
    }
  }
}
```

Tools appear as:
- `mcp__bing-ads__list_accounts`
- `mcp__bing-ads__query`
- `mcp__bing-ads__report`

No collision with `mcp__google-ads__*` tools. Skills grant access via `allowed-tools: mcp__bing-ads__*`.

---

## 11. Documentation Sources

All implementation details in this plan are grounded in these Microsoft Advertising docs:

| Topic | URL |
|-------|-----|
| Getting Started | https://learn.microsoft.com/en-us/advertising/guides/get-started |
| OAuth2 Tokens | https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth-get-tokens |
| Services Protocol (REST + rate limits) | https://learn.microsoft.com/en-us/advertising/guides/services-protocol |
| GetCampaignsByAccountId (REST) | https://learn.microsoft.com/en-us/advertising/campaign-management-service/getcampaignsbyaccountid |
| GetAccountsInfo (REST) | https://learn.microsoft.com/en-us/advertising/customer-management-service/getaccountsinfo |
| SubmitGenerateReport (REST) | https://learn.microsoft.com/en-us/advertising/reporting-service/submitgeneratereport |
| Campaign Management Service | https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign-management-service-reference |
| Reporting Service | https://learn.microsoft.com/en-us/advertising/reporting-service/reporting-service-reference |
| Report Types | https://learn.microsoft.com/en-us/advertising/guides/report-types |
| Web Service Addresses | https://learn.microsoft.com/en-us/advertising/guides/web-service-addresses |
| Handle Errors & Exceptions | https://learn.microsoft.com/en-us/advertising/guides/handle-service-errors-exceptions |
| MCP SDK (npm) | https://www.npmjs.com/package/@modelcontextprotocol/sdk |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Microsoft rotates refresh tokens silently | Auth breaks on server restart | Store latest token in memory; document the behavior; future: persist to `.local/` |
| ZIP extraction edge cases | Report download fails | Test against real Bing report ZIPs; fallback to simpler report format if needed |
| Rate limits during report polling | Reporting tool appears slow | Exponential backoff (5s, 10s, 20s) instead of fixed 5s polling |
| REST API v13 deprecation | Server breaks | Monitor [Bing Ads API blog](https://techcommunity.microsoft.com/t5/bing-ads-api-blog/bg-p/BingAdsAPIDeveloperBlog); v13 is current stable |
| CSV parsing edge cases (Unicode, encoding) | Garbled report data | Bing reports use UTF-8 BOM; strip BOM before parsing; test with non-ASCII account names |
| No mutation tools in v1 | Users can't make changes via Bing | Acceptable for launch; query+report covers 90% of skill use cases; mutations planned for v1.1 |
