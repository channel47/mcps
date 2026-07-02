# LinkedIn Marketing API Reference

LinkedIn Ads uses the versioned REST API at `https://api.linkedin.com/rest`. Every request needs three headers:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <access token>` |
| `LinkedIn-Version` | `YYYYMM` (this server defaults to `202605`, override via `LINKEDIN_ADS_API_VERSION`) |
| `X-Restli-Protocol-Version` | `2.0.0` |

API versions are released monthly and supported for roughly one year. If requests start failing with version errors, set `LINKEDIN_ADS_API_VERSION` to a newer `YYYYMM` value.

## Rest.li 2.0 Query Encoding

Structured query parameters are NOT standard URL encoding:

- List parameters: `campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123,urn%3Ali%3AsponsoredCampaign%3A456)` — the `List(` wrapper, commas, and parens are literal; each item (URNs included) is percent-encoded.
- Date ranges: `dateRange=(start:(year:2026,month:6,day:1),end:(year:2026,month:6,day:30))` — parens, colons, and commas literal; no leading zeros.
- Finder search filters: `search=(status:(values:List(ACTIVE,PAUSED)))`.

Never run these through `URLSearchParams`; it would percent-encode the structural characters and break the request.

## Core Endpoints Used by This Server

### Ad Accounts

```
GET /rest/adAccounts?q=search&pageSize=1000
GET /rest/adAccounts?q=search&search=(status:(values:List(ACTIVE)),type:(values:List(BUSINESS)))
```

- Cursor pagination: pass `pageSize` (max 1000) and the `pageToken` from the previous response's `metadata.nextPageToken`.
- Account statuses: `ACTIVE`, `CANCELED`, `DRAFT`, `PENDING_DELETION`, `REMOVED`.
- Account types: `BUSINESS`, `ENTERPRISE`.

### Campaign Groups and Campaigns

```
GET /rest/adAccounts/{accountId}/adCampaignGroups?q=search
GET /rest/adAccounts/{accountId}/adCampaigns?q=search&search=(status:(values:List(ACTIVE)))
POST /rest/adAccounts/{accountId}/adCampaigns            (create; 201 + id in x-restli-id header)
POST /rest/adAccounts/{accountId}/adCampaigns/{id}       (partial update; see below)
```

- Campaign statuses: `ACTIVE`, `PAUSED`, `ARCHIVED`, `COMPLETED`, `CANCELED`, `DRAFT`, `PENDING_DELETION`, `REMOVED`.
- Same finder/pagination pattern as adAccounts (`pageSize` max 1000).

### Creatives

```
GET /rest/adAccounts/{accountId}/creatives?q=criteria&intendedStatuses=List(ACTIVE)&campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123)
POST /rest/adAccounts/{accountId}/creatives              (create; id URN in x-restli-id header)
POST /rest/adAccounts/{accountId}/creatives/{encodedUrn} (partial update)
```

- Creatives use the `criteria` finder with top-level List params, not a `search` expression.
- `pageSize` max is 100 for creatives.
- Creative IDs are URNs (`urn:li:sponsoredCreative:123`) and must be percent-encoded in resource paths.
- Creative status lives in `intendedStatus`; actual delivery state is reflected by `isServing` / `servingHoldReasons`.

### Partial Updates

Updates and status changes use Rest.li partial update: POST to the entity item with header `X-RestLi-Method: PARTIAL_UPDATE` and body:

```json
{ "patch": { "$set": { "status": "PAUSED" } } }
```

A successful partial update returns `204 No Content`.

### Analytics

```
GET /rest/adAnalytics?q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:2026,month:6,day:1))&timeGranularity=DAILY&campaigns=List(urn%3Ali%3AsponsoredCampaign%3A123)&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues
```

- No pagination; responses are capped at 15,000 elements.
- At most 20 metric fields per call.
- Very long URN lists can exceed URL length limits (HTTP 414); split entity lists across calls if needed.

## Response Envelope

Finder responses return:

```json
{
  "elements": [ ... ],
  "metadata": { "nextPageToken": "..." },
  "paging": { ... }
}
```

Error responses include `status`, `code`/`serviceErrorCode`, and `message` fields.

## Auth

- Static token: `LINKEDIN_ADS_ACCESS_TOKEN` (60-day member tokens from the 3-legged OAuth flow).
- Programmatic refresh: POST `https://www.linkedin.com/oauth/v2/accessToken` (form-encoded) with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`. Refresh tokens last one year from issuance and are not extended by refreshing.
