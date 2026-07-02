/**
 * Unit tests for Google Ads MCP Server tools
 * Tests logic and data transformations without external dependencies
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

// Setup before each test
beforeEach(() => {
  process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID = '1234567890';
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-token';
  process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh';
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ============================================
// GAQL Templates Tests
// ============================================

describe('GAQL Templates', () => {
  test('buildQuery substitutes filters into LIST_ACCOUNTS', async () => {
    const { buildQuery, TEMPLATES } = await import('../server/utils/gaql-templates.js');

    const query = buildQuery(TEMPLATES.LIST_ACCOUNTS, { filters: '' });

    assert.ok(query.includes('SELECT'));
    assert.ok(query.includes('customer_client'));
  });

  test('buildQuery handles missing optional parameters', async () => {
    const { buildQuery, TEMPLATES } = await import('../server/utils/gaql-templates.js');

    assert.doesNotThrow(() => {
      buildQuery(TEMPLATES.LIST_ACCOUNTS, {});
    });
  });

  test('buildQuery includes provided filter clause', async () => {
    const { buildQuery, TEMPLATES } = await import('../server/utils/gaql-templates.js');

    const query = buildQuery(TEMPLATES.LIST_ACCOUNTS, {
      filters: "WHERE customer_client.status = 'ENABLED'"
    });

    assert.ok(query.includes("WHERE customer_client.status = 'ENABLED'"));
  });

  test('buildQuery throws on unreplaced template variables', async () => {
    const { buildQuery } = await import('../server/utils/gaql-templates.js');

    assert.throws(
      () => buildQuery('SELECT campaign.id FROM campaign WHERE segments.date = {{DATE}}'),
      /Unreplaced template variables.*\{\{DATE\}\}/
    );
  });
});

// ============================================
// Prompts Tests
// ============================================

describe('Prompts', () => {
  test('getPromptsList returns all prompts', async () => {
    const { getPromptsList } = await import('../server/prompts/templates.js');

    const prompts = getPromptsList();
    assert.ok(Array.isArray(prompts));
    assert.ok(prompts.length >= 5);

    // Check all prompts have required fields
    prompts.forEach(prompt => {
      assert.ok(prompt.name, 'Prompt missing name');
      assert.ok(prompt.description, 'Prompt missing description');
    });
  });

  test('renderPrompt substitutes variables', async () => {
    const { renderPrompt } = await import('../server/prompts/templates.js');

    const result = renderPrompt('quick_health_check', {
      customer_id: '1234567890'
    });

    assert.ok(result.messages);
    assert.strictEqual(result.messages.length, 1);
    assert.ok(result.messages[0].content.text.includes('1234567890'));
  });

  test('renderPrompt throws on missing required args', async () => {
    const { renderPrompt } = await import('../server/prompts/templates.js');

    assert.throws(
      () => renderPrompt('quick_health_check', {}),
      /Missing required arguments/
    );
  });

  test('renderPrompt throws on unknown prompt', async () => {
    const { renderPrompt } = await import('../server/prompts/templates.js');

    assert.throws(
      () => renderPrompt('nonexistent_prompt', {}),
      /Unknown prompt/
    );
  });

  test('renderPrompt applies default values', async () => {
    const { renderPrompt } = await import('../server/prompts/templates.js');

    // negative_keyword_mining has defaults for cost_threshold and date_range
    const result = renderPrompt('negative_keyword_mining', {
      customer_id: '1234567890'
    });

    assert.ok(result.messages);
    // Should work without providing optional args with defaults
  });
});

// ============================================
// Resources Tests
// ============================================

describe('Resources', () => {
  test('getResourcesList returns all resources', async () => {
    const { getResourcesList } = await import('../server/resources/index.js');

    const resources = getResourcesList();
    assert.ok(Array.isArray(resources));
    assert.ok(resources.length >= 2);

    // Check GAQL reference exists
    const gaql = resources.find(r => r.uri === 'gaql://reference');
    assert.ok(gaql);
    assert.ok(gaql.name);
    assert.ok(gaql.description);
  });

  test('readResource returns GAQL reference content', async () => {
    const { readResource } = await import('../server/resources/index.js');

    const result = readResource('gaql://reference');
    assert.ok(result.contents);
    assert.strictEqual(result.contents.length, 1);
    assert.ok(result.contents[0].text.length > 0);
  });

  test('readResource returns metrics glossary content', async () => {
    const { readResource } = await import('../server/resources/index.js');

    const result = readResource('metrics://definitions');
    assert.ok(result.contents);
    assert.strictEqual(result.contents.length, 1);
    assert.ok(result.contents[0].text.length > 0);
  });

  test('readResource throws on unknown URI', async () => {
    const { readResource } = await import('../server/resources/index.js');

    assert.throws(
      () => readResource('unknown://resource'),
      /Unknown resource/
    );
  });
});

// ============================================
// Data Transformation Tests (from fixtures)
// ============================================

describe('Campaign Data Transformations', () => {
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
});

describe('Search Terms Data Transformations', () => {
  test('identifies zero conversion terms', () => {
    const zeroConversionTerms = MOCK_SEARCH_TERMS.filter(
      row => (row.metrics?.conversions || 0) === 0
    );

    assert.strictEqual(zeroConversionTerms.length, 2);
  });

  test('calculates wasted spend', () => {
    const wastedSpend = MOCK_SEARCH_TERMS
      .filter(row => (row.metrics?.conversions || 0) === 0)
      .reduce((sum, row) => sum + (row.metrics?.cost_micros || 0), 0) / 1000000;

    assert.strictEqual(wastedSpend, 100);
  });
});

describe('Account Data Transformations', () => {
  test('parses account data correctly', () => {
    const accounts = MOCK_ACCOUNTS.map(row => ({
      id: row.customer_client.id,
      name: row.customer_client.descriptive_name,
      is_manager: row.customer_client.manager
    }));

    assert.strictEqual(accounts.length, 3);
    assert.strictEqual(accounts[0].id, '1234567890');
    assert.strictEqual(accounts[2].is_manager, true);
  });

  test('counts manager accounts correctly', () => {
    const managerCount = MOCK_ACCOUNTS.filter(
      a => a.customer_client.manager
    ).length;

    assert.strictEqual(managerCount, 1);
  });
});

describe('Quality Score Data Transformations', () => {
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
  });
});

describe('Budget Data Transformations', () => {
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
});

describe('Shopping Data Transformations', () => {
  test('counts product statuses', () => {
    const statusCounts = MOCK_SHOPPING_PRODUCTS.reduce((counts, row) => {
      const status = row.shopping_product?.status || 'UNKNOWN';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    assert.strictEqual(statusCounts['ELIGIBLE'], 1);
    assert.strictEqual(statusCounts['NOT_ELIGIBLE'], 1);
  });

  test('extracts issue types', () => {
    const allIssues = MOCK_SHOPPING_PRODUCTS.flatMap(
      row => row.shopping_product?.issues || []
    );

    const issueTypes = [...new Set(allIssues.map(i => i.type))];
    assert.ok(issueTypes.includes('MISSING_GTIN'));
  });
});

describe('Device Performance Transformations', () => {
  test('extracts device performance correctly', () => {
    const mobileData = MOCK_DEVICE_PERFORMANCE.find(
      row => row.segments?.device === 'MOBILE'
    );

    assert.ok(mobileData);
    assert.strictEqual(mobileData.metrics.cost_micros / 1000000, 120);
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
    assert.strictEqual(mobileCpa.cpa, 8);
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
  });
});
