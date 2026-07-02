import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPromptsList, renderPrompt } from './server/prompts/templates.js';

describe('getPromptsList', () => {
  test('returns all pinterest ads prompts with metadata', () => {
    const prompts = getPromptsList();

    assert.equal(prompts.length, 3);

    const names = prompts.map((prompt) => prompt.name);
    assert.ok(names.includes('spend_pacing_check'));
    assert.ok(names.includes('creative_performance_review'));
    assert.ok(names.includes('account_structure_audit'));

    for (const prompt of prompts) {
      assert.equal(typeof prompt.description, 'string');
      assert.equal(Array.isArray(prompt.arguments), true);
    }
  });
});

describe('renderPrompt', () => {
  test('substitutes arguments into the template', () => {
    const rendered = renderPrompt('spend_pacing_check', {
      ad_account_id: '549755885175',
      start_date: '2026-06-01',
      end_date: '2026-06-30'
    });

    const text = rendered.messages[0].content.text;
    assert.equal(rendered.messages[0].role, 'user');
    assert.match(text, /549755885175/);
    assert.match(text, /2026-06-01/);
    assert.match(text, /2026-06-30/);
    assert.doesNotMatch(text, /\{\{/);
  });

  test('renders prompt with only required arguments', () => {
    const rendered = renderPrompt('account_structure_audit', {
      ad_account_id: '549755885175'
    });

    assert.match(rendered.messages[0].content.text, /account structure audit/i);
  });

  test('throws when required arguments are missing', () => {
    assert.throws(
      () => renderPrompt('spend_pacing_check', { ad_account_id: '549755885175' }),
      /Missing required arguments for prompt "spend_pacing_check": start_date, end_date/
    );
  });

  test('throws on unknown prompt', () => {
    assert.throws(
      () => renderPrompt('does_not_exist', {}),
      /Unknown prompt/
    );
  });
});
