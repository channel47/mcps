# LinkedIn Ads Analytics Field Reference

Reference for the `analytics` tool, which wraps `GET /rest/adAnalytics?q=analytics`.

## Pivots Supported by This Server

| Pivot | Groups results by |
|-------|--------------------|
| `ACCOUNT` | Ad account |
| `CAMPAIGN_GROUP` | Campaign group |
| `CAMPAIGN` | Campaign |
| `CREATIVE` | Creative |

LinkedIn also offers demographic pivots (e.g. `MEMBER_COMPANY`, `MEMBER_JOB_TITLE`, `MEMBER_INDUSTRY`) which this server does not expose; demographic reporting has extra minimum-audience restrictions and different field availability.

## Time Granularity

| Value | Meaning |
|-------|---------|
| `ALL` | One row per pivot value for the whole date range (default) |
| `DAILY` | One row per pivot value per day |
| `MONTHLY` | One row per pivot value per calendar month |

## Default Fields

If you pass no `fields`, the server requests:

```
impressions, clicks, costInLocalCurrency, externalWebsiteConversions, dateRange, pivotValues
```

`dateRange` and `pivotValues` are dimensional fields (they tell you which slice a row describes); the rest are metrics. LinkedIn allows at most **20 metric fields per call** and returns only `impressions` and `clicks` if you omit the `fields` parameter entirely.

## Commonly Used Metric Fields

| Field | Description |
|-------|-------------|
| `impressions` | Sponsored impressions served |
| `clicks` | Chargeable clicks |
| `costInLocalCurrency` | Spend in the account currency |
| `costInUsd` | Spend converted to USD |
| `externalWebsiteConversions` | Conversions tracked via the Insight Tag |
| `externalWebsitePostClickConversions` | Post-click conversions |
| `externalWebsitePostViewConversions` | Post-view (view-through) conversions |
| `landingPageClicks` | Clicks to the landing page |
| `likes` | Reactions on sponsored content |
| `comments` | Comments on sponsored content |
| `shares` | Shares of sponsored content |
| `follows` | Follows generated |
| `totalEngagements` | All chargeable and free engagements |
| `videoViews` | Video views (2+ continuous seconds or click) |
| `videoCompletions` | Video watched to 97-100% |
| `oneClickLeads` | Leads from Lead Gen Forms |
| `oneClickLeadFormOpens` | Lead Gen Form opens |
| `conversionValueInLocalCurrency` | Value of conversions in account currency |

Derived rates (CTR, CPC, CPM, cost per conversion) are not returned by the API; compute them from the raw fields.

## Practical Limits

- No pagination: responses are capped at 15,000 elements. Narrow the date range, granularity, or entity list if you hit the cap.
- Long entity URN lists can push the request URL past server limits (HTTP 414); split large ID lists across multiple calls.
- Metrics are eventually consistent; very recent data (same day) may still change.
