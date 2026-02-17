import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPromptsList, renderPrompt } from './server/prompts/templates.js';

describe('getPromptsList', () => {
  test('returns expected prompts', () => {
    const prompts = getPromptsList();
    assert.equal(Array.isArray(prompts), true);
    assert.equal(prompts.length, 3);

    const names = prompts.map((prompt) => prompt.name);
    assert.deepEqual(names.sort(), ['campaign_comparison', 'quick_health_check', 'search_term_analysis']);
  });
});

describe('renderPrompt', () => {
  test('renders quick health check', () => {
    const result = renderPrompt('quick_health_check', { account_id: '123' });
    const text = result.messages[0].content.text;

    assert.ok(text.includes('123'));
    assert.ok(text.includes('quick health check'));
  });

  test('applies default values for optional arguments', () => {
    const result = renderPrompt('search_term_analysis', { account_id: '123' });
    const text = result.messages[0].content.text;

    assert.ok(text.includes('Last30Days'));
  });

  test('throws on unknown prompt', () => {
    assert.throws(
      () => renderPrompt('unknown', {}),
      /Unknown prompt/
    );
  });
});

