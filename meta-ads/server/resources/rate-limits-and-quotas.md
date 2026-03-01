# Meta Ads Rate Limits and Quotas

Meta Ads API enforces usage-based throttling. Limits are not fixed per endpoint; they depend on workload, account state, and system pressure.

## What This MCP Server Does

- Treats HTTP `429` and Graph error codes `17` and `32` as throttling signals.
- Reads `Retry-After` response header when available.
- Falls back to `60` seconds if `Retry-After` is missing or invalid.
- Retries throttled requests once.

## Backoff Behavior

`Retry-After` values may be:

- Integer seconds (for example `7`)
- HTTP date string

The server converts this to milliseconds and sleeps before a single retry.

## Timeout Behavior

- Requests use a default timeout of `30000` ms.
- Override with `META_ADS_REQUEST_TIMEOUT_MS` environment variable.
- Timeout errors are surfaced as request failures so callers can retry or degrade gracefully.

## Operational Guidance

- Keep requested field sets narrow.
- Use `limit` deliberately and paginate only as needed.
- Avoid broad fan-out query loops across many accounts at once.
- Cache read-heavy metadata (account and entity lists) where possible.
- Stagger high-volume jobs to reduce burst pressure.
