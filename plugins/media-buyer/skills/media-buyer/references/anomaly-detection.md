# Anomaly Detection Formulas

Apply these formulas consistently for daily performance monitoring. Works identically for both Google and Bing — operates on metric values, not platform-specific fields.

## Baseline Windows

Let `yesterday` = current date minus one day.

- **7-day baseline**: days -8 through -2 (excludes yesterday)
- **30-day baseline**: days -31 through -2 (excludes yesterday)

## Deviation Formula

For each metric per campaign:

```
deviation_pct = (yesterday_value - baseline_7d) / baseline_7d
```

If `baseline_7d == 0`, do not compute percentage — mark as "new activity" with raw value.

## Dollar Impact

| Metric | Dollar Impact Formula |
|--------|----------------------|
| Cost | `yesterday_cost - baseline_7d_cost` |
| Conversions | `(baseline_7d_conv - yesterday_conv) * baseline_7d_cpa` |
| CPA | `(yesterday_cpa - baseline_7d_cpa) * yesterday_conv` |
| CTR | Not dollar-denominated — use `deviation_pct` only |

## Threshold Gate

Flag an anomaly only when **both** conditions are met:

1. `abs(deviation_pct) > 0.20`
2. `abs(dollar_impact) > $10`

For CTR: flag when `abs(deviation_pct) > 0.25` (no dollar gate).

## Ranking

Sort all flagged anomalies by `abs(dollar_impact)` descending. Cap at 10 items.

## Direction Labels

| deviation_pct | Label |
|---------------|-------|
| > 0.20 for cost/CPA | Cost spike / CPA spike |
| < -0.20 for cost | Spend drop |
| < -0.20 for conversions | Conversion drop |
| > 0.20 for conversions | Conversion surge |
| < -0.25 for CTR | CTR decline |
| > 0.25 for CTR | CTR surge (positive, usually Watch) |

## Edge Cases

- **New campaigns** (< 7 days data): skip anomaly detection, note "insufficient baseline".
- **Zero baseline**: mark as "new activity" with raw value.
- **Calendar effects**: if yesterday is Monday or holiday-adjacent, note potential weekday bias.
- **Conversion lag**: yesterday's conversions backfill 24-72 hours. Don't flag as Urgent unless the drop also appears in 2-day-old data.
