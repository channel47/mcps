/**
 * Prompt templates for Google Ads MCP Server
 * Each prompt defines a workflow that chains multiple tools together
 */

export const PROMPT_TEMPLATES = {
  // Phase 2 prompt
  quick_health_check: {
    name: 'quick_health_check',
    description: 'Fast daily check on account status',
    arguments: [
      {
        name: 'customer_id',
        description: 'Google Ads account ID (without dashes)',
        required: true
      }
    ],
    template: `Quick health check for Google Ads account {{customer_id}}:

1. Yesterday's spend vs daily average - any anomalies?
2. Any campaigns with $0 spend that should be running?
3. Budget pacing - anything hitting limits early?
4. Any new disapprovals or policy issues?
5. Conversion tracking - are conversions recording normally?

Just flag issues, don't deep-dive unless something's wrong.

To complete this check:
- Use get_performance with date_range YESTERDAY to see yesterday's metrics
- Use budget_pacing to check for campaigns limited by budget
- Compare yesterday's spend to the 7-day average
- Flag any enabled campaigns with zero impressions or spend`,
    requiredTools: ['get_performance', 'budget_pacing']
  },

  // Phase 3 prompt - fully functional
  weekly_account_review: {
    name: 'weekly_account_review',
    description: 'Comprehensive weekly performance review for search and shopping campaigns',
    arguments: [
      {
        name: 'customer_id',
        description: 'Google Ads account ID (without dashes)',
        required: true
      }
    ],
    template: `Run a weekly account review for Google Ads account {{customer_id}}:

1. Start with campaign-level performance for the last 7 days vs prior 7 days
2. Identify the top 3 campaigns by spend and analyze their trend
3. Check search terms report for wasted spend (high cost, no conversions)
4. Review Quality Score distribution - flag any high-spend keywords with QS < 5
5. Check budget pacing - are any campaigns limited?
6. For shopping campaigns, check for product disapprovals
7. Analyze device performance - any major mobile vs desktop differences?
8. Summarize top 3 opportunities and top 3 concerns

Keep the analysis actionable and prioritized by impact.

To complete this review:
- Use get_performance with level=campaign for current and prior period
- Use search_terms_report and find_wasted_spend to identify waste
- Use quality_score_analysis with max_quality_score=5 to find QS issues
- Use budget_pacing to check for limited campaigns
- Use shopping_product_status to check feed health
- Use performance_by_dimension with dimension=device for device analysis`,
    requiredTools: ['get_performance', 'search_terms_report', 'find_wasted_spend', 'quality_score_analysis', 'budget_pacing', 'shopping_product_status', 'performance_by_dimension']
  },

  negative_keyword_mining: {
    name: 'negative_keyword_mining',
    description: 'Find and add negative keywords from search terms data',
    arguments: [
      {
        name: 'customer_id',
        description: 'Google Ads account ID (without dashes)',
        required: true
      },
      {
        name: 'date_range',
        description: 'Date range to analyze',
        required: false,
        default: 'LAST_30_DAYS'
      },
      {
        name: 'min_spend',
        description: 'Minimum spend threshold in dollars',
        required: false,
        default: '20'
      }
    ],
    template: `Analyze search terms for {{customer_id}} over the last {{date_range}}:

1. Pull search terms with spend > \${{min_spend}} and 0 conversions
2. Group them into themes (irrelevant intent, competitor, informational, etc.)
3. Recommend specific negative keywords with appropriate match types
4. Flag any search terms that might be worth adding as keywords instead
5. After I approve, add the negatives at the appropriate level (campaign vs ad group)

Be aggressive on clear waste, conservative on ambiguous terms.`,
    requiredTools: ['search_terms_report', 'find_wasted_spend', 'add_negative_keywords']
  },

  shopping_optimization: {
    name: 'shopping_optimization',
    description: 'Shopping campaign deep-dive and optimization recommendations',
    arguments: [
      {
        name: 'customer_id',
        description: 'Google Ads account ID (without dashes)',
        required: true
      }
    ],
    template: `Deep-dive into Shopping performance for {{customer_id}}:

1. Product-level performance - find winners (high ROAS) and losers (high spend, low return)
2. Check product disapprovals and feed health
3. Analyze by brand and category - where should we increase/decrease investment?
4. Compare to last period - any products trending significantly up or down?
5. Recommend bid adjustments for top 10 products to optimize
6. Identify products with high impressions but low click-through (possible title/image issues)

Focus on actionable changes with clear expected impact.

To complete this analysis:
- Use shopping_performance with segment_by=product_item_id for product-level data
- Use shopping_performance with segment_by=brand for brand analysis
- Use shopping_performance with segment_by=category_l1 for category analysis
- Use shopping_product_status to check for disapprovals and feed issues
- Use get_performance with level=campaign and campaign_types=SHOPPING for overall Shopping performance`,
    requiredTools: ['shopping_performance', 'shopping_product_status', 'get_performance']
  },

  competitive_analysis: {
    name: 'competitive_analysis',
    description: 'Analyze positioning and performance patterns to identify competitive opportunities',
    arguments: [
      {
        name: 'customer_id',
        description: 'Google Ads account ID (without dashes)',
        required: true
      }
    ],
    template: `Run competitive positioning analysis for {{customer_id}}:

1. Identify top campaigns by spend and analyze impression share metrics
2. Analyze top-of-page and absolute top impression rates - where are we losing visibility?
3. Cross-reference with Quality Score - is positioning a bid issue or quality issue?
4. Check hour-of-day and day-of-week performance - are there time windows with better/worse performance?
5. Analyze search impression share loss due to budget vs rank
6. Recommend strategy adjustments based on performance gaps

To complete this analysis:
- Use get_performance with level=campaign including impression share metrics to identify positioning
- Use quality_score_analysis to determine if positioning issues are quality-related vs bid-related
- Use performance_by_dimension with dimension=hour_of_day for time-based patterns
- Use performance_by_dimension with dimension=day_of_week for day-based patterns`,
    requiredTools: ['quality_score_analysis', 'performance_by_dimension', 'get_performance']
  }
};

