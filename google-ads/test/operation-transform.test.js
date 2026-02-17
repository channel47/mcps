/**
 * Unit tests for operation format transformation
 * Tests conversion from standard Google Ads format to Opteo library format
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  normalizeOperations,
  inferEntityFromResourceName,
  inferEntityFromCreateResource,
  isOpteoFormat,
  getStandardOperationType,
  RESOURCE_PATH_TO_ENTITY
} from '../server/utils/operation-transform.js';

// ============================================
// inferEntityFromResourceName tests
// ============================================

describe('inferEntityFromResourceName', () => {

  test('infers campaign from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaigns/456');
    assert.strictEqual(result, 'campaign');
  });

  test('infers ad_group from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/adGroups/789');
    assert.strictEqual(result, 'ad_group');
  });

  test('infers ad_group_criterion from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/adGroupCriteria/456~789');
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers campaign_criterion from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaignCriteria/456~789');
    assert.strictEqual(result, 'campaign_criterion');
  });

  test('infers label from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/labels/456');
    assert.strictEqual(result, 'label');
  });

  test('infers campaign_budget from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/campaignBudgets/456');
    assert.strictEqual(result, 'campaign_budget');
  });

  test('infers shared_set from resource_name', () => {
    const result = inferEntityFromResourceName('customers/123/sharedSets/456');
    assert.strictEqual(result, 'shared_set');
  });

  test('returns null for invalid resource_name', () => {
    const result = inferEntityFromResourceName('invalid/path');
    assert.strictEqual(result, null);
  });

  test('returns null for null input', () => {
    const result = inferEntityFromResourceName(null);
    assert.strictEqual(result, null);
  });

  test('returns null for unknown resource type', () => {
    const result = inferEntityFromResourceName('customers/123/unknownResource/456');
    assert.strictEqual(result, null);
  });
});

// ============================================
// inferEntityFromCreateResource tests
// ============================================

describe('inferEntityFromCreateResource', () => {

  test('infers ad_group_criterion from ad_group + keyword', () => {
    const resource = {
      ad_group: 'customers/123/adGroups/456',
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers ad_group_criterion from ad_group + negative', () => {
    const resource = {
      ad_group: 'customers/123/adGroups/456',
      negative: true,
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group_criterion');
  });

  test('infers campaign_criterion from campaign + keyword', () => {
    const resource = {
      campaign: 'customers/123/campaigns/456',
      negative: true,
      keyword: { text: 'test', match_type: 'PHRASE' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign_criterion');
  });

  test('infers shared_criterion from shared_set', () => {
    const resource = {
      shared_set: 'customers/123/sharedSets/456',
      keyword: { text: 'test', match_type: 'EXACT' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'shared_criterion');
  });

  test('infers label from name + text_label', () => {
    const resource = {
      name: 'Test Label',
      text_label: { background_color: '#FFFFFF' }
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'label');
  });

  test('infers ad_group from campaign + name', () => {
    const resource = {
      campaign: 'customers/123/campaigns/456',
      name: 'Test Ad Group',
      cpc_bid_micros: 1000000
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'ad_group');
  });

  test('infers campaign from advertising_channel_type', () => {
    const resource = {
      name: 'Test Campaign',
      advertising_channel_type: 'SEARCH',
      campaign_budget: 'customers/123/campaignBudgets/456'
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign');
  });

  test('infers campaign_budget from amount_micros', () => {
    const resource = {
      amount_micros: 10000000,
      delivery_method: 'STANDARD'
    };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, 'campaign_budget');
  });

  test('returns null for unknown structure', () => {
    const resource = { unknown_field: 'value' };
    const result = inferEntityFromCreateResource(resource);
    assert.strictEqual(result, null);
  });

  test('returns null for null input', () => {
    const result = inferEntityFromCreateResource(null);
    assert.strictEqual(result, null);
  });
});

// ============================================
// isOpteoFormat tests
// ============================================

describe('isOpteoFormat', () => {

  test('returns true for valid Opteo format', () => {
    const op = {
      entity: 'campaign',
      operation: 'update',
      resource: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), true);
  });

  test('returns true for Opteo format with default operation', () => {
    const op = {
      entity: 'label',
      resource: { name: 'Test Label' }
    };
    assert.strictEqual(isOpteoFormat(op), true);
  });

  test('returns false for standard format', () => {
    const op = {
      update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), false);
  });

  test('returns false for null', () => {
    assert.strictEqual(isOpteoFormat(null), false);
  });

  test('returns false for missing entity', () => {
    const op = {
      operation: 'update',
      resource: { status: 'PAUSED' }
    };
    assert.strictEqual(isOpteoFormat(op), false);
  });
});

// ============================================
// getStandardOperationType tests
// ============================================

describe('getStandardOperationType', () => {

  test('returns create for create operation', () => {
    const op = { create: { name: 'Test' } };
    assert.strictEqual(getStandardOperationType(op), 'create');
  });

  test('returns update for update operation', () => {
    const op = { update: { resource_name: '...', status: 'PAUSED' } };
    assert.strictEqual(getStandardOperationType(op), 'update');
  });

  test('returns remove for remove operation', () => {
    const op = { remove: 'customers/123/labels/456' };
    assert.strictEqual(getStandardOperationType(op), 'remove');
  });

  test('returns null for Opteo format', () => {
    const op = { entity: 'campaign', resource: {} };
    assert.strictEqual(getStandardOperationType(op), null);
  });

  test('returns null for invalid format', () => {
    const op = { invalid: 'format' };
    assert.strictEqual(getStandardOperationType(op), null);
  });

  test('returns null for null', () => {
    assert.strictEqual(getStandardOperationType(null), null);
  });
});

// ============================================
// normalizeOperations tests
// ============================================

describe('normalizeOperations', () => {

  describe('Opteo format passthrough', () => {

    test('passes through valid Opteo format unchanged', () => {
      const operations = [{
        entity: 'campaign',
        operation: 'update',
        resource: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.deepStrictEqual(result, operations);
      assert.strictEqual(warnings.length, 0);
    });

    test('passes through multiple Opteo format operations', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: { status: 'PAUSED' } },
        { entity: 'ad_group', operation: 'update', resource: { status: 'ENABLED' } }
      ];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.deepStrictEqual(result, operations);
      assert.strictEqual(warnings.length, 0);
    });

    test('normalizes Opteo format remove operation with object resource', () => {
      const operations = [{
        entity: 'label',
        operation: 'remove',
        resource: { resource_name: 'customers/123/labels/789' }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'remove');
      // Resource should be extracted as string from the object
      assert.strictEqual(result[0].resource, 'customers/123/labels/789');
      assert.strictEqual(warnings.length, 0);
    });

    test('passes through Opteo format remove with string resource', () => {
      const operations = [{
        entity: 'label',
        operation: 'remove',
        resource: 'customers/123/labels/789'
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'remove');
      assert.strictEqual(result[0].resource, 'customers/123/labels/789');
      assert.strictEqual(warnings.length, 0);
    });

    test('normalizes campaign_criterion remove operation', () => {
      const operations = [{
        entity: 'campaign_criterion',
        operation: 'remove',
        resource: { resource_name: 'customers/123/campaignCriteria/456~789' }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign_criterion');
      assert.strictEqual(result[0].operation, 'remove');
      assert.strictEqual(result[0].resource, 'customers/123/campaignCriteria/456~789');
    });
  });

  describe('Standard format transformation', () => {

    test('transforms update operation with resource_name', () => {
      const operations = [{
        update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'update');
      assert.deepStrictEqual(result[0].resource, operations[0].update);
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms remove operation with resource as string', () => {
      const operations = [{
        remove: 'customers/123/labels/789'
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'remove');
      // Resource should be the string directly, not wrapped in an object
      assert.strictEqual(result[0].resource, 'customers/123/labels/789');
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms create operation for ad_group_criterion', () => {
      const operations = [{
        create: {
          ad_group: 'customers/123/adGroups/456',
          negative: true,
          keyword: { text: 'test', match_type: 'EXACT' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'ad_group_criterion');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(warnings.length, 1);
    });

    test('transforms create operation for campaign_criterion', () => {
      const operations = [{
        create: {
          campaign: 'customers/123/campaigns/456',
          negative: true,
          keyword: { text: 'competitor', match_type: 'PHRASE' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign_criterion');
      assert.strictEqual(result[0].operation, 'create');
    });

    test('transforms create operation for label', () => {
      const operations = [{
        create: {
          name: 'Test Label',
          text_label: { background_color: '#FF0000' }
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'create');
    });
  });

  describe('Mixed format handling', () => {

    test('handles mixed Opteo and standard formats', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: { status: 'PAUSED' } },
        { update: { resource_name: 'customers/123/adGroups/789', status: 'ENABLED' } }
      ];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[1].entity, 'ad_group');
      assert.strictEqual(warnings.length, 1); // Only standard format generates warnings
    });
  });

  describe('Error handling', () => {

    test('throws on invalid operation format', () => {
      const operations = [{ invalid: 'format' }];

      assert.throws(
        () => normalizeOperations(operations),
        /Invalid format/
      );
    });

    test('throws when entity cannot be inferred from create', () => {
      const operations = [{
        create: { some_unknown_field: 'value' }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /Could not infer entity type/
      );
    });

    test('throws when entity cannot be inferred from update without resource_name', () => {
      const operations = [{
        update: { status: 'PAUSED' } // No resource_name
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /Could not infer entity type/
      );
    });

    test('throws when remove value is not a string', () => {
      const operations = [{
        remove: { resource_name: 'customers/123/labels/456' }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /'remove' value must be a resource_name string/
      );
    });

    test('throws when create value is not an object', () => {
      const operations = [{
        create: 'invalid'
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /'create' value must be an object/
      );
    });

    test('includes operation index in error message', () => {
      const operations = [
        { update: { resource_name: 'customers/123/campaigns/456', status: 'PAUSED' } },
        { invalid: 'format' }
      ];

      assert.throws(
        () => normalizeOperations(operations),
        /Operation 1:/
      );
    });
  });

  describe('_entity hint support', () => {

    test('uses _entity hint when inference fails', () => {
      const operations = [{
        create: { name: 'Test Item' },
        _entity: 'label'
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'label');
      assert.strictEqual(result[0].operation, 'create');
    });
  });

  // ============================================
  // Campaign creation - resource_name stripping
  // ============================================

  describe('Campaign creation - resource_name stripping', () => {

    test('preserves resource_name for campaign create (needed for PMax atomic ops)', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaigns/-1',
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          status: 'PAUSED',
          manual_cpc: {}
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'create');
      // resource_name is preserved for campaigns to support PMax atomic creation with temp IDs
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/campaigns/-1');
      assert.strictEqual(result[0].resource.name, 'Test Campaign');
    });

    test('preserves resource_name in campaign_budget create for atomic ops', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaignBudgets/-1',
          name: 'Test Budget',
          amount_micros: 50000000
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign_budget');
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/campaignBudgets/-1');
    });

    test('preserves all other campaign fields when stripping resource_name', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/campaigns/-1',
          name: 'Test',
          advertising_channel_type: 'DISPLAY',
          campaign_budget: 'customers/123/campaignBudgets/456',
          target_cpa: { target_cpa_micros: 25000000 },
          network_settings: { target_content_network: true }
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].resource.name, 'Test');
      assert.strictEqual(result[0].resource.advertising_channel_type, 'DISPLAY');
      assert.deepStrictEqual(result[0].resource.target_cpa, { target_cpa_micros: 25000000 });
      assert.deepStrictEqual(result[0].resource.network_settings, { target_content_network: true });
      assert.strictEqual(result[0].resource.campaign_budget, 'customers/123/campaignBudgets/456');
    });

    test('does not strip resource_name from UPDATE operations', () => {
      const operations = [{
        update: {
          resource_name: 'customers/123/campaigns/456',
          status: 'PAUSED'
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'update');
      assert.strictEqual(result[0].resource.resource_name, 'customers/123/campaigns/456');
    });

    test('strips resource_name from ad_group create operation', () => {
      const operations = [{
        create: {
          resource_name: 'customers/123/adGroups/-1',
          campaign: 'customers/123/campaigns/456',
          name: 'Test Ad Group',
          cpc_bid_micros: 1000000
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'ad_group');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(result[0].resource.resource_name, undefined);
      assert.strictEqual(result[0].resource.name, 'Test Ad Group');
    });

    test('campaign create without resource_name still works', () => {
      const operations = [{
        create: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          status: 'PAUSED',
          manual_cpc: {}  // Bidding strategy required since API v19.2
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(result[0].operation, 'create');
      assert.strictEqual(result[0].resource.resource_name, undefined);
    });
  });

  // ============================================
  // Campaign creation - EU political advertising and bidding strategy
  // ============================================

  describe('Campaign creation - EU political advertising', () => {

    test('auto-adds contains_eu_political_advertising if missing', () => {
      const operations = [{
        entity: 'campaign',
        operation: 'create',
        resource: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          manual_cpc: {}
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(
        result[0].resource.contains_eu_political_advertising,
        'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
      );
      assert.ok(warnings.some(w => w.includes('contains_eu_political_advertising')));
    });

    test('preserves existing contains_eu_political_advertising value', () => {
      const operations = [{
        entity: 'campaign',
        operation: 'create',
        resource: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          manual_cpc: {},
          contains_eu_political_advertising: 'CONTAINS_EU_POLITICAL_ADVERTISING'
        }
      }];

      const { operations: result, warnings } = normalizeOperations(operations);

      assert.strictEqual(
        result[0].resource.contains_eu_political_advertising,
        'CONTAINS_EU_POLITICAL_ADVERTISING'
      );
      // Should not have a warning about adding the field
      assert.ok(!warnings.some(w => w.includes('Auto-added contains_eu_political_advertising')));
    });

    test('throws error if bidding strategy is missing', () => {
      const operations = [{
        entity: 'campaign',
        operation: 'create',
        resource: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456'
          // No bidding strategy
        }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /Campaign CREATE requires a bidding strategy/
      );
    });

    test('accepts various bidding strategies', () => {
      const biddingStrategies = [
        { manual_cpc: {} },
        { maximize_conversions: {} },
        { maximize_conversion_value: { target_roas: 3.5 } },
        { target_cpa: { target_cpa_micros: 5000000 } },
        { target_spend: {} },
        { bidding_strategy: 'customers/123/biddingStrategies/456' }
      ];

      for (const bidding of biddingStrategies) {
        const operations = [{
          entity: 'campaign',
          operation: 'create',
          resource: {
            name: 'Test Campaign',
            advertising_channel_type: 'SEARCH',
            campaign_budget: 'customers/123/campaignBudgets/456',
            ...bidding
          }
        }];

        // Should not throw
        const { operations: result } = normalizeOperations(operations);
        assert.strictEqual(result[0].entity, 'campaign');
      }
    });

    test('works with standard format campaign create', () => {
      const operations = [{
        create: {
          name: 'Test Campaign',
          advertising_channel_type: 'SEARCH',
          campaign_budget: 'customers/123/campaignBudgets/456',
          manual_cpc: {}
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'campaign');
      assert.strictEqual(
        result[0].resource.contains_eu_political_advertising,
        'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
      );
    });
  });
});

// ============================================
// RESOURCE_PATH_TO_ENTITY coverage
// ============================================

describe('RESOURCE_PATH_TO_ENTITY mapping', () => {

  test('has all common resource types', () => {
    const expectedTypes = [
      'campaigns',
      'adGroups',
      'adGroupCriteria',
      'campaignCriteria',
      'labels',
      'sharedSets',
      'sharedCriteria',
      'campaignBudgets'
    ];

    for (const type of expectedTypes) {
      assert.ok(RESOURCE_PATH_TO_ENTITY[type], `Missing mapping for ${type}`);
    }
  });
});

// ============================================
// Image asset file path processing
// ============================================

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test directory for image files
const IMAGE_TEST_DIR = join(tmpdir(), 'google-ads-mcp-transform-test-' + Date.now());

// Minimal valid PNG (1x1 red pixel)
const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xAA, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

// Minimal valid JPEG
const VALID_JPEG_BYTES = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
  0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
  0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
  0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
  0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
  0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
  0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
  0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
  0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
  0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xA3,
  0xFF, 0xD9
]);

function setupImageTestDir() {
  try { mkdirSync(IMAGE_TEST_DIR, { recursive: true }); } catch {}
}

function cleanupImageTestDir() {
  try { rmSync(IMAGE_TEST_DIR, { recursive: true, force: true }); } catch {}
}

describe('Image asset file path processing', () => {

  describe('Standard format with image_file_path', () => {

    test('transforms create operation with image_file_path', () => {
      setupImageTestDir();
      const testFile = join(IMAGE_TEST_DIR, 'test.png');
      writeFileSync(testFile, VALID_PNG_BYTES);

      try {
        const operations = [{
          create: {
            name: 'Test Image Asset',
            image_file_path: testFile
          },
          _entity: 'asset'
        }];

        const { operations: result } = normalizeOperations(operations);

        assert.strictEqual(result[0].entity, 'asset');
        assert.strictEqual(result[0].operation, 'create');
        assert.strictEqual(result[0].resource.type, 'IMAGE');
        assert.ok(result[0].resource.image_asset);
        assert.ok(result[0].resource.image_asset.data);
        assert.strictEqual(result[0].resource.image_asset.mime_type, 'IMAGE_PNG');
        assert.strictEqual(result[0].resource.image_asset.file_size, VALID_PNG_BYTES.length);
        // Verify image_file_path is removed
        assert.strictEqual(result[0].resource.image_file_path, undefined);
        // Verify name is preserved
        assert.strictEqual(result[0].resource.name, 'Test Image Asset');
      } finally {
        cleanupImageTestDir();
      }
    });

    test('transforms JPEG image correctly', () => {
      setupImageTestDir();
      const testFile = join(IMAGE_TEST_DIR, 'test.jpg');
      writeFileSync(testFile, VALID_JPEG_BYTES);

      try {
        const operations = [{
          create: {
            name: 'JPEG Asset',
            image_file_path: testFile
          },
          _entity: 'asset'
        }];

        const { operations: result } = normalizeOperations(operations);

        assert.strictEqual(result[0].resource.image_asset.mime_type, 'IMAGE_JPEG');
      } finally {
        cleanupImageTestDir();
      }
    });
  });

  describe('Opteo format with image_file_path', () => {

    test('transforms Opteo format operation with image_file_path', () => {
      setupImageTestDir();
      const testFile = join(IMAGE_TEST_DIR, 'opteo-test.png');
      writeFileSync(testFile, VALID_PNG_BYTES);

      try {
        const operations = [{
          entity: 'asset',
          operation: 'create',
          resource: {
            name: 'Opteo Format Image',
            image_file_path: testFile
          }
        }];

        const { operations: result } = normalizeOperations(operations);

        assert.strictEqual(result[0].entity, 'asset');
        assert.strictEqual(result[0].operation, 'create');
        assert.strictEqual(result[0].resource.type, 'IMAGE');
        assert.ok(result[0].resource.image_asset);
        assert.strictEqual(result[0].resource.image_asset.mime_type, 'IMAGE_PNG');
        assert.strictEqual(result[0].resource.image_file_path, undefined);
        assert.strictEqual(result[0].resource.name, 'Opteo Format Image');
      } finally {
        cleanupImageTestDir();
      }
    });

    test('passes through Opteo format without image_file_path unchanged', () => {
      const operations = [{
        entity: 'asset',
        operation: 'create',
        resource: {
          name: 'Text Asset',
          text_asset: { text: 'Hello' }
        }
      }];

      const { operations: result } = normalizeOperations(operations);

      assert.strictEqual(result[0].entity, 'asset');
      assert.deepStrictEqual(result[0].resource.text_asset, { text: 'Hello' });
    });
  });

  describe('Error handling for image files', () => {

    test('throws clear error for missing image file in standard format', () => {
      const operations = [{
        create: {
          name: 'Missing Image',
          image_file_path: '/nonexistent/path/to/image.png'
        },
        _entity: 'asset'
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /File not found/
      );
    });

    test('throws clear error for missing image file in Opteo format', () => {
      const operations = [{
        entity: 'asset',
        operation: 'create',
        resource: {
          name: 'Missing Image',
          image_file_path: '/nonexistent/path/to/image.jpg'
        }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /File not found/
      );
    });

    test('throws error for relative path', () => {
      const operations = [{
        entity: 'asset',
        operation: 'create',
        resource: {
          name: 'Relative Path Image',
          image_file_path: 'relative/path/image.png'
        }
      }];

      assert.throws(
        () => normalizeOperations(operations),
        /absolute/
      );
    });

    test('throws error for invalid image format', () => {
      setupImageTestDir();
      const testFile = join(IMAGE_TEST_DIR, 'fake.png');
      writeFileSync(testFile, Buffer.from('This is not an image'));

      try {
        const operations = [{
          entity: 'asset',
          operation: 'create',
          resource: {
            name: 'Fake Image',
            image_file_path: testFile
          }
        }];

        assert.throws(
          () => normalizeOperations(operations),
          /not a valid PNG/
        );
      } finally {
        cleanupImageTestDir();
      }
    });

    test('includes operation index in error message', () => {
      const operations = [
        { entity: 'campaign', operation: 'update', resource: { status: 'PAUSED' } },
        {
          entity: 'asset',
          operation: 'create',
          resource: {
            name: 'Missing',
            image_file_path: '/nonexistent/image.png'
          }
        }
      ];

      assert.throws(
        () => normalizeOperations(operations),
        /Operation 1:/
      );
    });
  });

  describe('Base64 encoding verification', () => {

    test('produces valid base64 string (not Buffer)', () => {
      setupImageTestDir();
      const testFile = join(IMAGE_TEST_DIR, 'base64-test.png');
      writeFileSync(testFile, VALID_PNG_BYTES);

      try {
        const operations = [{
          entity: 'asset',
          operation: 'create',
          resource: {
            name: 'Base64 Test',
            image_file_path: testFile
          }
        }];

        const { operations: result } = normalizeOperations(operations);
        const base64Data = result[0].resource.image_asset.data;

        // Verify it's a string
        assert.strictEqual(typeof base64Data, 'string');

        // Verify it decodes correctly back to original bytes
        const decoded = Buffer.from(base64Data, 'base64');
        assert.deepStrictEqual(decoded, VALID_PNG_BYTES);
      } finally {
        cleanupImageTestDir();
      }
    });
  });
});
