export const PROMPT_TEMPLATES = {
  spend_pacing_check: {
    name: 'spend_pacing_check',
    description: 'Check campaign pacing against recent spend and budget signals',
    arguments: [
      {
        name: 'advertiser_id',
        description: 'TikTok advertiser ID',
        required: true
      },
      {
        name: 'lookback_days',
        description: 'Number of trailing days to analyze',
        required: false,
        default: '7'
      }
    ],
    template: `Run a spend pacing check for TikTok advertiser {{advertiser_id}} over the last {{lookback_days}} days:

1. Pull campaign-level report rows (spend, impressions, clicks, conversion, cost_per_conversion) with stat_time_day.
2. Pull campaign budgets and budget_mode via query.
3. Compare daily spend velocity to available daily/lifetime budgets.
4. Flag campaigns underpacing and overpacing.
5. Highlight campaigns spending with weak conversion signals.
6. Return top pacing issues and recommended budget actions.`,
    requiredTools: ['query', 'report']
  },
  creative_fatigue_check: {
    name: 'creative_fatigue_check',
    description: 'Check for ad creative fatigue signals and propose refresh priorities',
    arguments: [
      {
        name: 'advertiser_id',
        description: 'TikTok advertiser ID',
        required: true
      },
      {
        name: 'lookback_days',
        description: 'Number of trailing days to analyze',
        required: false,
        default: '14'
      }
    ],
    template: `Run a creative fatigue analysis for TikTok advertiser {{advertiser_id}} using the last {{lookback_days}} days of data:

1. Pull ad-level report rows (spend, impressions, clicks, ctr, conversion) with stat_time_day.
2. Flag ads with declining CTR and rising cost_per_conversion week over week.
3. Group fatigued ads by campaign and ad group.
4. Identify top creatives to refresh first by wasted spend.
5. Return prioritized creative refresh recommendations with rationale.`,
    requiredTools: ['query', 'report']
  },
  account_performance_audit: {
    name: 'account_performance_audit',
    description: 'Audit overall account structure and performance for quick wins',
    arguments: [
      {
        name: 'advertiser_id',
        description: 'TikTok advertiser ID',
        required: true
      },
      {
        name: 'lookback_days',
        description: 'Number of trailing days to analyze',
        required: false,
        default: '30'
      }
    ],
    template: `Run an account performance audit for TikTok advertiser {{advertiser_id}} over the last {{lookback_days}} days:

1. List campaigns, ad groups, and ads with statuses via query.
2. Pull campaign- and adgroup-level report rows (spend, impressions, clicks, ctr, cpc, conversion, cost_per_conversion).
3. Identify paused or rejected entities blocking delivery (secondary_status).
4. Rank campaigns by efficiency (cost_per_conversion) and spend concentration.
5. Flag structural issues (single-ad ad groups, overlapping schedules, exhausted budgets).
6. Return a prioritized list of quick wins with expected impact.`,
    requiredTools: ['query', 'report']
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
