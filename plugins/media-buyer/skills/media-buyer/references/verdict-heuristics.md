# Search Term Verdict Heuristics

Use these when classifying search terms into verdicts. Applies identically to Google and Bing.

## Verdicts

- **NEGATE**: irrelevant or wasteful term — add as negative keyword.
- **PROMOTE**: high-intent term that should become a dedicated keyword.
- **INVESTIGATE**: ambiguous, needs human judgment.
- **KEEP**: aligned and performing acceptably.

## Priority Order

1. Conversion and CPA signal.
2. Semantic relevance to campaign intent.
3. Match type drift severity.
4. Existing exclusion status.
5. Volume and spend significance.

## NEGATE Signals

- Spend above campaign avg CPA with zero conversions. Fallback floor: $25-$50.
- Clear intent mismatch: jobs, free, DIY, used, tutorial, reviews, competitor-only, informational queries when campaign is transactional.
- Location mismatch when campaign targets a different geography.

**Negative match type guidance:**
- `EXACT`: block only a specific phrase.
- `PHRASE`: block the core irrelevant phrase in broader contexts (most common).
- `BROAD`: rarely — only for unambiguously irrelevant single words.

**Level guidance:**
- Ad group level: mismatch scoped to one ad group's theme.
- Campaign level: mismatch applies across the entire campaign.
- Shared negative list: universal exclusions (e.g., "jobs", "free") — recommend via platform UI.

## PROMOTE Signals

- Strong conversion volume but term isn't a managed keyword.
- High commercial intent with repeat conversions.
- Term appears across multiple ad groups — should be centralized.

Recommend exact/phrase variants and target ad group placement.

## INVESTIGATE Signals

- Moderate spend, low volume, no conversions yet.
- Ambiguous intent — may be top-of-funnel discovery.
- Branded or partner terms with unclear strategic value.

Provide a short question for user resolution.

## KEEP

Relevance and efficiency acceptable relative to account goals.

## Cross-Platform Insight

If the same search term appears on both Google and Bing:
- Wastes money on both = higher-confidence NEGATE.
- Converts on one but not the other = platform-specific intent difference worth investigating.

## False-Positive Protections

Before finalizing negatives:
- Compare proposed negatives with top converting keywords to avoid blocking winners.
- Check plural/singular and close-variant collisions.
- Avoid over-broad single-word negatives unless account-level policy supports them.

## N-gram Assist

For high-volume search term sets:
1. Build 2-gram and 3-gram frequency tables.
2. Rank by total spend and zero-conversion spend.
3. Use high-cost recurring grams to accelerate negative mining.

N-gram output informs suggestions — doesn't replace row-level judgment.
