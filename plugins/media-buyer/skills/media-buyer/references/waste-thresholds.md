# Waste Detection Thresholds & Formulas

Apply these thresholds consistently. Works for both Google and Bing where the data is available.

## Waste Types

### Type 1: Non-converting keywords

- **Threshold**: `cost > 0` AND `conversions = 0` AND `cost >= campaign_avg_cpa` (30d). Fallback: `cost >= $25`.
- **Dollar waste**: direct spend on the keyword.
- **Google**: GAQL query on `keyword_view`. **Bing**: keyword report, filter `Spend > 0 AND Conversions == 0`.

### Type 2: Low quality score keywords spending

- **Threshold**: `quality_score <= 5` AND `cost > $10` (30d).
- **Dollar waste**: `cost * (1 - 1/cpc_multiplier)` using benchmarks QS-to-CPC table.
- **Google**: GAQL with `quality_info.quality_score`. **Bing**: keyword report with `QualityScore` column (may be `"--"` for low-volume).

### Type 3: Display expansion on Search (Google only)

- **Threshold**: `target_content_network = TRUE` on any SEARCH campaign with spend.
- **Dollar waste**: total campaign cost flagged as at-risk. Bing doesn't have this toggle — skip.

### Type 4: Budget-limited campaigns

- **Threshold**: `search_budget_lost_impression_share > 0.10` (Google). For Bing: compare daily spend vs daily budget from campaign query.
- **Dollar waste**: missed opportunity, not direct waste. Estimate: `conversions * (lost_IS / (1 - lost_IS)) * avg_conv_value`.
- **Severity**: HIGH when IS lost > 25%, MEDIUM when 10-25%.

### Type 5: Broad match without negative list coverage

- **Threshold**: campaign has broad-match keywords AND no shared negative keyword list attached.
- **Dollar waste**: total broad-match spend in unprotected campaigns = at-risk amount.
- **Google**: join `keyword_view` (BROAD) with `campaign_shared_set`. **Bing**: keyword query for match type; negative list coverage is manual check.

### Type 6: Single-ad ad groups

- **Threshold**: ad group has exactly 1 ENABLED ad.
- **Dollar waste**: `ad_group_cost * 0.10` (10% CTR lift assumption from benchmarks).
- **Google**: GAQL on `ad_group_ad`. **Bing**: ads query per ad group.

### Type 7: Zero-impression enabled campaigns

- **Threshold**: `status = ENABLED` AND `impressions = 0` over 7 days AND budget > 0.
- **Dollar waste**: none, but operational drag. Severity: INFO.

### Type 8: Non-converting search terms (semantic mismatch)

- **Threshold**: `cost > 0` AND `conversions = 0` AND `cost >= $10` (30d).
- **Dollar waste**: direct spend.
- Semantic mismatch = term is topically unrelated to the ad group's keyword set, not just non-converting.

## Severity Tags

| Dollar Impact (monthly) | Severity |
|--------------------------|----------|
| > $500 | HIGH |
| $100 - $500 | MEDIUM |
| $25 - $100 | LOW |
| < $25 | INFO |

## Remediation Mapping

| Waste Type | Remediation | Automated? |
|------------|------------|------------|
| 1. Non-converting keywords | Pause keyword or reduce bid | Google: mutate. Bing: mutate. |
| 2. Low QS keywords | Improve ad relevance; pause if QS <= 3 | Google: mutate. Bing: mutate. |
| 3. Display on Search | Disable content network | Manual UI (Google only) |
| 4. Budget-limited | Increase budget or reduce waste | Recommendation only |
| 5. Broad without negatives | Add shared negative list | Manual UI |
| 6. Single-ad groups | Create additional RSA variants | Recommendation |
| 7. Zero-impression campaigns | Investigate; pause if abandoned | Google: mutate. Bing: mutate. |
| 8. Non-converting search terms | Add as negative keywords | Google: mutate. Bing: mutate. |

## Total Waste

```
total_waste = sum(finding.dollar_waste for findings where severity != INFO)
```

Report as "Total Estimated Recoverable Waste" with a note that estimates use benchmark assumptions where direct measurement is unavailable.
