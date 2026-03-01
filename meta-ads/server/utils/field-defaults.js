import { invalidParamsError } from './errors.js';

/**
 * Default field projections per query entity.
 */
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
    { creative: ['id', 'name', 'title', 'body', 'image_url', 'video_id'] },
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

/**
 * Supported date presets for insights queries.
 */
export const INSIGHTS_PRESETS = {
  today: { sinceOffsetDays: 0, untilOffsetDays: 0 },
  yesterday: { sinceOffsetDays: -1, untilOffsetDays: -1 },
  last_14d: { sinceOffsetDays: -13, untilOffsetDays: 0 },
  last_7d: { sinceOffsetDays: -6, untilOffsetDays: 0 },
  last_30d: { sinceOffsetDays: -29, untilOffsetDays: 0 },
  this_month: (now) => ({
    since: toIsoDateUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    until: toIsoDateUtc(now)
  }),
  this_week_mon_today: (now) => {
    const day = now.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    return {
      since: toIsoDateUtc(offsetUtcDays(now, -daysSinceMonday)),
      until: toIsoDateUtc(now)
    };
  },
  last_quarter: (now) => {
    const currentQuarter = Math.floor(now.getUTCMonth() / 3);
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const year = currentQuarter === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const startMonth = lastQuarter * 3;

    return {
      since: toIsoDateUtc(new Date(Date.UTC(year, startMonth, 1))),
      until: toIsoDateUtc(new Date(Date.UTC(year, startMonth + 3, 0)))
    };
  }
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
    throw invalidParamsError(`Invalid ${label} date format: ${value}. Expected YYYY-MM-DD`);
  }
}

/**
 * Resolve a date_range preset or explicit range object to { since, until } (UTC date strings).
 * @param {string | { since: string, until: string } | undefined} dateRange
 * @param {Date} [now]
 * @returns {{ since: string, until: string }}
 */
export function resolveInsightsDateRange(dateRange, now = new Date()) {
  if (!dateRange) {
    return resolveInsightsDateRange('last_7d', now);
  }

  if (typeof dateRange === 'string') {
    const presetKey = dateRange.toLowerCase();
    const preset = INSIGHTS_PRESETS[presetKey];
    if (!preset) {
      throw invalidParamsError(`Invalid date_range preset: ${dateRange}. Allowed: ${Object.keys(INSIGHTS_PRESETS).join(', ')}`);
    }

    if (typeof preset === 'function') {
      return preset(now);
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
      throw invalidParamsError('date_range object must include both since and until');
    }

    validateDate(since, 'since');
    validateDate(until, 'until');

    return { since, until };
  }

  throw invalidParamsError('date_range must be a preset string or { since, until } object');
}
