export const PROMPT_TEMPLATES = {
  creative_fatigue_check: {
    name: 'creative_fatigue_check',
    description: 'Check for ad creative fatigue signals and propose refresh priorities',
    arguments: [
      {
        name: 'account_id',
        description: 'Meta ad account ID (without act_ prefix)',
        required: true
      },
      {
        name: 'date_range',
        description: 'Insights date preset (last_7d, last_30d, today, yesterday)',
        required: false,
        default: 'last_7d'
      }
    ],
    template: `Run a creative fatigue analysis for Meta account {{account_id}} using {{date_range}} data:

1. Pull ad-level insights (spend, impressions, clicks, ctr, frequency).
2. Flag ads with high frequency and declining CTR.
3. Group fatigued ads by campaign/ad set.
4. Identify top creatives to refresh first by wasted spend.
5. Return prioritized creative refresh recommendations with rationale.`,
    requiredTools: ['query']
  },
  audience_overlap_check: {
    name: 'audience_overlap_check',
    description: 'Review audience definitions and identify overlap/conflict risk',
    arguments: [
      {
        name: 'account_id',
        description: 'Meta ad account ID (without act_ prefix)',
        required: true
      }
    ],
    template: `Run an audience overlap check for Meta account {{account_id}}:

1. Pull active ad sets with targeting details.
2. Pull custom audiences in the account.
3. Identify segments likely competing in auction (same geo/age/interests/lookalikes).
4. Flag exclusions that are missing and likely to cause overlap.
5. Return concrete audience restructuring suggestions.`,
    requiredTools: ['query']
  },
  spend_pacing_check: {
    name: 'spend_pacing_check',
    description: 'Check pacing against recent spend and budget signals',
    arguments: [
      {
        name: 'account_id',
        description: 'Meta ad account ID (without act_ prefix)',
        required: true
      },
      {
        name: 'date_range',
        description: 'Insights date preset',
        required: false,
        default: 'last_7d'
      }
    ],
    template: `Run a spend pacing check for Meta account {{account_id}} over {{date_range}}:

1. Pull campaign-level insights and budget fields.
2. Compare current spend velocity to available daily/lifetime budgets.
3. Flag campaigns underpacing and overpacing.
4. Highlight campaigns spending with weak conversion signals.
5. Return top pacing issues and recommended budget actions.`,
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
