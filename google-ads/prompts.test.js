import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getPromptsList, renderPrompt } from './server/prompts/templates.js';

describe('getPromptsList', () => {
  test('returns array of 5 prompts', () => {
    const prompts = getPromptsList();
    assert.ok(Array.isArray(prompts));
    assert.strictEqual(prompts.length, 5);
  });

  test('all prompts have required fields', () => {
    const prompts = getPromptsList();
    for (const prompt of prompts) {
      assert.ok(prompt.name, `Prompt missing name`);
      assert.ok(prompt.description, `${prompt.name} missing description`);
      assert.ok(Array.isArray(prompt.arguments), `${prompt.name} missing arguments`);
    }
  });

  test('includes expected prompts', () => {
    const prompts = getPromptsList();
    const names = prompts.map(p => p.name);
    assert.ok(names.includes('quick_health_check'));
    assert.ok(names.includes('weekly_account_review'));
    assert.ok(names.includes('negative_keyword_mining'));
    assert.ok(names.includes('shopping_optimization'));
    assert.ok(names.includes('competitive_analysis'));
  });
});

describe('renderPrompt', () => {
  test('renders quick_health_check with customer_id', () => {
    const result = renderPrompt('quick_health_check', { customer_id: '1234567890' });
    assert.ok(result.messages);
    assert.strictEqual(result.messages.length, 1);
    assert.strictEqual(result.messages[0].role, 'user');
    assert.ok(result.messages[0].content.text.includes('1234567890'));
  });

  test('renders weekly_account_review', () => {
    const result = renderPrompt('weekly_account_review', { customer_id: '9876543210' });
    assert.ok(result.messages[0].content.text.includes('weekly'));
    assert.ok(result.messages[0].content.text.includes('9876543210'));
  });

  test('renders negative_keyword_mining with defaults', () => {
    const result = renderPrompt('negative_keyword_mining', { customer_id: '123' });
    const text = result.messages[0].content.text;
    assert.ok(text.includes('LAST_30_DAYS') || text.includes('30'));
    assert.ok(text.includes('20') || text.includes('$20'));
  });

  test('throws on unknown prompt', () => {
    assert.throws(
      () => renderPrompt('unknown_prompt', {}),
      /Unknown prompt/
    );
  });
});
