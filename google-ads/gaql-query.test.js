import { test, describe } from 'node:test';
import assert from 'node:assert';
import { blockMutations } from './server/utils/validation.js';

// Test GAQL query validation logic (without API dependencies)
describe('GAQL query validation', () => {
  test('allows valid SELECT query', () => {
    assert.doesNotThrow(() => {
      blockMutations('SELECT campaign.id, campaign.name FROM campaign');
    });
  });

  test('allows complex SELECT with WHERE', () => {
    assert.doesNotThrow(() => {
      blockMutations(`
        SELECT campaign.id, metrics.cost_micros
        FROM campaign
        WHERE campaign.status = 'ENABLED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
      `);
    });
  });

  test('blocks CREATE mutation', () => {
    assert.throws(
      () => blockMutations('CREATE campaign'),
      /Mutation operations not allowed.*create/i
    );
  });

  test('blocks UPDATE mutation', () => {
    assert.throws(
      () => blockMutations('UPDATE campaign SET name = "test"'),
      /Mutation operations not allowed.*update/i
    );
  });

  test('blocks DELETE mutation', () => {
    assert.throws(
      () => blockMutations('DELETE FROM campaign WHERE id = 123'),
      /Mutation operations not allowed.*delete/i
    );
  });

  test('blocks REMOVE mutation', () => {
    assert.throws(
      () => blockMutations('REMOVE campaign'),
      /Mutation operations not allowed.*remove/i
    );
  });

  test('blocks MUTATE keyword', () => {
    assert.throws(
      () => blockMutations('MUTATE campaign operations'),
      /Mutation operations not allowed.*mutate/i
    );
  });

  test('blocks mutation hidden in query', () => {
    assert.throws(
      () => blockMutations('SELECT * FROM campaign; DELETE FROM campaign'),
      /Mutation operations not allowed/
    );
  });

  test('case insensitive blocking', () => {
    assert.throws(
      () => blockMutations('Update campaign'),
      /Mutation operations not allowed/
    );
  });
});
