# Pinterest Ads Rate Limits and Quotas

Pinterest enforces per-app, per-user rate limits on REST API v5. Limits are grouped
by endpoint category (for example ads read vs. ads write) and depend on your app's
access level — Trial access has much lower limits than Standard access. Exact
per-category numbers are published at
https://developers.pinterest.com/docs/reference/ratelimits/ and can change; treat
HTTP `429` as the authoritative throttling signal.

## What This MCP Server Does

- Treats HTTP `429` as a throttling signal.
- Reads the `Retry-After` response header when available.
- Falls back to `60` seconds if `Retry-After` is missing or invalid.
- Retries throttled requests once.

## Backoff Behavior

`Retry-After` values may be:

- Integer seconds (for example `7`)
- HTTP date string

The server converts this to milliseconds and sleeps before a single retry.

## Timeout Behavior

- Requests use a default timeout of `30000` ms.
- Override with `PINTEREST_ADS_REQUEST_TIMEOUT_MS` environment variable.
- Timeout errors are surfaced as request failures so callers can retry or degrade gracefully.

## Operational Guidance

- Use `page_size` up to 250 to minimize pagination round trips.
- Set `limit` deliberately on `query` — the server stops paginating once satisfied.
- Batch analytics pulls by passing multiple ids (`campaign_ids`, `ad_group_ids`, `ad_ids`) per call instead of one call per entity.
- Keep `columns` narrow; wide column sets are slower to compute.
- Stagger high-volume jobs across accounts to reduce burst pressure.
- Token refreshes count against OAuth limits — this server caches the access token until ~5 minutes before expiry.