/**
 * Get prompt definition by name
 * @param {string} name - Prompt name
 * @returns {Object|null} Prompt definition or null if not found
 */
export function getPromptDefinition(name) {
  return PROMPT_TEMPLATES[name] || null;
}

/**
 * Render a prompt template with provided arguments
 * @param {string} name - Prompt name
 * @param {Object} args - Arguments to substitute
 * @returns {Object} Rendered prompt with messages array
 */
export function renderPrompt(name, args = {}) {
  const promptDef = PROMPT_TEMPLATES[name];

  if (!promptDef) {
    throw new Error(`Unknown prompt: ${name}. Available prompts: ${Object.keys(PROMPT_TEMPLATES).join(', ')}`);
  }

  // Check required arguments
  const missingArgs = promptDef.arguments
    .filter(arg => arg.required && !args[arg.name])
    .map(arg => arg.name);

  if (missingArgs.length > 0) {
    throw new Error(`Missing required arguments for prompt "${name}": ${missingArgs.join(', ')}`);
  }

  // Start with template
  let rendered = promptDef.template;

  // Substitute provided arguments
  for (const [key, value] of Object.entries(args)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Apply defaults for remaining placeholders
  promptDef.arguments.forEach(arg => {
    if (arg.default !== undefined) {
      rendered = rendered.replace(new RegExp(`\\{\\{${arg.name}\\}\\}`, 'g'), arg.default);
    }
  });

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: rendered
        }
      }
    ]
  };
}

/**
 * Get all available prompts for listing
 * @returns {Array} Array of prompt definitions for MCP
 */
export function getPromptsList() {
  return Object.values(PROMPT_TEMPLATES).map(prompt => ({
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments
  }));
}
