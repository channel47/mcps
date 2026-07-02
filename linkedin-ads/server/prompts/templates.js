export const PROMPT_TEMPLATES = {
  spend_pacing_check: {
    name: 'spend_pacing_check',
    description: 'Check campaign spend pacing against budgets and run schedules',
    arguments: [
      {
        name: 'account_id',
        description: 'LinkedIn ad account ID (numeric, without URN prefix)',
        required: true
      },
      {
        name: 'start',
        description: 'Analytics start date (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'end',
        description: 'Analytics end date (YYYY-MM-DD, defaults to today)',
        required: false,
        default: 'today'
      }
    ],
    template: `Run a spend pacing check for LinkedIn ad account {{account_id}} from {{start}} to {{end}}:

1. Pull active campaigns with budget and run schedule fields (query, entity=campaigns, status=ACTIVE).
2. Pull daily spend per campaign (analytics, pivot=CAMPAIGN, time_granularity=DAILY, fields including costInLocalCurrency).
3. Compare spend velocity to dailyBudget/totalBudget and remaining flight time.
4. Flag campaigns underpacing and overpacing with projected end-of-flight totals.
5. Return top pacing issues and recommended budget or schedule actions.`,
    requiredTools: ['query', 'analytics']
  },
  creative_fatigue_check: {
    name: 'creative_fatigue_check',
    description: 'Check for creative fatigue signals and propose refresh priorities',
    arguments: [
      {
        name: 'account_id',
        description: 'LinkedIn ad account ID (numeric, without URN prefix)',
        required: true
      },
      {
        name: 'start',
        description: 'Analytics start date (YYYY-MM-DD)',
        required: true
      }
    ],
    template: `Run a creative fatigue analysis for LinkedIn ad account {{account_id}} starting {{start}}:

1. Pull active campaigns (query, entity=campaigns, status=ACTIVE), then their creatives (query, entity=creatives with campaign_ids).
2. Pull creative-level metrics over time (analytics, pivot=CREATIVE, entity_type=campaign with the active campaign IDs, time_granularity=DAILY, fields=impressions,clicks,costInLocalCurrency,dateRange,pivotValues).
3. Flag creatives with high cumulative impressions and declining click-through trend.
4. Group fatigued creatives by campaign and estimate wasted spend.
5. Return prioritized creative refresh recommendations with rationale.`,
    requiredTools: ['query', 'analytics']
  },
  campaign_performance_audit: {
    name: 'campaign_performance_audit',
    description: 'Audit account performance by campaign group and campaign',
    arguments: [
      {
        name: 'account_id',
        description: 'LinkedIn ad account ID (numeric, without URN prefix)',
        required: true
      },
      {
        name: 'start',
        description: 'Analytics start date (YYYY-MM-DD)',
        required: true
      },
      {
        name: 'end',
        description: 'Analytics end date (YYYY-MM-DD, defaults to today)',
        required: false,
        default: 'today'
      }
    ],
    template: `Run a performance audit for LinkedIn ad account {{account_id}} from {{start}} to {{end}}:

1. Pull campaign groups and campaigns with status and budget fields (query).
2. Pull metrics pivoted by CAMPAIGN_GROUP and by CAMPAIGN (analytics, fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues).
3. Compute CTR, CPC, and cost per conversion for each campaign.
4. Rank campaigns by efficiency and flag spend concentrated in weak performers.
5. Return a prioritized list of scale, fix, and pause recommendations.`,
    requiredTools: ['query', 'analytics']
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
