export const ENTITY_FIELDS = {
  campaigns: [
    'id',
    'name',
    'status',
    'objective',
    'daily_budget',
    'lifetime_budget',
    'buying_type',
    'bid_strategy',
    'effective_status'
  ],
  adsets: [
    'id',
    'name',
    'status',
    'campaign_id',
    'daily_budget',
    'targeting',
    'optimization_goal',
    'billing_event',
    'effective_status'
  ],
  ads: [
    'id',
    'name',
    'status',
    'adset_id',
    'creative{id,name,title,body,image_url,video_id}',
    'effective_status'
  ],
  insights: [
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'cpm',
    'cpc',
    'conversions',
    'cost_per_action_type',
    'frequency',
    'reach',
    'actions'
  ],
  audiences: [
    'id',
    'name',
    'subtype',
    'approximate_count',
    'data_source',
    'delivery_status'
  ],
  creatives: [
    'id',
    'name',
    'title',
    'body',
    'image_url',
    'video_id',
    'object_story_spec'
  ]
};

export const SUPPORTED_ENTITIES = Object.keys(ENTITY_FIELDS);

export const INSIGHTS_PRESETS = {
  today: { sinceOffsetDays: 0, untilOffsetDays: 0 },
  yesterday: { sinceOffsetDays: -1, untilOffsetDays: -1 },
  last_7d: { sinceOffsetDays: -6, untilOffsetDays: 0 },
  last_30d: { sinceOffsetDays: -29, untilOffsetDays: 0 }
};

function toIsoDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function offsetUtcDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function validateDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label} date format: ${value}. Expected YYYY-MM-DD`);
  }
}

export function resolveInsightsDateRange(dateRange, now = new Date()) {
  if (!dateRange) {
    return resolveInsightsDateRange('last_7d', now);
  }

  if (typeof dateRange === 'string') {
    const presetKey = dateRange.toLowerCase();
    const preset = INSIGHTS_PRESETS[presetKey];
    if (!preset) {
      throw new Error(`Invalid date_range preset: ${dateRange}. Allowed: ${Object.keys(INSIGHTS_PRESETS).join(', ')}`);
    }

    return {
      since: toIsoDateUtc(offsetUtcDays(now, preset.sinceOffsetDays)),
      until: toIsoDateUtc(offsetUtcDays(now, preset.untilOffsetDays))
    };
  }

  if (typeof dateRange === 'object') {
    const since = dateRange.since;
    const until = dateRange.until;

    if (!since || !until) {
      throw new Error('date_range object must include both since and until');
    }

    validateDate(since, 'since');
    validateDate(until, 'until');

    return { since, until };
  }

  throw new Error('date_range must be a preset string or { since, until } object');
}
