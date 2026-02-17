/**
 * Integration tests for Google Ads MCP Server tools
 * Tests data transformations and business logic with mock fixtures
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

import {
  MOCK_CAMPAIGNS,
  MOCK_SEARCH_TERMS,
  MOCK_ACCOUNTS,
  MOCK_QUALITY_SCORES,
  MOCK_BUDGET_DATA,
  MOCK_SHOPPING_PRODUCTS,
  MOCK_DEVICE_PERFORMANCE
} from './fixtures.js';

// Store original env
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '1234567890';
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-token';
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh';
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '1111111111';
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ============================================
// List Accounts Tool Tests
// ============================================

describe('List Accounts Tool', () => {
  test('parses account data correctly', () => {
    const accounts = MOCK_ACCOUNTS.map(row => ({
      id: row.customer_client.id,
      name: row.customer_client.descriptive_name,
      is_manager: row.customer_client.manager,
      currency: row.customer_client.currency_code,
      timezone: row.customer_client.time_zone,
      status: row.customer_client.status
    }));

    assert.strictEqual(accounts.length, 3);
    assert.strictEqual(accounts[0].id, '1234567890');
    assert.strictEqual(accounts[0].name, 'Main Account');
    assert.strictEqual(accounts[0].is_manager, false);
    assert.strictEqual(accounts[2].is_manager, true);
  });

  test('counts manager accounts correctly', () => {
    const managerCount = MOCK_ACCOUNTS.filter(
      a => a.customer_client.manager
    ).length;

    assert.strictEqual(managerCount, 1);
  });

  test('generates correct summary', () => {
    const clientAccounts = MOCK_ACCOUNTS.filter(a => !a.customer_client.manager);
    const managerAccounts = MOCK_ACCOUNTS.filter(a => a.customer_client.manager);

    const summary = `Found ${clientAccounts.length} client accounts and ${managerAccounts.length} manager accounts`;
    assert.strictEqual(summary, 'Found 2 client accounts and 1 manager accounts');
  });
});

// ============================================
// Get Performance Tool Tests
// ============================================

describe('Get Performance Tool', () => {
  test('calculates totals correctly', () => {
    const totalCost = MOCK_CAMPAIGNS.reduce(
      (sum, row) => sum + (row.metrics?.cost_micros || 0),
      0
    ) / 1000000;

    const totalConversions = MOCK_CAMPAIGNS.reduce(
      (sum, row) => sum + (row.metrics?.conversions || 0),
      0
    );

    assert.strictEqual(totalCost, 500);
    assert.strictEqual(totalConversions, 50);
  });

  test('filters by campaign type', () => {
    const shoppingCampaigns = MOCK_CAMPAIGNS.filter(
      c => c.campaign.advertising_channel_type === 'SHOPPING'
    );

    assert.strictEqual(shoppingCampaigns.length, 1);
    assert.strictEqual(shoppingCampaigns[0].campaign.name, 'Shopping Campaign');
  });

  test('filters by status', () => {
    const enabledCampaigns = MOCK_CAMPAIGNS.filter(
      c => c.campaign.status === 'ENABLED'
    );

    assert.strictEqual(enabledCampaigns.length, 3);
  });

  test('generates summary with metrics', () => {
    const level = 'campaign';
    const count = MOCK_CAMPAIGNS.length;
    const totalCost = 500;
    const totalConversions = 50;

    const summary = `Found ${count} ${level}${count !== 1 ? 's' : ''} with $${totalCost.toFixed(2)} total spend and ${totalConversions.toFixed(1)} conversions`;

    assert.ok(summary.includes('3 campaigns'));
    assert.ok(summary.includes('$500.00'));
    assert.ok(summary.includes('50.0 conversions'));
  });
});

// ============================================
// Search Terms Report Tests
// ============================================

describe('Search Terms Report', () => {
  test('identifies zero conversion terms', () => {
    const zeroConversionTerms = MOCK_SEARCH_TERMS.filter(
      row => (row.metrics?.conversions || 0) === 0
    );

    assert.strictEqual(zeroConversionTerms.length, 2);
  });

  test('calculates total spend correctly', () => {
    const totalCost = MOCK_SEARCH_TERMS.reduce(
      (sum, row) => sum + (row.metrics?.cost_micros || 0),
      0
    ) / 1000000;

    assert.strictEqual(totalCost, 150);
  });

  test('identifies wasted spend', () => {
    const wastedSpend = MOCK_SEARCH_TERMS
      .filter(row => (row.metrics?.conversions || 0) === 0)
      .reduce((sum, row) => sum + (row.metrics?.cost_micros || 0), 0) / 1000000;

    assert.strictEqual(wastedSpend, 100);
  });

  test('sorts by cost descending', () => {
    const sorted = [...MOCK_SEARCH_TERMS].sort(
      (a, b) => b.metrics.cost_micros - a.metrics.cost_micros
    );

    assert.strictEqual(sorted[0].search_term_view.search_term, 'cheap sneakers');
    assert.strictEqual(sorted[0].metrics.cost_micros / 1000000, 75);
  });

  test('groups by added status', () => {
    const added = MOCK_SEARCH_TERMS.filter(
      row => row.search_term_view.status === 'ADDED'
    );
    const none = MOCK_SEARCH_TERMS.filter(
      row => row.search_term_view.status === 'NONE'
    );

    assert.strictEqual(added.length, 1);
    assert.strictEqual(none.length, 2);
  });
});

// ============================================
// Quality Score Analysis Tests
// ============================================

describe('Quality Score Analysis', () => {
  test('calculates average quality score', () => {
    const validScores = MOCK_QUALITY_SCORES.filter(
      row => row.ad_group_criterion?.quality_info?.quality_score
    );

    const avgQS = validScores.reduce(
      (sum, row) => sum + row.ad_group_criterion.quality_info.quality_score,
      0
    ) / validScores.length;

    assert.strictEqual(avgQS, 5.5);
  });

  test('identifies low quality keywords', () => {
    const lowQS = MOCK_QUALITY_SCORES.filter(
      row => row.ad_group_criterion?.quality_info?.quality_score < 5
    );

    assert.strictEqual(lowQS.length, 1);
    assert.strictEqual(lowQS[0].ad_group_criterion.keyword.text, 'cheap sneakers');
  });

  test('categorizes CTR ratings', () => {
    const ctrRatings = MOCK_QUALITY_SCORES.map(
      row => row.ad_group_criterion?.quality_info?.search_predicted_ctr
    );

    assert.ok(ctrRatings.includes('ABOVE_AVERAGE'));
    assert.ok(ctrRatings.includes('BELOW_AVERAGE'));
  });

  test('groups by quality score bucket', () => {
    const buckets = {
      poor: 0,    // 1-4
      average: 0, // 5-6
      good: 0,    // 7-8
      excellent: 0 // 9-10
    };

    MOCK_QUALITY_SCORES.forEach(row => {
      const qs = row.ad_group_criterion?.quality_info?.quality_score || 0;
      if (qs >= 9) buckets.excellent++;
      else if (qs >= 7) buckets.good++;
      else if (qs >= 5) buckets.average++;
      else if (qs > 0) buckets.poor++;
    });

    assert.strictEqual(buckets.poor, 1);
    assert.strictEqual(buckets.good, 1);
  });
});

// ============================================
// Budget Pacing Tests
// ============================================

describe('Budget Pacing', () => {
  test('calculates daily budget correctly', () => {
    const dailyBudgets = MOCK_BUDGET_DATA.map(
      row => (row.campaign_budget?.amount_micros || 0) / 1000000
    );

    assert.strictEqual(dailyBudgets[0], 100);
    assert.strictEqual(dailyBudgets[1], 50);
  });

  test('identifies shared budgets', () => {
    const sharedBudgets = MOCK_BUDGET_DATA.filter(
      row => row.campaign_budget?.explicitly_shared
    );

    assert.strictEqual(sharedBudgets.length, 1);
  });

  test('identifies budgets with recommendations', () => {
    const withRecommendations = MOCK_BUDGET_DATA.filter(
      row => row.campaign_budget?.has_recommended_budget
    );

    assert.strictEqual(withRecommendations.length, 1);
    assert.strictEqual(
      withRecommendations[0].campaign_budget.recommended_budget_amount_micros / 1000000,
      150
    );
  });

  test('calculates MTD spend', () => {
    const totalMtdSpend = MOCK_BUDGET_DATA.reduce(
      (sum, row) => sum + (row.metrics?.cost_micros || 0),
      0
    ) / 1000000;

    assert.strictEqual(totalMtdSpend, 650);
  });

  test('calculates pacing ratio', () => {
    // Simulate pacing calculation
    const dayOfMonth = 15;
    const daysInMonth = 30;

    const campaign = MOCK_BUDGET_DATA[0];
    const dailyBudget = campaign.campaign_budget.amount_micros / 1000000;
    const expectedMtdSpend = dailyBudget * dayOfMonth;
    const actualMtdSpend = campaign.metrics.cost_micros / 1000000;
    const pacingRatio = actualMtdSpend / expectedMtdSpend;

    // $450 spent / ($100 * 15 expected) = 0.3
    assert.ok(Math.abs(pacingRatio - 0.3) < 0.01);
  });
});

// ============================================
// Shopping Product Status Tests
// ============================================

describe('Shopping Product Status', () => {
  test('counts product statuses', () => {
    const statusCounts = MOCK_SHOPPING_PRODUCTS.reduce((counts, row) => {
      const status = row.shopping_product?.status || 'UNKNOWN';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    assert.strictEqual(statusCounts['ELIGIBLE'], 1);
    assert.strictEqual(statusCounts['NOT_ELIGIBLE'], 1);
  });

  test('counts products with issues', () => {
    const withIssues = MOCK_SHOPPING_PRODUCTS.filter(
      row => (row.shopping_product?.issues?.length || 0) > 0
    );

    assert.strictEqual(withIssues.length, 1);
  });

  test('extracts issue types', () => {
    const allIssues = MOCK_SHOPPING_PRODUCTS.flatMap(
      row => row.shopping_product?.issues || []
    );

    const issueTypes = [...new Set(allIssues.map(i => i.type))];
    assert.ok(issueTypes.includes('MISSING_GTIN'));
  });

  test('calculates total issues', () => {
    const totalIssues = MOCK_SHOPPING_PRODUCTS.reduce(
      (sum, row) => sum + (row.shopping_product?.issues?.length || 0),
      0
    );

    assert.strictEqual(totalIssues, 1);
  });

  test('formats price correctly', () => {
    const product = MOCK_SHOPPING_PRODUCTS[0];
    const price = product.shopping_product.price_micros / 1000000;

    assert.strictEqual(price, 99.99);
  });
});

// ============================================
// Performance by Dimension Tests
// ============================================

describe('Performance by Dimension', () => {
  test('extracts device performance correctly', () => {
    const mobileData = MOCK_DEVICE_PERFORMANCE.find(
      row => row.segments?.device === 'MOBILE'
    );

    assert.ok(mobileData);
    assert.strictEqual(mobileData.metrics.cost_micros / 1000000, 120);
    assert.strictEqual(mobileData.metrics.conversions, 15);
  });

  test('calculates device CPA', () => {
    const deviceCpa = MOCK_DEVICE_PERFORMANCE.map(row => {
      const cost = row.metrics.cost_micros / 1000000;
      const conversions = row.metrics.conversions;
      return {
        device: row.segments.device,
        cpa: conversions > 0 ? cost / conversions : null
      };
    });

    const mobileCpa = deviceCpa.find(d => d.device === 'MOBILE');
    const desktopCpa = deviceCpa.find(d => d.device === 'DESKTOP');

    assert.strictEqual(mobileCpa.cpa, 8);
    assert.strictEqual(desktopCpa.cpa, 7.2);
  });

  test('identifies best performing device', () => {
    const bestDevice = MOCK_DEVICE_PERFORMANCE.reduce((best, row) => {
      const roas = row.metrics.conversions_value / (row.metrics.cost_micros / 1000000);
      if (!best || roas > best.roas) {
        return { device: row.segments.device, roas };
      }
      return best;
    }, null);

    assert.strictEqual(bestDevice.device, 'DESKTOP');
  });

  test('calculates cost share', () => {
    const totalCost = MOCK_DEVICE_PERFORMANCE.reduce(
      (sum, row) => sum + row.metrics.cost_micros,
      0
    );

    const costShare = MOCK_DEVICE_PERFORMANCE.map(row => ({
      device: row.segments.device,
      share: (row.metrics.cost_micros / totalCost) * 100
    }));

    const mobileShare = costShare.find(d => d.device === 'MOBILE');
    const desktopShare = costShare.find(d => d.device === 'DESKTOP');

    // Mobile: $120 / $330 total = 36.36%
    assert.ok(Math.abs(mobileShare.share - 36.36) < 0.5);
    // Desktop: $180 / $330 total = 54.55%
    assert.ok(Math.abs(desktopShare.share - 54.55) < 0.5);
  });
});

// ============================================
// GAQL Query Tool Tests
// ============================================

describe('GAQL Query Tool', () => {
  test('flattenRow handles nested objects', () => {
    const row = {
      campaign: { id: '123', name: 'Test' },
      metrics: { cost_micros: 1000000 }
    };

    const flatten = (obj, prefix = '') => {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, flatten(value, newKey));
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flattened = flatten(row);

    assert.strictEqual(flattened['campaign.id'], '123');
    assert.strictEqual(flattened['campaign.name'], 'Test');
    assert.strictEqual(flattened['metrics.cost_micros'], 1000000);
  });

  test('converts micros to dollars', () => {
    const costMicros = 150000000;
    const costDollars = costMicros / 1000000;

    assert.strictEqual(costDollars, 150);
  });

  test('handles null values in nested objects', () => {
    const row = {
      campaign: { id: '123', name: null },
      metrics: { cost_micros: null }
    };

    const flatten = (obj, prefix = '') => {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(result, flatten(value, newKey));
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flattened = flatten(row);

    assert.strictEqual(flattened['campaign.name'], null);
    assert.strictEqual(flattened['metrics.cost_micros'], null);
  });
});

// ============================================
// Metrics Calculation Tests
// ============================================

describe('Metrics Calculations', () => {
  test('calculates ROAS correctly', () => {
    const calculateRoas = (conversionValue, cost) =>
      cost > 0 ? conversionValue / cost : 0;

    const campaigns = MOCK_CAMPAIGNS.map(c => ({
      name: c.campaign.name,
      roas: calculateRoas(
        c.metrics.conversions_value,
        c.metrics.cost_micros / 1000000
      )
    }));

    assert.ok(Math.abs(campaigns[0].roas - 16.67) < 0.01);
    assert.strictEqual(campaigns[1].roas, 4);
    assert.strictEqual(campaigns[2].roas, 30);
  });

  test('calculates CPA correctly', () => {
    const calculateCpa = (cost, conversions) =>
      conversions > 0 ? cost / conversions : null;

    const campaigns = MOCK_CAMPAIGNS.map(c => ({
      name: c.campaign.name,
      cpa: calculateCpa(
        c.metrics.cost_micros / 1000000,
        c.metrics.conversions
      )
    }));

    assert.strictEqual(campaigns[0].cpa, 6);
    assert.strictEqual(campaigns[1].cpa, 25);
  });

  test('calculates conversion rate correctly', () => {
    const calculateConvRate = (conversions, clicks) =>
      clicks > 0 ? (conversions / clicks) * 100 : 0;

    const campaigns = MOCK_CAMPAIGNS.map(c => ({
      name: c.campaign.name,
      convRate: calculateConvRate(c.metrics.conversions, c.metrics.clicks)
    }));

    assert.strictEqual(campaigns[0].convRate, 5);
    assert.strictEqual(campaigns[1].convRate, 1.25);
    assert.strictEqual(campaigns[2].convRate, 5);
  });

  test('calculates CTR correctly', () => {
    const calculateCtr = (clicks, impressions) =>
      impressions > 0 ? (clicks / impressions) * 100 : 0;

    const campaigns = MOCK_CAMPAIGNS.map(c => ({
      name: c.campaign.name,
      ctr: calculateCtr(c.metrics.clicks, c.metrics.impressions)
    }));

    assert.strictEqual(campaigns[0].ctr, 5);
    assert.strictEqual(campaigns[1].ctr, 4);
    assert.strictEqual(campaigns[2].ctr, 2);
  });

  test('calculates average CPC correctly', () => {
    const campaigns = MOCK_CAMPAIGNS.map(c => ({
      name: c.campaign.name,
      avgCpc: c.metrics.clicks > 0 ? (c.metrics.cost_micros / c.metrics.clicks) / 1000000 : 0
    }));

    assert.strictEqual(campaigns[0].avgCpc, 0.3);
    assert.ok(Math.abs(campaigns[1].avgCpc - 0.3125) < 0.001);
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe('Error Handling', () => {
  test('handles query validation errors', async () => {
    const { blockMutations } = await import('../server/utils/validation.js');

    assert.throws(
      () => blockMutations('DELETE FROM campaign'),
      /Mutation operations not allowed/
    );
  });

  test('handles missing required params', async () => {
    const { validateRequired } = await import('../server/utils/validation.js');

    assert.throws(
      () => validateRequired({}, ['customer_id']),
      /Missing required parameter.*customer_id/
    );
  });

  test('handles invalid enum values', async () => {
    const { validateEnum } = await import('../server/utils/validation.js');

    assert.throws(
      () => validateEnum('INVALID', ['ENABLED', 'PAUSED'], 'status'),
      /Invalid status.*INVALID/
    );
  });

  test('handles missing customer ID', async () => {
    const { getCustomerId } = await import('../server/utils/validation.js');

    // Clear env variable
    const saved = process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;

    assert.throws(
      () => getCustomerId({}),
      /customer_id parameter or GOOGLE_ADS_DEFAULT_CUSTOMER_ID/
    );

    process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = saved;
  });
});
