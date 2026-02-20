# SPEC: Editorial Status & Disapproval Visibility

**Date:** 2026-02-20
**Version:** 1.2.0 (current) → targeting 1.3.0
**Status:** Draft
**Triggered by:** Microsoft Advertising disapproval email across 4 accounts (Splash Foam, Glabrous Skin, Oricle, X-All Cleaner) that could not be diagnosed via the MCP.

---

## Problem

When ads, keywords, or RSA assets are disapproved by Microsoft Advertising editorial review, the MCP server cannot surface this information. This was discovered during a real incident where 4 accounts had a combined 4 ads disapproved, 11 keywords disapproved, and 23 assets rejected — none of which were visible through the existing `query` or `report` tools.

### Bugs Found

**1. `query` campaigns fails when `campaign_type` is omitted**

- **File:** `server/tools/query-campaigns.js:93`
- **Behavior:** When `campaign_type` is not passed, `DEFAULT_CAMPAIGN_TYPES` (a space-separated string: `"Search Shopping DynamicSearchAds Audience Hotel PerformanceMax App"`) is sent as the `CampaignType` field. The Bing API returns HTTP 400: `"The request message is null."`
- **Root cause:** The Bing Campaign Management API expects `CampaignType` as an array or a specific enum value, not a space-delimited string. The default value format is incorrect.
- **Severity:** Medium — callers must always pass `campaign_type`, requiring multiple calls per account to cover all campaign types.
- **Fix:** Change `DEFAULT_CAMPAIGN_TYPES` to an array and send as `CampaignType` in the format the API expects (likely needs to be sent as separate flags or the endpoint called once per type).

### Gaps Found

**2. No editorial status on ads or keywords**

- **File:** `server/tools/query-campaigns.js:60-86` (`normalizeAd`) and `:50-58` (`normalizeKeyword`)
- **Behavior:** The Bing API returns `EditorialStatus` on both `Ad` and `Keyword` entities (values: `Active`, `ActiveLimited`, `Disapproved`, `Inactive`). The normalizer functions discard this field — only `Status` (Active/Paused/Deleted) is extracted.
- **Impact:** Cannot distinguish between a paused ad and a disapproved ad. Cannot identify which keywords have editorial rejections.

**3. No editorial rejection reasons**

- **Behavior:** Even if `EditorialStatus` were exposed, the *reason* for disapproval (e.g., "Unsubstantiated claims", "Trademark violation") requires a separate API call: `GetEditorialReasonsByIds`.
- **Impact:** Users must log into the Microsoft Advertising UI to see why something was disapproved.

**4. No asset-level status for RSA ads**

- **Behavior:** RSA ads contain `AssetLink` objects for each headline and description. Each `AssetLink` has its own `EditorialStatus` and `DisapprovedText` fields. The current `normalizeAd` function (line 68-73) only extracts `Asset.Text`, discarding the editorial wrapper.
- **Impact:** The email reported 21 rejected assets in the Oricle account. These are individual RSA headlines/descriptions that were rejected, but we can only see their text content, not their approval status.

**5. Reports exclude non-serving entities**

- **Behavior:** Performance reports only return rows for entities that had impressions. Disapproved ads and keywords cannot serve, so they never appear in reports.
- **Impact:** The `report` tool is structurally unable to surface disapproval information. This is expected behavior, not a bug — but it means `report` can never fill this gap.

**6. Parallel sibling tool call failure cascade**

