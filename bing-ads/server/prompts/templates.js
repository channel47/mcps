export const PROMPT_TEMPLATES = {
  quick_health_check: {
    name: 'quick_health_check',
    description: 'Fast daily account health check using campaign performance metrics',
    arguments: [
      {
        name: 'account_id',
        description: 'Microsoft Advertising account ID',
        required: true
      }
    ],
    template: `Run a Bing Ads quick health check for account {{account_id}}:

1. Pull campaign report for Yesterday and Last7Days.
2. Compare spend, clicks, and conversions for anomalies.
3. Flag campaigns with spend > 0 and conversions = 0.
4. Highlight campaigns with sudden drop in impressions.
5. Return top 3 issues and recommended next action.`,
    requiredTools: ['report', 'query']
  },
  search_term_analysis: {
    name: 'search_term_analysis',
    description: 'Analyze search query report for waste and keyword expansion opportunities',
    arguments: [
      {
        name: 'account_id',
        description: 'Microsoft Advertising account ID',
        required: true
      },
      {
        name: 'date_range',
        description: 'Predefined report date range',
        required: false,
        default: 'Last30Days'
      }
    ],
    template: `Analyze Bing Ads search terms for account {{account_id}} over {{date_range}}:

1. Pull a search_query report.
2. Find high-spend terms with zero conversions.
3. Group waste into negative keyword themes.
4. Identify converting queries that should be promoted to keywords.
5. Output two lists: recommended negatives and recommended additions.`,
    requiredTools: ['report']
  },
  campaign_comparison: {
    name: 'campaign_comparison',
    description: 'Compare campaign performance and prioritize optimization actions',
    arguments: [
      {
        name: 'account_id',
        description: 'Microsoft Advertising account ID',
        required: true
      }
    ],
    template: `Compare Bing Ads campaigns for account {{account_id}}:

1. Pull campaign report for Last7Days and Last30Days.
2. Rank campaigns by spend, conversions, and efficiency.
3. Identify over-spending campaigns with weak conversion rate.
4. Identify high-performing campaigns to scale.
5. Return a prioritized action plan (pause, adjust budget, expand).`,
    requiredTools: ['report', 'query']
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

