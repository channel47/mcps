export const PROMPT_TEMPLATES = {
  spend_pacing_check: {
    name: 'spend_pacing_check',
    description: 'Check campaign spend pacing against budgets and recent delivery',
    arguments: [
      {
        name: 'ad_account_id',
        description: 'Pinterest ad account ID',
        required: true
      },
      {
        name: 'start_date',
        description: 'Report start date (YYYY-MM-DD, within the last 90 days)',
        required: true
      },
      {
        name: 'end_date',
        description: 'Report end date (YYYY-MM-DD)',
        required: true
      }
    ],
    template: `Run a spend pacing check for Pinterest ad account {{ad_account_id}} from {{start_date}} to {{end_date}}:

1. Query active campaigns with their daily_spend_cap and lifetime_spend_cap values.
2. Pull campaign-level analytics (SPEND_IN_DOLLAR, IMPRESSION_2, CLICKTHROUGH_2, TOTAL_CONVERSIONS) with DAY granularity.
3. Compare daily spend velocity against spend caps (caps are in micro-currency: 1,000,000 = 1 unit).
4. Flag campaigns underpacing (spend well below cap) and overpacing (near or at cap early in the day).
5. Highlight campaigns spending with weak conversion signals.
6. Return top pacing issues with recommended budget actions.`,
    requiredTools: ['query', 'analytics']
  },
  creative_performance_review: {
    name: 'creative_performance_review',
    description: 'Review ad-level performance and flag fatigued or underperforming Pins',
    arguments: [
      {
        name: 'ad_account_id',
        description: 'Pinterest ad account ID',
        required: true
      },
      {
        name: 'start_date',
        description: 'Report start date (YYYY-MM-DD, within the last 90 days)',
        required: true
      },
      {
        name: 'end_date',
        description: 'Report end date (YYYY-MM-DD)',
        required: true
      }
    ],
    template: `Run a creative performance review for Pinterest ad account {{ad_account_id}} from {{start_date}} to {{end_date}}:

1. Query active ads to collect ad IDs, names, creative types, and parent ad groups.
2. Pull ad-level analytics (SPEND_IN_DOLLAR, IMPRESSION_2, CLICKTHROUGH_2, CTR_2, TOTAL_ENGAGEMENT, TOTAL_CONVERSIONS) with WEEK granularity.
3. Flag ads with declining week-over-week CTR or engagement despite sustained impressions.
4. Group weak performers by ad group and campaign to spot structural issues.
5. Rank creatives to refresh first by wasted spend.
6. Return prioritized creative refresh recommendations with rationale.`,
    requiredTools: ['query', 'analytics']
  },
  account_structure_audit: {
    name: 'account_structure_audit',
    description: 'Audit campaign and ad group structure for objective and budget hygiene',
    arguments: [
      {
        name: 'ad_account_id',
        description: 'Pinterest ad account ID',
        required: true
      }
    ],
    template: `Run an account structure audit for Pinterest ad account {{ad_account_id}}:

1. Query all campaigns (include ACTIVE and PAUSED) with objective_type, spend caps, and status.
2. Query ad groups with budgets, bid strategies, billable events, and targeting summaries.
3. Flag campaigns with mismatched objective_type and ad group billable_event combinations.
4. Identify ad groups without budgets, with overlapping targeting, or stuck in DRAFT status.
5. Check for single-ad ad groups that limit creative rotation.
6. Return a prioritized list of structural fixes with expected impact.`,
    requiredTools: ['query']
  }
};

export function getPromptDefinition(name) {
  return PROMPT_TEMPLATES[name] || null;
}

export function getPromptsList() {
  return Object.values(PROMPT_TEMPLATES).map((prompt) => ({
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments
  }));
}

export function renderPrompt(name, args = {}) {
  const template = PROMPT_TEMPLATES[name];
  if (!template) {
    throw new Error(`Unknown prompt: ${name}. Available prompts: ${Object.keys(PROMPT_TEMPLATES).join(', ')}`);
  }

  const missing = template.arguments
    .filter((argument) => argument.required && !args[argument.name])
    .map((argument) => argument.name);

  if (missing.length > 0) {
    throw new Error(`Missing required arguments for prompt "${name}": ${missing.join(', ')}`);
  }

  let text = template.template;

  for (const argument of template.arguments) {
    const value = args[argument.name] ?? argument.default;
    if (value !== undefined) {
      text = text.replace(new RegExp(`\\{\\{${argument.name}\\}\\}`, 'g'), String(value));
    }
  }

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text
        }
      }
    ]
  };
}