- **Behavior:** When multiple `query` calls are made in parallel and the first fails, all siblings fail with `"Sibling tool call errored"` without attempting execution.
- **Impact:** This is an MCP SDK / Claude client behavior, not a server bug. But it means the campaigns bug (#1) cascades and wastes an entire batch of parallel calls.

---

## Proposed Changes

### Phase 1: Fix campaign_type bug + expose editorial fields (low effort, high value)

#### 1a. Fix `DEFAULT_CAMPAIGN_TYPES`

**File:** `server/tools/query-campaigns.js`

The `CampaignType` parameter for `QueryByAccountId` is a flags enum. The current space-separated string needs to be validated against what the v13 API actually accepts. Options:

- If the API accepts a space-separated string but with different formatting, fix the format.
- If the API requires a single type, remove the default and require `campaign_type` as a mandatory param (breaking change), or make multiple sequential calls internally and merge results.

**Recommended approach:** Make `campaign_type` required for campaigns query. Update the tool description to indicate this. This is simpler and avoids hidden multi-call behavior.

#### 1b. Add `editorial_status` to keyword and ad normalizers

**File:** `server/tools/query-campaigns.js`

```js
// normalizeKeyword — add editorial_status
function normalizeKeyword(keyword) {
  return {
    id: String(keyword?.Id ?? ''),
    text: keyword?.Text ?? '',
    match_type: keyword?.MatchType ?? '',
    status: keyword?.Status ?? '',
    editorial_status: keyword?.EditorialStatus ?? null,
    bid_amount: keyword?.Bid?.Amount ?? null
  };
}

// normalizeAd — add editorial_status
function normalizeAd(ad) {
  const base = {
    id: String(ad?.Id ?? ''),
    type: ad?.Type ?? '',
    status: ad?.Status ?? '',
    editorial_status: ad?.EditorialStatus ?? null,
    final_urls: ad?.FinalUrls ?? []
  };
  // ... rest unchanged
}
```

#### 1c. Add asset-level editorial status for RSA ads

**File:** `server/tools/query-campaigns.js`

```js
// In normalizeAd, change headline/description extraction:
if (ad?.Headlines) {
  base.headlines = ad.Headlines.map((h) => ({
    text: h?.Asset?.Text ?? h?.Text ?? '',
    editorial_status: h?.EditorialStatus ?? null,
    disapproved_text: h?.DisapprovedText ?? null
  }));
}
if (ad?.Descriptions) {
  base.descriptions = ad.Descriptions.map((d) => ({
    text: d?.Asset?.Text ?? d?.Text ?? '',
    editorial_status: d?.EditorialStatus ?? null,
    disapproved_text: d?.DisapprovedText ?? null
  }));
}
```

**Breaking change note:** This changes `headlines` and `descriptions` from `string[]` to `object[]`. Any prompts or downstream consumers that expect plain strings will need updating. Consider adding this behind a flag (`include_editorial: true`) or as a new field (`headline_details` alongside `headlines`).

#### 1d. Request additional fields from the API

**File:** `server/tools/query-campaigns.js`

The `QueryByAdGroupId` endpoint for ads may need `ReturnAdditionalFields` to include editorial data. Verify whether `EditorialStatus` is returned by default or requires:

```js
body: {
  AdGroupId: Number(params.ad_group_id),
  AdTypes: [...],
  ReturnAdditionalFields: 'EditorialApiFaultDetail'
}
```

Same for keywords — check if `ReturnAdditionalFields` is needed.

### Phase 2: Editorial rejection reasons (medium effort, high value)

#### 2a. New tool: `get_editorial_reasons`

Add a new tool that wraps the Bing Ads `GetEditorialReasonsByIds` API operation.

**New file:** `server/tools/editorial.js`

```
Endpoint: CampaignManagement/v13/EditorialReasons/QueryByIds
```

**Tool definition:**

```js
{
  name: 'get_editorial_reasons',
  description: 'Get editorial rejection reasons for disapproved ads or keywords. Returns the specific policy violations and affected countries for each entity.',
  inputSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string' },
      customer_id: { type: 'string' },
      entity_type: {
        type: 'string',
        enum: ['Ad', 'Keyword'],
        description: 'Type of entity to get editorial reasons for'
      },
      entity_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of ad or keyword IDs to check'
      }
    },
    required: ['entity_type', 'entity_ids']
  }
}
```

**API request body:**

```json
{
  "AccountId": 12345,
  "EntityIdToParentIdAssociations": [
    { "EntityId": 111, "ParentId": 222 }
  ],
  "EntityType": "Ad"
}
```

Note: This API requires both the entity ID and its parent ID (ad group ID). The tool should accept this as a pair or look it up internally.

**Response normalization:**

```js
function normalizeEditorialReason(reason) {
  return {
    entity_id: String(reason?.EntityId ?? ''),
    reasons: (reason?.EditorialReasons || []).map(r => ({
      location: r?.Location ?? '',
      countries: r?.PublisherCountries ?? [],
      reason_code: r?.ReasonCode ?? null,
      term: r?.Term ?? ''
    }))
  };
}
```

### Phase 3: Convenience — account-wide disapproval scan (nice to have)

#### 3a. New tool: `scan_disapprovals`

A higher-level convenience tool that walks the account hierarchy and returns all disapproved entities in one call:

1. Query all campaigns (by type)
2. Query all ad groups per campaign
3. Query all ads + keywords per ad group
4. Filter to `editorial_status === 'Disapproved'`
5. Optionally call `get_editorial_reasons` for each

This is expensive (many API calls) but extremely useful for the exact scenario that triggered this spec.

**Tool definition:**

```js
{
  name: 'scan_disapprovals',
  description: 'Scan an entire account for disapproved ads, keywords, and assets. Returns all entities with editorial issues and their rejection reasons. Warning: makes many API calls — use sparingly.',
  inputSchema: {
    type: 'object',
    properties: {
      account_id: { type: 'string' },
      customer_id: { type: 'string' },
      include_reasons: {
        type: 'boolean',
        description: 'Also fetch rejection reasons for each disapproved entity (slower)',
        default: false
      }
    }
  }
}
```

---

## Priority & Effort

| Change | Priority | Effort | Breaking |
|--------|----------|--------|----------|
| 1a. Fix campaign_type bug | **P0** | Small | Potentially (if making required) |
| 1b. Add editorial_status to normalizers | **P0** | Small | No |
| 1c. Asset-level editorial status | **P1** | Small | Yes (headlines/descriptions shape) |
| 1d. Request additional API fields | **P1** | Small | No |
| 2a. `get_editorial_reasons` tool | **P1** | Medium | No (new tool) |
| 3a. `scan_disapprovals` tool | **P2** | Medium | No (new tool) |

---

## Bing Ads API References

- **Campaign Management v13 endpoint:** `https://campaign.api.bingads.microsoft.com/CampaignManagement/v13`
- **GetEditorialReasonsByIds:** `CampaignManagement/v13/EditorialReasons/QueryByIds`
- **Ad.EditorialStatus:** `Active | ActiveLimited | Disapproved | Inactive`
- **Keyword.EditorialStatus:** `Active | ActiveLimited | Disapproved | Inactive`
- **AssetLink fields:** `EditorialStatus`, `DisapprovedText`, `PinnedField`
- **ReturnAdditionalFields for Ads:** May need `EditorialApiFaultDetail` flag

---

## Test Plan

1. **Unit tests for normalizers** — verify `editorial_status` is extracted from mock API responses
2. **Unit test for asset-level extraction** — verify headline/description objects include editorial fields
3. **Integration test for campaign_type fix** — confirm campaigns query works without `campaign_type` param
4. **Unit test for `get_editorial_reasons`** — mock API response, verify normalization
5. **Manual test** — run against the Oricle account (141950365) to verify disapproved items are now visible
