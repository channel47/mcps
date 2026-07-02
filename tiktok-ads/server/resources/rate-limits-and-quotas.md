# TikTok Ads Rate Limits and Quotas

The TikTok Business API enforces per-app QPS (queries per second) limits. Limits vary by endpoint tier and the access level of your developer app; they are not published as fixed per-endpoint numbers.

## Throttling Signals

- API error `code 40100` ("Too many requests") in the response envelope — usually still HTTP `200`
- HTTP `429` at the transport level

## What This MCP Server Does

- Treats HTTP `429` and envelope error code `40100` as throttling signals.
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
- Override with `TIKTOK_ADS_REQUEST_TIMEOUT_MS` environment variable.
- Timeout errors are surfaced as request failures so callers can retry or degrade gracefully.

## Operational Guidance

- Keep requested field, dimension, and metric sets narrow.
- Use `limit` deliberately and paginate only as needed (`page_size` max 1000).
- Batch id lookups: `/advertiser/info/` accepts up to 100 ids, status updates up to 100 ids per call.
- Avoid broad fan-out query loops across many advertisers at once.
- Cache read-heavy metadata (advertiser and entity lists) where possible.
- Stagger high-volume reporting jobs to reduce burst pressure.
