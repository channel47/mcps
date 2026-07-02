# LinkedIn Ads Rate Limits and Quotas

LinkedIn Marketing API throttling is quota-based: each application has daily application-level and member-level (per token) limits per endpoint. Exact numbers vary by endpoint and program tier and are visible in the LinkedIn Developer Portal under your app's Analytics > Quotas view. Quotas reset daily (midnight UTC).

## What This MCP Server Does

- Treats HTTP `429` as the throttling signal.
- Reads the `Retry-After` response header when available.
- Falls back to `60` seconds if `Retry-After` is missing or invalid.
- Retries throttled requests once.

## Backoff Behavior

`Retry-After` values may be:

- Integer seconds (for example `7`)
- HTTP date string

The server converts this to milliseconds and sleeps before a single retry. If the retry is throttled again, the error is surfaced to the caller.

## Timeout Behavior

- Requests use a default timeout of `30000` ms.
- Override with `LINKEDIN_ADS_REQUEST_TIMEOUT_MS` environment variable.
- Timeout errors are surfaced as request failures so callers can retry or degrade gracefully.

## Operational Guidance

- Keep `fields` projections narrow on analytics calls (max 20 metrics anyway).
- Use `limit` deliberately; every extra page is another quota hit.
- Batch analytics by passing multiple entity IDs in one call instead of one call per entity — but watch URL length (HTTP 414 means split the list).
- Cache read-heavy metadata (account and campaign lists) where possible.
- Stagger high-volume jobs; daily quotas exhaust silently until requests start failing with 429s.
- If you consistently hit quota ceilings, apply for a higher access tier in the LinkedIn Developer Portal.
