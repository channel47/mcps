import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPromptsList, renderPrompt } from './server/prompts/templates.js';

describe('getPromptsList', () => {
  test('returns linkedin ads prompts with argument metadata', () => {
    const prompts = getPromptsList();

    assert.equal(Array.isArray(prompts), true);
    assert.equal(prompts.length, 3);

    const names = prompts.map((prompt) => prompt.name);
    assert.ok(names.includes('spend_pacing_check'));
    assert.ok(names.includes('creative_fatigue_check'));
    assert.ok(names.includes('campaign_performance_audit'));

    for (const prompt of prompts) {
      assert.equal(typeof prompt.description, 'string');
      assert.equal(Array.isArray(prompt.arguments), true);
      assert.ok(prompt.arguments.some((argument) => argument.name === 'account_id' && argument.required));
    }
  });
});

describe('renderPrompt', () => {
  test('substitutes required and defaulted arguments', () => {
    const rendered = renderPrompt('spend_pacing_check', {
      account_id: '512345678',
      start: '2026-06-01'
    });

    const text = rendered.messages[0].content.text;
    assert.match(text, /account 512345678/);
    assert.match(text, /from 2026-06-01 to today/);
    assert.doesNotMatch(text, /\{\{/);
  });

  test('explicit arguments override defaults', () => {
    const rendered = renderPrompt('campaign_performance_audit', {
      account_id: '512345678',
      start: '2026-06-01',
      end: '2026-06-30'
    });

    assert.match(rendered.messages[0].content.text, /to 2026-06-30/);
  });

  test('throws on missing required arguments', () => {
    assert.throws(
      () => renderPrompt('creative_fatigue_check', { account_id: '512345678' }),
      /Missing required arguments for prompt "creative_fatigue_check": start/
    );
  });

  test('throws on unknown prompt names', () => {
    assert.throws(
      () => renderPrompt('unknown_prompt', {}),
      /Unknown prompt: unknown_prompt/
    );
  });
});
